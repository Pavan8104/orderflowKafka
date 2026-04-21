import os
import json
import signal
import sys
from confluent_kafka import Consumer, Producer, KafkaError
from dotenv import load_dotenv
from app.shared.logger import setup_logger
from app.shared.database import init_db, save_order, order_exists
from app.shared.utils import retry

load_dotenv()

logger = setup_logger("order-consumer")

# Kafka Configuration
conf = {
    'bootstrap.servers': os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092'),
    'group.id': 'order-processing-group',
    'auto.offset.reset': 'earliest'
}

consumer = Consumer(conf)
# Producer for DLQ - sending failed orders here for manual review
dlq_producer = Producer({'bootstrap.servers': conf['bootstrap.servers']})

ORDER_TOPIC = os.getenv('ORDER_TOPIC', 'orders')
DLQ_TOPIC = os.getenv('DLQ_TOPIC', 'orders_dlq')

@retry(max_attempts=3, delay=2)
def process_single_order(order_data, partition, offset):
    order_id = order_data.get('order_id')
    
    # Idempotency check
    if order_exists(order_id):
        logger.warning("Order already exists, skipping", 
                       extra={"order_id": order_id, "partition": partition, "offset": offset})
        return True

    logger.info("Processing order", 
                extra={"order_id": order_id, "partition": partition, "offset": offset})

    # Failure Simulation for testing DLQ
    if order_data.get('item') == 'FAIL':
        logger.error("Simulated processing failure", extra={"order_id": order_id})
        raise Exception("Payment gateway timeout (Simulated)")

    # Business Logic (e.g., Payment/Inventory) - could fail transients here
    # For now, we just save to DB
    success = save_order(
        order_id=order_id,
        item=order_data.get('item'),
        amount=order_data.get('amount'),
        status='PROCESSED'
    )
    
    if not success:
        raise Exception(f"Failed to save order {order_id} to database")
    
    logger.info("Order processed and saved", extra={"order_id": order_id})
    return True

def shutdown(sig, frame):
    logger.info("Shutting down consumer and flushing producers...")
    dlq_producer.flush(timeout=5)
    consumer.close()
    sys.exit(0)

signal.signal(signal.SIGINT, shutdown)
signal.signal(signal.SIGTERM, shutdown)

def process_orders():
    init_db()
    consumer.subscribe([ORDER_TOPIC])
    logger.info("Consumer started, listening for orders...")

    while True:
        msg = consumer.poll(1.0)

        if msg is None:
            continue
        if msg.error():
            if msg.error().code() == KafkaError._PARTITION_EOF:
                continue
            else:
                logger.error("Kafka consumer error", extra={"error_code": msg.error().code(), "error_msg": str(msg.error())})
                break

        try:
            order_data = json.loads(msg.value().decode('utf-8'))
            process_single_order(
                order_data, 
                partition=msg.partition(), 
                offset=msg.offset()
            )
        except Exception as e:
            logger.error("Order processing failed after retries, moving to DLQ", extra={
                "error": str(e),
                "order_id": order_data.get('order_id') if 'order_data' in locals() else "unknown",
                "partition": msg.partition(),
                "offset": msg.offset()
            })
            # Push raw message to DLQ
            dlq_producer.produce(DLQ_TOPIC, value=msg.value(), key=msg.key())
            dlq_producer.flush()

if __name__ == '__main__':
    process_orders()
