# OrderFlow

A production-style real-time order processing system built with Python, Kafka, and SQLite.

## Features
- **Async Processing:** Orders are accepted via API and processed by decoupled consumers.
- **Reliability:** 3x retry logic with delay for transient failures.
- **Dead Letter Queue (DLQ):** Messages that fail all retries are moved to `orders_dlq`.
- **Idempotency:** 
  - **API-level:** Prevent duplicate Kafka events via `Idempotency-Key` header.
  - **Consumer-level:** Ensure orders aren't processed twice in the database.
- **Observability:** Structured JSON logging with Kafka metadata (partition/offset) and health check endpoints.
- **Dockerized:** Entire stack runs with one command.

## Architecture
1. **Order API:** Flask app that produces events to Kafka.
2. **Order Consumer:** Processes orders and saves them to SQLite.
3. **DLQ Monitor:** Separate consumer that watches for failed orders.
4. **Kafka:** The backbone message broker.

## Getting Started

### 1. Start the system
```bash
docker-compose up --build
```

### 2. Verify health
```bash
curl http://localhost:5000/health
```

### 3. Run simulations
Install dependencies locally:
```bash
pip install requests
```
Run the test script:
```bash
python scripts/test_system.py
```

## Monitoring Logs
To see the system in action (including retries and DLQ):
```bash
docker logs -f order-consumer
docker logs -f dlq-monitor
```
