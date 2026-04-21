# OrderFlow 🚀

OrderFlow is a real-time order processing system designed to demonstrate how to build reliable, event-driven backends using Kafka. It's built with Python and focus on production-style features like retries, dead-letter queues, and idempotency.

## How it works

The system consists of three main components:
1. **Order API**: A Flask service that receives orders and produces events to Kafka.
2. **Order Consumer**: Listens for new orders, processes them (simulated), and stores them in a SQLite database.
3. **DLQ Monitor**: A separate service that watches for messages that failed after multiple retries.

### Key Features
- **Reliability**: Automatic 3x retries with backoff for transient failures.
- **Dead Letter Queue (DLQ)**: Failed messages are moved to a special topic for manual review instead of being lost.
- **Idempotency**: Prevents duplicate processing if a client retries a request or if Kafka delivers a message twice.
- **Persistence**: SQLite with WAL mode enabled to handle concurrent access from both the API and Consumer.
- **Observability**: Structured JSON logging including Kafka partition and offset metadata.

---

## Quick Start

### 1. Spin up the stack
You'll need Docker and Docker Compose installed.
```bash
docker-compose up --build
```

### 2. Check health
Verify the API and its connection to Kafka:
```bash
curl http://localhost:5000/health
```

### 3. Send a test order
```bash
curl -X POST http://localhost:5000/create-order \
     -H "Content-Type: application/json" \
     -H "Idempotency-Key: unique-key-123" \
     -d '{"item": "Keyboard", "amount": 150.0}'
```

---

## Testing & Simulations

We've included a script to test the main features (Normal flow, Idempotency, and DLQ trigger).

1. Install local dependencies: `pip install requests`
2. Run the script: `python scripts/test_system.py`

### Monitoring Logs
Watch the consumer handle retries and the DLQ monitor catch failures:
```bash
# Main processing
docker logs -f order-consumer

# Monitoring failed messages
docker logs -f dlq-monitor
```
