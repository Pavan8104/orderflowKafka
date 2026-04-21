import os
import json
import uuid
from flask import Flask, request, jsonify
from confluent_kafka import Producer
from dotenv import load_dotenv
from app.shared.logger import setup_logger
from app.shared.database import init_db, save_idempotency_key, get_order_by_idempotency_key

load_dotenv()

app = Flask(__name__)
logger = setup_logger("order-api")

# Initialize DB for idempotency tracking
init_db()

# Kafka Configuration
conf = {
    'bootstrap.servers': os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092'),
    'client.id': 'order-api'
}

producer = Producer(conf)
ORDER_TOPIC = os.getenv('ORDER_TOPIC', 'orders')

def delivery_report(err, msg):
    if err is not None:
        logger.error("Message delivery failed", extra={"error": str(err)})
    else:
        logger.info("Message delivered", extra={
            "topic": msg.topic(),
            "partition": msg.partition(),
            "offset": msg.offset()
        })

@app.route('/health', methods=['GET'])
def health_check():
    try:
        # Check if Kafka is reachable by fetching metadata
        metadata = producer.list_topics(timeout=2.0)
        return jsonify({
            "status": "healthy",
            "kafka": "connected",
            "topics_found": len(metadata.topics)
        }), 200
    except Exception as e:
        logger.error("Health check failed", extra={"error": str(e)})
        return jsonify({
            "status": "unhealthy",
            "kafka": "disconnected",
            "error": str(e)
        }), 503

@app.route('/create-order', methods=['POST'])
def create_order():
    data = request.get_json()
    idempotency_key = request.headers.get('Idempotency-Key')
    
    if not data or 'item' not in data or 'amount' not in data:
        return jsonify({"error": "Missing required fields: item, amount"}), 400

    # Check for existing request with this idempotency key
    if idempotency_key:
        existing_order_id = get_order_by_idempotency_key(idempotency_key)
        if existing_order_id:
            logger.info("Duplicate request detected", 
                        extra={"idempotency_key": idempotency_key, "order_id": existing_order_id})
            return jsonify({
                "message": "Order already processed",
                "order_id": existing_order_id
            }), 200

    order_id = str(uuid.uuid4())
    order_event = {
        "order_id": order_id,
        "item": data['item'],
        "amount": data['amount'],
        "status": "PENDING"
    }

    try:
        # If key provided, track it before sending to Kafka
        if idempotency_key:
            save_idempotency_key(idempotency_key, order_id)

        # Produce message to Kafka
        producer.produce(
            ORDER_TOPIC, 
            key=order_id, 
            value=json.dumps(order_event),
            callback=delivery_report
        )
        producer.flush()
        
        logger.info("Order created and sent to Kafka", extra={"order_id": order_id})
        
        return jsonify({
            "message": "Order accepted",
            "order_id": order_id
        }), 202

    except Exception as e:
        logger.error("Failed to create order", extra={"error": str(e)})
        return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    app.run(port=int(os.getenv('PORT', 5000)), debug=True)
