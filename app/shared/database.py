import sqlite3
import os

from app.shared.config import config

def get_db_connection():
    conn = sqlite3.connect(config.DB_PATH, timeout=10) # Add timeout for busy database
    conn.row_factory = sqlite3.Row
    # Enable WAL mode for better concurrency between API and Consumer
    conn.execute('PRAGMA journal_mode=WAL')
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
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS idempotency_keys (
            key TEXT PRIMARY KEY,
            order_id TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def get_order_by_idempotency_key(key):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT order_id FROM idempotency_keys WHERE key = ?', (key,))
    row = cursor.fetchone()
    conn.close()
    return row['order_id'] if row else None

def save_idempotency_key(key, order_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'INSERT INTO idempotency_keys (key, order_id) VALUES (?, ?)',
            (key, order_id)
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
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
