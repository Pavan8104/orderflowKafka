import os
import json
import uuid
from flask import Flask, request, jsonify
from confluent_kafka import Producer
from dotenv import load_dotenv
from app.shared.logger import setup_logger

load_dotenv()

app = Flask(__name__)
logger = setup_logger("order-api")

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
    
    if not data or 'item' not in data or 'amount' not in data:
        return jsonify({"error": "Invalid order data"}), 400

    order_id = str(uuid.uuid4())
    order_event = {
        "order_id": order_id,
        "item": data['item'],
        "amount": data['amount'],
        "status": "PENDING"
    }

    try:
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
