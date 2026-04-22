import os
import json
import uuid
import jwt
import bcrypt
import datetime
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory
from confluent_kafka import Producer
from app.shared.logger import setup_logger
from app.shared.database import init_db, save_idempotency_key, get_order_by_idempotency_key, create_user, get_user
from app.shared.config import config
from app.shared.utils import check_kafka_ready

app = Flask(__name__, static_folder='../static')
logger = setup_logger("order-api")

# Initialize DB for user and idempotency tracking
init_db()

# --- Static Routes ---

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'login.html')

@app.route('/<path:path>')
def serve_static(path):
    # Check if the file exists in static folder
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'login.html')

# --- Auth Helpers ---

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(" ")[1]

        if not token:
            return jsonify({"success": False, "data": None, "error": "Token is missing"}), 401

        try:
            data = jwt.decode(token, config.SECRET_KEY, algorithms=["HS256"])
            current_user = get_user(data['username'])
            if not current_user:
                return jsonify({"success": False, "data": None, "error": "Invalid token"}), 401
        except Exception:
            return jsonify({"success": False, "data": None, "error": "Invalid or expired token"}), 401

        return f(current_user, *args, **kwargs)
    return decorated

# --- Kafka Configuration ---
conf = {
    'bootstrap.servers': config.KAFKA_BOOTSTRAP_SERVERS,
    'client.id': 'order-api'
}

producer = Producer(conf)

# Non-blocking check for Kafka
if not check_kafka_ready(producer):
    logger.warning("Kafka not immediately available. API starting anyway.")

def delivery_report(err, msg):
    if err is not None:
        logger.error("Message delivery failed", extra={"error_msg": str(err)})
    else:
        logger.info("Message delivered", extra={
            "topic": msg.topic(),
            "partition": msg.partition(),
            "offset": msg.offset()
        })

# --- Auth Endpoints ---

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({"success": False, "data": None, "error": "Username and password required"}), 400

    if len(data['password']) < 6:
        return jsonify({"success": False, "data": None, "error": "Password must be at least 6 characters"}), 400

    hashed_pw = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    if create_user(data['username'], hashed_pw):
        return jsonify({"success": True, "data": {"message": "User registered"}, "error": None}), 201
    return jsonify({"success": False, "data": None, "error": "User already exists"}), 400

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({"success": False, "data": None, "error": "Username and password required"}), 400

    user = get_user(data['username'])
    if user and bcrypt.checkpw(data['password'].encode('utf-8'), user['password_hash'].encode('utf-8')):
        token = jwt.encode({
            'username': user['username'],
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, config.SECRET_KEY, algorithm="HS256")
        
        return jsonify({"success": True, "data": {"token": token}, "error": None}), 200
    
    return jsonify({"success": False, "data": None, "error": "Invalid credentials"}), 401

@app.route('/health', methods=['GET'])
def health_check():
    try:
        # Check if Kafka is reachable
        metadata = producer.list_topics(timeout=2.0)
        return jsonify({
            "status": "healthy",
            "kafka": "connected",
            "topics_found": len(metadata.topics)
        }), 200
    except Exception:
        logger.exception("Health check failed")
        return jsonify({
            "status": "unhealthy",
            "kafka": "disconnected"
        }), 503

@app.route('/create-order', methods=['POST'])
@token_required
def create_order(current_user):
    data = request.get_json()
    idempotency_key = request.headers.get('Idempotency-Key')
    
    if not data or 'item' not in data or 'amount' not in data:
        return jsonify({"success": False, "data": None, "error": "Missing required fields: item, amount"}), 400

    try:
        amount = float(data['amount'])
        if amount <= 0:
            return jsonify({"success": False, "data": None, "error": "Amount must be greater than zero"}), 400
    except (ValueError, TypeError):
        return jsonify({"success": False, "data": None, "error": "Invalid amount format"}), 400

    if idempotency_key:
        try:
            existing_order_id = get_order_by_idempotency_key(idempotency_key)
            if existing_order_id:
                logger.info("Duplicate request detected", 
                            extra={"idempotency_key": idempotency_key, "order_id": existing_order_id})
                return jsonify({
                    "success": True,
                    "data": {
                        "message": "Order already processed",
                        "order_id": existing_order_id
                    },
                    "error": None
                }), 200
        except Exception:
            logger.exception("Idempotency check failed")
            return jsonify({"success": False, "data": None, "error": "Failed to verify order uniqueness"}), 500

    order_id = str(uuid.uuid4())
    order_event = {
        "order_id": order_id,
        "username": current_user['username'],
        "item": data['item'],
        "amount": data['amount'],
        "status": "PENDING"
    }

    try:
        if idempotency_key:
            save_idempotency_key(idempotency_key, order_id)

        # Produce message to Kafka (async)
        producer.produce(
            config.ORDER_TOPIC, 
            key=order_id, 
            value=json.dumps(order_event),
            callback=delivery_report
        )
        
        logger.info("Order accepted", extra={"order_id": order_id, "user": current_user['username']})
        
        return jsonify({
            "success": True,
            "data": {
                "message": "Order accepted",
                "order_id": order_id
            },
            "error": None
        }), 202

    except Exception:
        logger.exception("Failed to produce order")
        return jsonify({"success": False, "data": None, "error": "Internal server error"}), 500

@app.route('/order-status/<order_id>', methods=['GET'])
@token_required
def get_order_status(current_user, order_id):
    # This is a simple status check against the DB
    from app.shared.database import get_db_connection
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM orders WHERE order_id = ?', (order_id,))
    order = cursor.fetchone()
    conn.close()

    if order:
        return jsonify({
            "success": True, 
            "data": {
                "order_id": order['order_id'],
                "status": order['status'],
                "item": order['item']
            }, 
            "error": None
        }), 200
    
    return jsonify({"success": False, "data": None, "error": "Order not found"}), 404

@app.route('/my-orders', methods=['GET'])
@token_required
def get_my_orders(current_user):
    from app.shared.database import get_db_connection
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM orders WHERE username = ? ORDER BY created_at DESC', (current_user['username'],))
    orders = cursor.fetchall()
    conn.close()

    orders_list = []
    for order in orders:
        orders_list.append({
            "order_id": order['order_id'],
            "item": order['item'],
            "amount": order['amount'],
            "status": order['status'],
            "created_at": order['created_at']
        })

    return jsonify({"success": True, "data": {"orders": orders_list}, "error": None}), 200

@app.route('/failed-orders', methods=['GET'])
@token_required
def get_failed_orders(current_user):
    from app.shared.database import get_db_connection
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM failed_orders WHERE username = ? ORDER BY failed_at DESC', (current_user['username'],))
    failed = cursor.fetchall()
    conn.close()

    failed_list = []
    for f in failed:
        failed_list.append({
            "order_id": f['order_id'],
            "item": f['item'],
            "amount": f['amount'],
            "error": f['error_message'],
            "failed_at": f['failed_at']
        })

    return jsonify({"success": True, "data": {"failed_orders": failed_list}, "error": None}), 200

if __name__ == '__main__':
    # Use PORT from config for local dev
    app.run(host='0.0.0.0', port=config.PORT, debug=config.DEBUG)
