# Project Build Log: OrderFlow

This document chronicles how I built the OrderFlow system from a basic scaffolding to a production-ready async processing pipeline.

## Phase 1: Scaffolding & Core Messaging
I started with a simple vision: an API that accepts orders and a consumer that processes them. 
- Set up a Flask API (`app/api/app.py`) using `confluent-kafka`.
- Created a basic consumer (`app/consumer/main.py`) to pull events and store them in SQLite.
- **Initial Bug:** My first producer wasn't flushing messages, so they would just sit in the internal buffer until the process exited. Added `producer.flush()` to fix this, though I later refined this for performance.

## Phase 2: Reliability & Dockerization
Real systems fail. I needed to handle that.
- Added a `@retry` decorator for the consumer.
- Implemented a Dead Letter Queue (DLQ) topic (`orders_dlq`) so failed orders aren't just deleted.
- Set up the initial `docker-compose.yml` to run Kafka and Zookeeper.
- **Refinement:** The consumer was crashing if Kafka wasn't up yet. I added a quick `check_kafka_ready` helper to allow services to start even if Kafka takes a few extra seconds to boot.

## Phase 3: Idempotency & Data Integrity
Kafka can deliver messages more than once.
- Added an `Idempotency-Key` header check in the API to prevent duplicate Kafka events.
- Added a DB-level check in the consumer to ensure we don't process the same `order_id` twice.
- **Bug Encountered:** SQLite concurrency issues. When both the API and Consumer hit the DB at once, I got "database is locked". Fixed this by enabling **WAL (Write-Ahead Logging)** mode in the SQLite connection settings.

## Phase 4: Security & Frontend
A raw API isn't enough for a real product.
- Implemented JWT authentication for all order routes.
- Built a minimal frontend with plain HTML/JS (to keep it fast and dependency-free).
- **Challenge:** Handling token expiration gracefully. I updated the `app.js` to automatically redirect to the login page if the API returns a 401.

## Phase 5: Production Polish
Last mile cleanup.
- Switched the Flask dev server for **Gunicorn**.
- Standardized all JSON logs to include `order_id` and Kafka metadata (partition/offset) to make debugging in production actually possible.
- Added "My Orders" and "Failed Orders" sections to the dashboard for better visibility.
- Fixed a bug where the API was blocking on Kafka flushes; made the production async by removing the per-request flush.

## Final Stack
- **Backend:** Python (Flask, Gunicorn, Confluent-Kafka)
- **Frontend:** Vanilla JS, CSS3, HTML5
- **Broker:** Apache Kafka (KRaft mode)
- **Database:** SQLite (WAL mode)
- **Monitoring:** Dedicated DLQ monitoring consumer
