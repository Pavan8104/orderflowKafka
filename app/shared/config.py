import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Kafka
    KAFKA_BOOTSTRAP_SERVERS = os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092')
    ORDER_TOPIC = os.getenv('ORDER_TOPIC', 'orders')
    DLQ_TOPIC = os.getenv('DLQ_TOPIC', 'orders_dlq')
    
    # Database
    DB_PATH = os.getenv('DB_PATH', 'data/orders.db')
    
    # API
    PORT = int(os.getenv('PORT', 5000))
    DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'

config = Config()
