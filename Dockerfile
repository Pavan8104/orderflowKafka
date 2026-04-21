FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Ensure data directory exists
RUN mkdir -p data

ENV PYTHONPATH=/app

# Default port for Gunicorn
EXPOSE 5000

# Start with Gunicorn by default (for API service)
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app.api.app:app"]
