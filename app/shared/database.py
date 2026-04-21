import sqlite3
import os

DB_PATH = os.getenv('DB_PATH', 'orders.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            order_id TEXT PRIMARY KEY,
            item TEXT NOT NULL,
            amount REAL NOT NULL,
            status TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def order_exists(order_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT 1 FROM orders WHERE order_id = ?', (order_id,))
    exists = cursor.fetchone() is not None
    conn.close()
    return exists

def save_order(order_id, item, amount, status):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'INSERT INTO orders (order_id, item, amount, status) VALUES (?, ?, ?, ?)',
            (order_id, item, amount, status)
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        # This will be useful later for idempotency
        return False
    finally:
        conn.close()
