import time
import functools
from app.shared.logger import setup_logger

logger = setup_logger("retry-util")

def retry(max_attempts=3, delay=1):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            attempts = 0
            while attempts < max_attempts:
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    attempts += 1
                    if attempts == max_attempts:
                        logger.error(
                            f"Final attempt {attempts} failed", 
                            extra={"error": str(e), "func": func.__name__}
                        )
                        raise e
                    
                    logger.warning(
                        f"Attempt {attempts} failed, retrying in {delay}s...", 
                        extra={"error": str(e), "func": func.__name__}
                    )
                    time.sleep(delay)
            return None
        return wrapper
    return decorator

def wait_for_kafka(producer, timeout=30):
    """Wait for Kafka to become available by checking metadata."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            producer.list_topics(timeout=2.0)
            return True
        except Exception:
            time.sleep(2)
    return False
