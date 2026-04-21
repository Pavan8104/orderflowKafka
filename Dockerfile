FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for confluent-kafka if needed (though wheels usually work)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Set PYTHONPATH so 'app' module can be found
ENV PYTHONPATH=/app

CMD ["python", "app/api/app.py"]
