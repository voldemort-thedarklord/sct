from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from database import Base


def utc_now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "sch_users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="community_user")  # admin, health_worker, community_user
    assigned_zone = Column(String(120), nullable=True)
    phone = Column(String(40), nullable=True)
    created_at = Column(DateTime, default=utc_now)


class CommunityZone(Base):
    __tablename__ = "community_zones"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(32), unique=True, index=True, nullable=False)
    name = Column(String(120), nullable=False)
    district = Column(String(120), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    population = Column(Integer, nullable=False)
    water_source_type = Column(String(80), nullable=False)
    sanitation_index = Column(Float, default=72.0)
    current_risk_level = Column(String(32), default="Low")  # Low, Moderate, High, Critical
    current_risk_score = Column(Float, default=18.0)
    last_updated = Column(DateTime, default=utc_now)


class WaterReading(Base):
    __tablename__ = "water_readings"

    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey("community_zones.id"), nullable=False, index=True)
    zone_name = Column(String(120), nullable=False)
    ph = Column(Float, nullable=False)
    turbidity = Column(Float, nullable=False)  # NTU
    temperature = Column(Float, nullable=False)  # Celsius
    tds = Column(Float, nullable=False)  # mg/L
    electrical_conductivity = Column(Float, nullable=False)  # uS/cm
    dissolved_oxygen = Column(Float, nullable=False)  # mg/L
    rainfall_mm = Column(Float, default=0.0)
    is_anomaly = Column(Boolean, default=False)
    anomaly_score = Column(Float, default=0.0)
    risk_level = Column(String(32), default="Low")
    risk_score = Column(Float, default=15.0)
    source = Column(String(50), default="IoT Sensor")  # IoT Sensor, Manual Entry, CSV Upload
    recorded_by = Column(String(120), default="System Telemetry")
    timestamp = Column(DateTime, default=utc_now, index=True)


class HealthReport(Base):
    __tablename__ = "health_reports"

    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey("community_zones.id"), nullable=False, index=True)
    zone_name = Column(String(120), nullable=False)
    reporter_name = Column(String(120), nullable=False)
    reporter_role = Column(String(50), default="community_user")
    symptoms = Column(Text, nullable=False)  # JSON array of symptoms
    affected_count = Column(Integer, nullable=False, default=1)
    severity = Column(String(32), default="Moderate")  # Mild, Moderate, Severe
    water_source_used = Column(String(80), default="Municipal Pipeline")
    notes = Column(Text, nullable=True)
    verified = Column(Boolean, default=False)
    timestamp = Column(DateTime, default=utc_now, index=True)


class PredictionRecord(Base):
    __tablename__ = "prediction_records"

    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey("community_zones.id"), nullable=True, index=True)
    zone_name = Column(String(120), nullable=False)
    ph = Column(Float, nullable=False)
    turbidity = Column(Float, nullable=False)
    temperature = Column(Float, nullable=False)
    tds = Column(Float, nullable=False)
    dissolved_oxygen = Column(Float, nullable=False)
    symptom_cases_7d = Column(Integer, default=0)
    predicted_risk_level = Column(String(32), nullable=False)
    risk_score = Column(Float, nullable=False)
    rf_probabilities = Column(Text, nullable=False)  # JSON dict of class probabilities
    is_anomaly = Column(Boolean, default=False)
    anomaly_score = Column(Float, default=0.0)
    forecast_7d = Column(Text, nullable=False)  # JSON list of 7-day forecast points
    explanations = Column(Text, nullable=False)  # JSON list of feature attributions
    timestamp = Column(DateTime, default=utc_now, index=True)


class AlertRecord(Base):
    __tablename__ = "alert_records"

    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey("community_zones.id"), nullable=False, index=True)
    zone_name = Column(String(120), nullable=False)
    severity = Column(String(32), nullable=False)  # Moderate, High, Critical
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    trigger_source = Column(String(64), default="AI Prediction")  # AI Prediction, Water Anomaly, Symptom Cluster
    risk_score = Column(Float, default=75.0)
    status = Column(String(32), default="Pending")  # Pending, Verified, Dispatched, Resolved
    verified_by = Column(String(120), nullable=True)
    action_taken = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=utc_now, index=True)
    resolved_at = Column(DateTime, nullable=True)
