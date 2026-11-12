FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

WORKDIR /app

# Install system runtime library needed by XGBoost (libgomp1)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Pre-train / verify ML model artifacts with the container's exact scikit-learn & xgboost versions
RUN rm -rf models_artifacts/*.joblib && python -c "import ml_engine; print('ML models ready:', ml_engine.ml_engine.metrics['random_forest']['accuracy'])"

EXPOSE 8080

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1"]
