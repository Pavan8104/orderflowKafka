# OrderFlow 🚀

A real-time order processing system built with Python, Kafka, and SQLite. This project handles the full lifecycle of an order—from the API request to async processing and persistent storage.

## Architecture

1.  **Order API**: Flask app (running on Gunicorn) that receives orders and pushes events to Kafka.
2.  **Order Consumer**: Background worker that picks up orders, handles retries, and saves them to the DB.
3.  **DLQ Monitor**: A separate consumer that watches for messages that failed after multiple retries.
4.  **Kafka**: The messaging backbone.

## Key Features

-   **Reliable Processing**: Built-in 3x retry logic for the consumer.
-   **Dead Letter Queue**: Failed orders aren't lost; they're moved to a separate topic for debugging.
-   **Idempotency**: Handled at both the API (via header) and Consumer (DB check) levels to prevent double-processing.
-   **Structured Logs**: JSON logs including Kafka partition/offset data for easier tracing.
-   **Auth**: JWT-based login and registration.

## Running Locally

### 1. Start the stack
Requires Docker and Docker Compose.
```bash
docker-compose up --build
```

### 2. Verify everything is up
```bash
curl http://localhost:5000/health
```

### 3. Usage
Open `http://localhost:5000` in your browser to use the dashboard.

## Deployment Notes

-   **Persistence**: Make sure to mount a volume for `/app/data` if deploying on cloud providers, otherwise the SQLite DB will wipe on restart.
-   **Kafka**: If using a managed Kafka (like Confluent), update the `KAFKA_BOOTSTRAP_SERVERS` env var.
