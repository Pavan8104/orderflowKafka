import os
import json
import signal
import sys
from confluent_kafka import Consumer, KafkaError
from dotenv import load_dotenv
from app.shared.logger import setup_logger

load_dotenv()

logger = setup_logger("dlq-consumer")

conf = {
    'bootstrap.servers': os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092'),
    'group.id': 'dlq-monitoring-group',
    'auto.offset.reset': 'earliest'
}

consumer = Consumer(conf)
DLQ_TOPIC = os.getenv('DLQ_TOPIC', 'orders_dlq')

def shutdown(sig, frame):
    logger.info("Shutting down DLQ consumer...")
    consumer.close()
    sys.exit(0)

signal.signal(signal.SIGINT, shutdown)
signal.signal(signal.SIGTERM, shutdown)

def monitor_dlq():
    consumer.subscribe([DLQ_TOPIC])
    logger.info(f"DLQ Monitor active, watching topic: {DLQ_TOPIC}")

    while True:
        msg = consumer.poll(1.0)

        if msg is None:
            continue
        if msg.error():
            logger.error("DLQ Consumer error", extra={"error_msg": str(msg.error())})
            continue

        try:
            failed_order = json.loads(msg.value().decode('utf-8'))
            logger.warning("FAILED_ORDER_DETECTED", extra={
                "order_id": failed_order.get('order_id'),
                "item": failed_order.get('item'),
                "partition": msg.partition(),
                "offset": msg.offset()
            })
            # In a real app, you might trigger an email/pager alert here
        except Exception as e:
            logger.error("Error decoding DLQ message", extra={"error": str(e)})

if __name__ == '__main__':
    monitor_dlq()
