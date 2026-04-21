# OrderFlow 🚀

OrderFlow is a production-ready, event-driven order processing system built with Python, Kafka, and SQLite. It demonstrates reliable asynchronous processing using industrial patterns like Retries, Dead Letter Queues (DLQ), and Idempotency.

## Architecture

1.  **Order API**: A Flask application served by **Gunicorn**. It receives orders, checks for idempotency, and publishes events to Kafka.
2.  **Order Consumer**: A background worker that consumes orders from Kafka, processes them with built-in retry logic, and persists results to SQLite.
3.  **DLQ Monitor**: A specialized consumer that tracks failed messages in the `orders_dlq` topic for observability and manual intervention.
4.  **Kafka**: The central event backbone for reliable message delivery.

## Key Features

-   **Production Server**: Uses Gunicorn for the API to handle concurrent requests reliably.
-   **Reliability**: 3x retry mechanism with backoff for transient processing failures.
-   **Dead Letter Queue (DLQ)**: Ensures no data is lost; failed messages are moved to a dedicated topic.
-   **Idempotency**: Implemented at both the API and Consumer levels to prevent duplicate processing.
-   **Structured Logging**: JSON logs with full context (order IDs, Kafka metadata, stack traces).
-   **Centralized Config**: All settings managed via environment variables.

## Getting Started

### Local Setup (Docker)

The easiest way to run the entire stack is using Docker Compose:

```bash
docker-compose up --build
```

The API will be available at `http://localhost:5000`.

### Health Check

Verify the system and Kafka connectivity:
```bash
curl http://localhost:5000/health
```

### Simulation & Testing

We provide a script to simulate real-world scenarios:
```bash
pip install requests
python scripts/test_system.py
```

## Deployment

### Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `KAFKA_BOOTSTRAP_SERVERS` | Kafka broker addresses | `localhost:9092` |
| `DB_PATH` | Path to SQLite database file | `data/orders.db` |
| `PORT` | API port | `5000` |
| `DEBUG` | Enable Flask debug mode | `False` |

### Cloud Considerations (Render/Railway)

-   **Persistent Volumes**: Since we use SQLite, ensure your deployment platform has a persistent disk mounted at `/app/data` to prevent data loss on restarts.
-   **Managed Kafka**: If using a managed Kafka provider (e.g., Confluent, Upstash), update `KAFKA_BOOTSTRAP_SERVERS` and provide necessary credentials via environment variables.
-   **Scale**: The `order-consumer` can be scaled horizontally to increase processing throughput.

## API Usage

### Create Order
```bash
curl -X POST http://localhost:5000/create-order \
     -H "Content-Type: application/json" \
     -H "Idempotency-Key: unique-key-123" \
     -d '{"item": "Monitor", "amount": 300.0}'
```
