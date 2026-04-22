import requests
import time
import uuid

API_URL = "http://localhost:5000"

def create_order(item, amount, idempotency_key=None):
    headers = {}
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    
    payload = {
        "item": item,
        "amount": amount
    }
    
    try:
        response = requests.post(f"{API_URL}/create-order", json=payload, headers=headers)
        print(f"[{item}] Status: {response.status_code}, Body: {response.json()}")
        return response.json()
    except Exception as e:
        print(f"Failed to connect to API: {e}")

def run_tests():
    print("--- 1. Testing Normal Order ---")
    create_order("Laptop", 1200.0)

    print("\n--- 2. Testing API Idempotency ---")
    ikey = str(uuid.uuid4())
    create_order("Phone", 800.0, idempotency_key=ikey)
    print("Retrying same request...")
    create_order("Phone", 800.0, idempotency_key=ikey)

    print("\n--- 3. Testing Failure & DLQ (Item: FAIL) ---")
    print("This will trigger retries in the consumer and eventually land in DLQ.")
    create_order("FAIL", 0.0)

if __name__ == "__main__":
    # Wait for services to warm up
    print("Starting system tests...")
    run_tests()
