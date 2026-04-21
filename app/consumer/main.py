import os
import json
import signal
import sys
from confluent_kafka import Consumer, KafkaError
from dotenv import load_dotenv
from app.shared.logger import setup_logger
from app.shared.database import init_db, save_order

load_dotenv()

logger = setup_logger("order-consumer")

# Kafka Configuration
conf = {
    'bootstrap.servers': os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092'),
    'group.id': 'order-processing-group',
    'auto.offset.reset': 'earliest'
}

consumer = Consumer(conf)
ORDER_TOPIC = os.getenv('ORDER_TOPIC', 'orders')

def shutdown(sig, frame):
    logger.info("Shutting down consumer...")
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
                logger.error("Consumer error", extra={"error": str(msg.error())})
                break

        try:
            order_data = json.loads(msg.value().decode('utf-8'))
            order_id = order_data.get('order_id')
            
            logger.info("Processing order", extra={"order_id": order_id})

            # Save to database
            success = save_order(
                order_id=order_id,
                item=order_data.get('item'),
                amount=order_data.get('amount'),
                status='PROCESSED'
            )

            if success:
                logger.info("Order processed and saved", extra={"order_id": order_id})
            else:
                logger.warning("Order already exists, skipping", extra={"order_id": order_id})

        except Exception as e:
            logger.error("Failed to process order", extra={"error": str(e)})

if __name__ == '__main__':
    process_orders()
