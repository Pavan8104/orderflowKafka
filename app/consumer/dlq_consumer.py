import os
import json
import signal
import sys
from confluent_kafka import Consumer, KafkaError
from app.shared.logger import setup_logger
from app.shared.config import config

logger = setup_logger("dlq-consumer")

conf = {
    'bootstrap.servers': config.KAFKA_BOOTSTRAP_SERVERS,
    'group.id': 'dlq-monitoring-group',
    'auto.offset.reset': 'earliest'
}

consumer = Consumer(conf)

def shutdown(sig, frame):
    logger.info("Shutting down DLQ consumer...")
    consumer.close()
    sys.exit(0)

signal.signal(signal.SIGINT, shutdown)
signal.signal(signal.SIGTERM, shutdown)

def monitor_dlq():
    consumer.subscribe([config.DLQ_TOPIC])
    logger.info(f"DLQ Monitor active, watching topic: {config.DLQ_TOPIC}")

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
        except Exception:
            logger.exception("Error decoding DLQ message")

if __name__ == '__main__':
    monitor_dlq()
