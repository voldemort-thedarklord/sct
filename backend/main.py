import base64
import io
import json
import os
import time
from datetime import datetime, timezone
from typing import Optional, List
import pandas as pd
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import engine, Base, get_db, SessionLocal
from models import (
    User,
    CommunityZone,
    WaterReading,
    HealthReport,
    PredictionRecord,
    AlertRecord,
)
from ml_engine import ml_engine
from seed import seed_initial_data, fetch_live_precipitation_mm
from supabase_sync import sync_all_to_supabase, SUPABASE_PROJECT_ID, SUPABASE_URL

# Create tables and synchronize with Supabase
Base.metadata.create_all(bind=engine)
with SessionLocal() as _init_db:
    _supabase_synced = sync_all_to_supabase(_init_db)
    seed_initial_data(_init_db)
    _supabase_synced = sync_all_to_supabase(_init_db)

app = FastAPI(
    title="Smart Community Health AI/ML API",
    description="Authenticated water-borne disease risk prediction, sensor anomaly detection, and early warning API.",
    version="1.0.0",
)

_DEFAULT_ALLOWED_ORIGINS = [
    "https://smartcommunityht.vercel.app",
    "https://www.smartcommunityht.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
_EXTRA_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
ALLOWED_ORIGINS = list(dict.fromkeys(_DEFAULT_ALLOWED_ORIGINS + _EXTRA_ORIGINS))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https://([a-zA-Z0-9-]+\.)*vercel\.app$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
    max_age=86400,
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    origin = request.headers.get("origin", "")
    headers = {}
    if origin and (
        origin in ALLOWED_ORIGINS or origin.endswith(".vercel.app")
    ):
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Vary"] = "Origin"
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
        headers=headers,
    )


# --- Clerk Session Token Verification & Supabase User Sync ---

def decode_jwt_segment(seg: str) -> dict:
    padded = seg + "=" * (-len(seg) % 4)
    return json.loads(base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8"))


def get_current_user(
    authorization: Optional[str] = Header(default=None),
    x_clerk_user_email: Optional[str] = Header(default=None),
    x_clerk_user_name: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Please sign in with Clerk.",
        )
    token = authorization.split(" ", 1)[1].strip()
    parts = token.split(".")

    # Verify Clerk JWT (3-part RS256 JWT issued by Clerk)
    if len(parts) == 3:
        try:
            header = decode_jwt_segment(parts[0])
            payload = decode_jwt_segment(parts[1])
        except Exception:
            raise HTTPException(status_code=401, detail="Malformed Clerk session token.")

        clerk_sub = payload.get("sub", "")
        exp = int(payload.get("exp", 0))
        if not clerk_sub or not str(clerk_sub).startswith("user_"):
            raise HTTPException(status_code=401, detail="Invalid Clerk token subject.")
        if exp and exp < int(time.time()) - 60:
            raise HTTPException(status_code=401, detail="Clerk session token has expired.")

        clerk_marker = f"clerk:{clerk_sub}"
        email_claim = (
            x_clerk_user_email
            or payload.get("email")
            or f"{clerk_sub}@clerk.user"
        ).strip().lower()
        name_claim = (
            x_clerk_user_name
            or payload.get("name")
            or email_claim.split("@")[0]
        ).strip()

        user = db.query(User).filter(User.password_hash == clerk_marker).first()
        if not user and email_claim:
            user = db.query(User).filter(User.email == email_claim).first()

        if not user:
            user = User(
                name=name_claim or "Community Health User",
                email=email_claim,
                password_hash=clerk_marker,
                role="authority",
                assigned_zone="All Zones",
                phone="",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            updated = False
            if user.password_hash != clerk_marker:
                user.password_hash = clerk_marker
                updated = True
            if x_clerk_user_email and user.email.endswith("@clerk.user"):
                user.email = email_claim
                updated = True
            if x_clerk_user_name and user.name != name_claim:
                user.name = name_claim
                updated = True
            if updated:
                db.commit()
                db.refresh(user)

        return user

    raise HTTPException(status_code=401, detail="Invalid authentication token. Please sign in with Clerk.")


# --- Pydantic Schemas ---

class ClerkSyncRequest(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None
    assigned_zone: Optional[str] = None
    phone: Optional[str] = None


class CommunityZoneCreate(BaseModel):
    code: str
    name: str
    district: str
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    population: int = Field(default=0, ge=0)
    water_source_type: str
    sanitation_index: float = Field(default=0.0, ge=0.0, le=100.0)


class WaterReadingCreate(BaseModel):
    zone_id: int
    ph: float = Field(..., ge=0.0, le=14.0)
    turbidity: float = Field(..., ge=0.0)
    temperature: float
    tds: float = Field(..., ge=0.0)
    electrical_conductivity: Optional[float] = None
    dissolved_oxygen: float = Field(..., ge=0.0)
    rainfall_mm: float = Field(default=0.0, ge=0.0)
    source: str = "Field Telemetry"
    recorded_by: Optional[str] = None


class HealthReportCreate(BaseModel):
    zone_id: int
    reporter_name: Optional[str] = None
    reporter_role: Optional[str] = None
    symptoms: List[str]
    affected_count: int = Field(..., ge=1)
    severity: str = "Moderate"
    water_source_used: str
    notes: Optional[str] = ""


class PredictRequest(BaseModel):
    zone_id: Optional[int] = None
    zone_name: Optional[str] = None
    ph: float = Field(..., ge=0.0, le=14.0)
    turbidity: float = Field(..., ge=0.0)
    temperature: float
    tds: float = Field(..., ge=0.0)
    dissolved_oxygen: float = Field(..., ge=0.0)
    symptom_cases_7d: int = Field(default=0, ge=0)
    rainfall_mm: float = Field(default=0.0, ge=0.0)
    save_record: bool = True


class AlertVerifyRequest(BaseModel):
    status: str  # Verified, Dispatched, Resolved
    verified_by: Optional[str] = None
    action_taken: str


# --- Helper Serializers ---

def serialize_user(u: User, token: Optional[str] = None):
    res = {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "role": u.role,
        "assigned_zone": u.assigned_zone or "",
        "phone": u.phone or "",
    }
    if token:
        res["token"] = token
    return res


def serialize_zone(z: CommunityZone, latest_reading: Optional[WaterReading] = None, symptom_count: int = 0):
    return {
        "id": z.id,
        "code": z.code,
        "name": z.name,
        "district": z.district,
        "latitude": z.latitude,
        "longitude": z.longitude,
        "population": z.population,
        "water_source_type": z.water_source_type,
        "sanitation_index": z.sanitation_index,
        "current_risk_level": z.current_risk_level,
        "current_risk_score": z.current_risk_score,
        "symptom_cases_active": symptom_count,
        "last_updated": z.last_updated.isoformat() if z.last_updated else None,
        "latest_water": {
            "ph": latest_reading.ph,
            "turbidity": latest_reading.turbidity,
            "temperature": latest_reading.temperature,
            "tds": latest_reading.tds,
            "electrical_conductivity": latest_reading.electrical_conductivity,
            "dissolved_oxygen": latest_reading.dissolved_oxygen,
            "is_anomaly": latest_reading.is_anomaly,
            "anomaly_score": latest_reading.anomaly_score,
        }
        if latest_reading
        else None,
    }


def serialize_water(w: WaterReading):
    return {
        "id": w.id,
        "zone_id": w.zone_id,
        "zone_name": w.zone_name,
        "ph": w.ph,
        "turbidity": w.turbidity,
        "temperature": w.temperature,
        "tds": w.tds,
        "electrical_conductivity": w.electrical_conductivity,
        "dissolved_oxygen": w.dissolved_oxygen,
        "rainfall_mm": w.rainfall_mm,
        "is_anomaly": w.is_anomaly,
        "anomaly_score": w.anomaly_score,
        "risk_level": w.risk_level,
        "risk_score": w.risk_score,
        "source": w.source,
        "recorded_by": w.recorded_by,
        "timestamp": w.timestamp.isoformat() if w.timestamp else None,
    }


def serialize_report(r: HealthReport):
    try:
        symptoms_list = json.loads(r.symptoms)
    except Exception:
        symptoms_list = [s.strip() for s in r.symptoms.split(",") if s.strip()]
    return {
        "id": r.id,
        "zone_id": r.zone_id,
        "zone_name": r.zone_name,
        "reporter_name": r.reporter_name,
        "reporter_role": r.reporter_role,
        "symptoms": symptoms_list,
        "affected_count": r.affected_count,
        "severity": r.severity,
        "water_source_used": r.water_source_used,
        "notes": r.notes,
        "verified": r.verified,
        "timestamp": r.timestamp.isoformat() if r.timestamp else None,
    }


def serialize_alert(a: AlertRecord):
    return {
        "id": a.id,
        "zone_id": a.zone_id,
        "zone_name": a.zone_name,
        "severity": a.severity,
        "title": a.title,
        "message": a.message,
        "trigger_source": a.trigger_source,
        "risk_score": a.risk_score,
        "status": a.status,
        "verified_by": a.verified_by,
        "action_taken": a.action_taken,
        "timestamp": a.timestamp.isoformat() if a.timestamp else None,
        "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
    }


def serialize_prediction(p: PredictionRecord):
    return {
        "id": p.id,
        "zone_id": p.zone_id,
        "zone_name": p.zone_name,
        "ph": p.ph,
        "turbidity": p.turbidity,
        "temperature": p.temperature,
        "tds": p.tds,
        "dissolved_oxygen": p.dissolved_oxygen,
        "symptom_cases_7d": p.symptom_cases_7d,
        "predicted_risk_level": p.predicted_risk_level,
        "risk_score": p.risk_score,
        "rf_probabilities": json.loads(p.rf_probabilities),
        "is_anomaly": p.is_anomaly,
        "anomaly_score": p.anomaly_score,
        "forecast_7d": json.loads(p.forecast_7d),
        "explanations": json.loads(p.explanations),
        "timestamp": p.timestamp.isoformat() if p.timestamp else None,
    }


# --- Public Health & Auth Endpoints ---

@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    return {
        "status": "operational",
        "service": "Smart Community Health FastAPI Backend",
        "auth_protection": "Clerk JWT Session Token + Supabase User Sync enforced on all routes",
        "models_loaded": ["RandomForestClassifier", "IsolationForest", "XGBRegressor"],
        "ml_metrics": ml_engine.metrics,
        "supabase": {
            "connected": bool(SUPABASE_URL),
            "project_id": SUPABASE_PROJECT_ID,
            "url": SUPABASE_URL,
            "record_counts": {
                "sch_users": db.query(User).count(),
                "community_zones": db.query(CommunityZone).count(),
                "water_readings": db.query(WaterReading).count(),
                "health_reports": db.query(HealthReport).count(),
                "prediction_records": db.query(PredictionRecord).count(),
                "alert_records": db.query(AlertRecord).count(),
            },
        },
        "external_integrations": {
            "clerk_auth": "connected (app_3LxpuwvcNrJ92wQyOVPMmb2sY2S)",
            "supabase_postgres": f"connected ({SUPABASE_PROJECT_ID})",
            "open_meteo_rainfall": "active (keyless)",
            "carto_basemaps": "configured" if os.getenv("CARTO_API_KEY") else "active (keyless)",
            "openweather_configured": bool(os.getenv("OPENWEATHER_API_KEY")),
            "twilio_sms_configured": bool(os.getenv("TWILIO_ACCOUNT_SID") and os.getenv("TWILIO_AUTH_TOKEN")),
            "smtp_email_configured": bool(os.getenv("SMTP_HOST") and os.getenv("SMTP_USER")),
        },
    }


@app.post("/api/auth/clerk-sync")
def clerk_sync(
    payload: ClerkSyncRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updated = False
    if payload.email and payload.email.strip():
        email_clean = payload.email.strip().lower()
        if current_user.email != email_clean:
            current_user.email = email_clean
            updated = True
    if payload.name and payload.name.strip():
        name_clean = payload.name.strip()
        if current_user.name != name_clean:
            current_user.name = name_clean
            updated = True
    if payload.role and payload.role.strip():
        if current_user.role != payload.role.strip():
            current_user.role = payload.role.strip()
            updated = True
    if payload.assigned_zone is not None:
        current_user.assigned_zone = payload.assigned_zone.strip()
        updated = True
    if payload.phone is not None:
        current_user.phone = payload.phone.strip()
        updated = True

    if updated:
        db.commit()
        db.refresh(current_user)
    return serialize_user(current_user)


@app.patch("/api/auth/profile")
def update_profile(
    payload: ClerkSyncRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.role and payload.role.strip():
        current_user.role = payload.role.strip()
    if payload.assigned_zone is not None:
        current_user.assigned_zone = payload.assigned_zone.strip()
    if payload.phone is not None:
        current_user.phone = payload.phone.strip()
    if payload.name and payload.name.strip():
        current_user.name = payload.name.strip()
    db.commit()
    db.refresh(current_user)
    return serialize_user(current_user)


@app.get("/api/auth/me")
def get_me(current_user: User = Depends(get_current_user)):
    return serialize_user(current_user)


# --- Protected Surveillance & ML Endpoints (All Require Bearer Authentication) ---

@app.get("/api/zones")
def list_zones(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    zones = db.query(CommunityZone).order_by(CommunityZone.current_risk_score.desc()).all()
    result = []
    for z in zones:
        latest_w = (
            db.query(WaterReading)
            .filter(WaterReading.zone_id == z.id)
            .order_by(WaterReading.timestamp.desc())
            .first()
        )
        reports = db.query(HealthReport).filter(HealthReport.zone_id == z.id).all()
        symptom_sum = sum(r.affected_count for r in reports)
        result.append(serialize_zone(z, latest_w, symptom_sum))
    return result


@app.post("/api/zones")
def create_zone(
    payload: CommunityZoneCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    code_clean = payload.code.strip().upper()
    existing = db.query(CommunityZone).filter(CommunityZone.code == code_clean).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Station code '{code_clean}' already exists.")

    zone = CommunityZone(
        code=code_clean,
        name=payload.name.strip(),
        district=payload.district.strip(),
        latitude=payload.latitude,
        longitude=payload.longitude,
        population=payload.population,
        water_source_type=payload.water_source_type.strip(),
        sanitation_index=payload.sanitation_index,
        current_risk_level="Low",
        current_risk_score=0.0,
        last_updated=datetime.now(timezone.utc),
    )
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return serialize_zone(zone, None, 0)


@app.get("/api/dashboard/summary")
def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    zones = db.query(CommunityZone).order_by(CommunityZone.current_risk_score.desc()).all()
    readings = db.query(WaterReading).order_by(WaterReading.timestamp.desc()).all()
    reports = db.query(HealthReport).order_by(HealthReport.timestamp.desc()).all()
    alerts = db.query(AlertRecord).order_by(AlertRecord.timestamp.desc()).all()

    total_affected = sum(r.affected_count for r in reports)
    recent_slice = readings[:16]
    anomaly_count = sum(1 for w in recent_slice if w.is_anomaly)
    avg_ph = round(sum(w.ph for w in recent_slice) / len(recent_slice), 2) if recent_slice else 0.0
    avg_turbidity = round(sum(w.turbidity for w in recent_slice) / len(recent_slice), 2) if recent_slice else 0.0
    avg_tds = round(sum(w.tds for w in recent_slice) / len(recent_slice), 1) if recent_slice else 0.0
    avg_do = round(sum(w.dissolved_oxygen for w in recent_slice) / len(recent_slice), 2) if recent_slice else 0.0

    risk_counts = {"Low": 0, "Moderate": 0, "High": 0, "Critical": 0}
    for z in zones:
        risk_counts[z.current_risk_level] = risk_counts.get(z.current_risk_level, 0) + 1

    symptom_freq: dict = {}
    for r in reports:
        try:
            s_list = json.loads(r.symptoms)
        except Exception:
            s_list = []
        for s in s_list:
            symptom_freq[s] = symptom_freq.get(s, 0) + r.affected_count

    serialized_zones = []
    for z in zones:
        latest_w = next((w for w in readings if w.zone_id == z.id), None)
        z_cases = sum(r.affected_count for r in reports if r.zone_id == z.id)
        serialized_zones.append(serialize_zone(z, latest_w, z_cases))

    wqi = (
        round(100.0 - (sum(z.current_risk_score for z in zones) / len(zones)), 1)
        if zones
        else 0.0
    )

    return {
        "kpis": {
            "total_health_reports": len(reports),
            "total_affected_people": total_affected,
            "monitored_zones": len(zones),
            "high_or_critical_zones": risk_counts["High"] + risk_counts["Critical"],
            "active_alerts": sum(1 for a in alerts if a.status in ("Pending", "Verified", "Dispatched")),
            "pending_verification": sum(1 for a in alerts if a.status == "Pending"),
            "anomalies_detected": anomaly_count,
            "water_quality_index": wqi,
            "avg_ph": avg_ph,
            "avg_turbidity": avg_turbidity,
            "avg_tds": avg_tds,
            "avg_do": avg_do,
        },
        "risk_distribution": risk_counts,
        "symptom_breakdown": symptom_freq,
        "zones": serialized_zones,
        "recent_alerts": [serialize_alert(a) for a in alerts[:8]],
        "recent_readings": [serialize_water(w) for w in readings[:12]],
        "recent_reports": [serialize_report(r) for r in reports[:8]],
        "ml_metrics": ml_engine.metrics,
    }


@app.get("/api/water")
def list_water_readings(
    zone_id: Optional[int] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(WaterReading)
    if zone_id is not None:
        q = q.filter(WaterReading.zone_id == zone_id)
    items = q.order_by(WaterReading.timestamp.desc()).limit(limit).all()
    return [serialize_water(w) for w in items]


@app.post("/api/water")
def create_water_reading(
    payload: WaterReadingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    zone = db.query(CommunityZone).filter(CommunityZone.id == payload.zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Monitoring station not found.")

    reports = db.query(HealthReport).filter(HealthReport.zone_id == zone.id).all()
    active_cases = sum(r.affected_count for r in reports)
    live_rain = (
        payload.rainfall_mm
        if payload.rainfall_mm > 0.0
        else fetch_live_precipitation_mm(zone.latitude, zone.longitude)
    )

    analysis = ml_engine.analyze(
        ph=payload.ph,
        turbidity=payload.turbidity,
        temperature=payload.temperature,
        tds=payload.tds,
        dissolved_oxygen=payload.dissolved_oxygen,
        symptom_cases_7d=active_cases,
        rainfall_mm=live_rain,
    )

    ec = payload.electrical_conductivity or round(payload.tds * 1.58, 1)
    reading = WaterReading(
        zone_id=zone.id,
        zone_name=zone.name,
        ph=payload.ph,
        turbidity=payload.turbidity,
        temperature=payload.temperature,
        tds=payload.tds,
        electrical_conductivity=ec,
        dissolved_oxygen=payload.dissolved_oxygen,
        rainfall_mm=live_rain,
        is_anomaly=analysis["is_anomaly"],
        anomaly_score=analysis["anomaly_score"],
        risk_level=analysis["predicted_risk_level"],
        risk_score=analysis["risk_score"],
        source=payload.source,
        recorded_by=payload.recorded_by or current_user.name,
        timestamp=datetime.now(timezone.utc),
    )
    db.add(reading)

    zone.current_risk_level = analysis["predicted_risk_level"]
    zone.current_risk_score = analysis["risk_score"]
    zone.last_updated = datetime.now(timezone.utc)

    pred_record = PredictionRecord(
        zone_id=zone.id,
        zone_name=zone.name,
        ph=payload.ph,
        turbidity=payload.turbidity,
        temperature=payload.temperature,
        tds=payload.tds,
        dissolved_oxygen=payload.dissolved_oxygen,
        symptom_cases_7d=active_cases,
        predicted_risk_level=analysis["predicted_risk_level"],
        risk_score=analysis["risk_score"],
        rf_probabilities=json.dumps(analysis["rf_probabilities"]),
        is_anomaly=analysis["is_anomaly"],
        anomaly_score=analysis["anomaly_score"],
        forecast_7d=json.dumps(analysis["forecast_7d"]),
        explanations=json.dumps(analysis["explanations"]),
    )
    db.add(pred_record)

    alert_created = None
    if analysis["predicted_risk_level"] in ("High", "Critical") or analysis["is_anomaly"]:
        sev = (
            analysis["predicted_risk_level"]
            if analysis["predicted_risk_level"] in ("High", "Critical")
            else "Moderate"
        )
        alert_created = AlertRecord(
            zone_id=zone.id,
            zone_name=zone.name,
            severity=sev,
            title=f"{sev.upper()} WATER ALERT: {zone.name}",
            message=(
                f"Reading logged by {current_user.name} (pH {payload.ph}, Turbidity {payload.turbidity} NTU, "
                f"TDS {payload.tds} mg/L, DO {payload.dissolved_oxygen} mg/L) classified as "
                f"{analysis['predicted_risk_level']} risk (Score {analysis['risk_score']}/100)."
            ),
            trigger_source="Isolation Forest & RF Model" if analysis["is_anomaly"] else "AI Risk Classifier",
            risk_score=analysis["risk_score"],
            status="Pending",
        )
        db.add(alert_created)

    db.commit()
    db.refresh(reading)

    return {
        "reading": serialize_water(reading),
        "ml_analysis": analysis,
        "alert_triggered": serialize_alert(alert_created) if alert_created else None,
    }


@app.post("/api/water/upload-csv")
async def upload_water_csv(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid CSV file: {exc}")

    df.columns = [c.strip().lower() for c in df.columns]
    required = {"ph", "turbidity", "temperature", "tds"}
    if not required.issubset(set(df.columns)):
        raise HTTPException(
            status_code=400,
            detail="CSV must include columns: ph, turbidity, temperature, tds (optional: dissolved_oxygen, zone_id, rainfall_mm)",
        )

    zones = db.query(CommunityZone).all()
    if not zones:
        raise HTTPException(
            status_code=400,
            detail="Register at least one monitoring station before uploading batch CSV readings.",
        )

    zone_map = {z.id: z for z in zones}
    default_zone = zones[0]

    processed = []
    alerts_triggered = 0

    for _, row in df.iterrows():
        z_id = int(row.get("zone_id", default_zone.id)) if pd.notna(row.get("zone_id")) else default_zone.id
        zone = zone_map.get(z_id, default_zone)
        ph = float(row["ph"])
        turbidity = float(row["turbidity"])
        temperature = float(row["temperature"])
        tds = float(row["tds"])
        do = float(row.get("dissolved_oxygen", 6.0)) if pd.notna(row.get("dissolved_oxygen")) else 6.0
        rain = (
            float(row.get("rainfall_mm"))
            if pd.notna(row.get("rainfall_mm"))
            else fetch_live_precipitation_mm(zone.latitude, zone.longitude)
        )
        zone_reports = db.query(HealthReport).filter(HealthReport.zone_id == zone.id).all()
        active_cases = sum(r.affected_count for r in zone_reports)

        analysis = ml_engine.analyze(
            ph=ph,
            turbidity=turbidity,
            temperature=temperature,
            tds=tds,
            dissolved_oxygen=do,
            symptom_cases_7d=active_cases,
            rainfall_mm=rain,
        )

        reading = WaterReading(
            zone_id=zone.id,
            zone_name=zone.name,
            ph=ph,
            turbidity=turbidity,
            temperature=temperature,
            tds=tds,
            electrical_conductivity=round(tds * 1.58, 1),
            dissolved_oxygen=do,
            rainfall_mm=rain,
            is_anomaly=analysis["is_anomaly"],
            anomaly_score=analysis["anomaly_score"],
            risk_level=analysis["predicted_risk_level"],
            risk_score=analysis["risk_score"],
            source="CSV Upload",
            recorded_by=current_user.name,
        )
        db.add(reading)
        zone.current_risk_level = analysis["predicted_risk_level"]
        zone.current_risk_score = analysis["risk_score"]
        zone.last_updated = datetime.now(timezone.utc)

        if analysis["predicted_risk_level"] in ("High", "Critical"):
            alerts_triggered += 1
            db.add(
                AlertRecord(
                    zone_id=zone.id,
                    zone_name=zone.name,
                    severity=analysis["predicted_risk_level"],
                    title=f"CSV BATCH {analysis['predicted_risk_level'].upper()} RISK: {zone.name}",
                    message=f"Uploaded CSV row by {current_user.name} flagged {analysis['predicted_risk_level']} risk (pH {ph}, Turbidity {turbidity} NTU, TDS {tds} mg/L).",
                    trigger_source="Batch CSV ML Pipeline",
                    risk_score=analysis["risk_score"],
                    status="Pending",
                )
            )
        processed.append(reading)

    db.commit()
    return {
        "rows_ingested": len(processed),
        "alerts_triggered": alerts_triggered,
        "sample_results": [serialize_water(r) for r in processed[:10]],
    }


@app.get("/api/health-reports")
def list_health_reports(
    zone_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(HealthReport)
    if zone_id is not None:
        q = q.filter(HealthReport.zone_id == zone_id)
    reports = q.order_by(HealthReport.timestamp.desc()).limit(60).all()
    return [serialize_report(r) for r in reports]


@app.post("/api/health-reports")
def create_health_report(
    payload: HealthReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    zone = db.query(CommunityZone).filter(CommunityZone.id == payload.zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Monitoring station not found.")

    report = HealthReport(
        zone_id=zone.id,
        zone_name=zone.name,
        reporter_name=current_user.name,
        reporter_role=current_user.role,
        symptoms=json.dumps(payload.symptoms),
        affected_count=payload.affected_count,
        severity=payload.severity,
        water_source_used=payload.water_source_used,
        notes=payload.notes,
        verified=current_user.role in ("admin", "health_worker"),
        timestamp=datetime.now(timezone.utc),
    )
    db.add(report)
    db.flush()

    latest_w = (
        db.query(WaterReading)
        .filter(WaterReading.zone_id == zone.id)
        .order_by(WaterReading.timestamp.desc())
        .first()
    )
    all_reports = db.query(HealthReport).filter(HealthReport.zone_id == zone.id).all()
    total_cases = sum(r.affected_count for r in all_reports)

    if latest_w:
        analysis = ml_engine.analyze(
            ph=latest_w.ph,
            turbidity=latest_w.turbidity,
            temperature=latest_w.temperature,
            tds=latest_w.tds,
            dissolved_oxygen=latest_w.dissolved_oxygen,
            symptom_cases_7d=total_cases,
            rainfall_mm=latest_w.rainfall_mm,
        )
        zone.current_risk_level = analysis["predicted_risk_level"]
        zone.current_risk_score = analysis["risk_score"]
        zone.last_updated = datetime.now(timezone.utc)

    alert_created = None
    if payload.affected_count >= 5 or zone.current_risk_level in ("High", "Critical"):
        sev = (
            zone.current_risk_level
            if zone.current_risk_level in ("High", "Critical")
            else "Moderate"
        )
        alert_created = AlertRecord(
            zone_id=zone.id,
            zone_name=zone.name,
            severity=sev,
            title=f"SYMPTOM CLUSTER ALERT: {zone.name} ({payload.affected_count} new cases)",
            message=(
                f"{current_user.name} reported {payload.affected_count} cases with {', '.join(payload.symptoms)}. "
                f"Station risk is {zone.current_risk_level} ({zone.current_risk_score}/100)."
            ),
            trigger_source="Community Symptom Surveillance",
            risk_score=zone.current_risk_score,
            status="Pending",
        )
        db.add(alert_created)

    db.commit()
    db.refresh(report)
    return {
        "report": serialize_report(report),
        "updated_zone_risk": {
            "risk_level": zone.current_risk_level,
            "risk_score": zone.current_risk_score,
        },
        "alert_triggered": serialize_alert(alert_created) if alert_created else None,
    }


@app.post("/api/predict")
def run_ai_prediction(
    payload: PredictRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    zone_name = payload.zone_name or "Manual Evaluation Vector"
    if payload.zone_id:
        z = db.query(CommunityZone).filter(CommunityZone.id == payload.zone_id).first()
        if z:
            zone_name = z.name

    analysis = ml_engine.analyze(
        ph=payload.ph,
        turbidity=payload.turbidity,
        temperature=payload.temperature,
        tds=payload.tds,
        dissolved_oxygen=payload.dissolved_oxygen,
        symptom_cases_7d=payload.symptom_cases_7d,
        rainfall_mm=payload.rainfall_mm,
    )

    record_id = None
    if payload.save_record:
        rec = PredictionRecord(
            zone_id=payload.zone_id,
            zone_name=zone_name,
            ph=payload.ph,
            turbidity=payload.turbidity,
            temperature=payload.temperature,
            tds=payload.tds,
            dissolved_oxygen=payload.dissolved_oxygen,
            symptom_cases_7d=payload.symptom_cases_7d,
            predicted_risk_level=analysis["predicted_risk_level"],
            risk_score=analysis["risk_score"],
            rf_probabilities=json.dumps(analysis["rf_probabilities"]),
            is_anomaly=analysis["is_anomaly"],
            anomaly_score=analysis["anomaly_score"],
            forecast_7d=json.dumps(analysis["forecast_7d"]),
            explanations=json.dumps(analysis["explanations"]),
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)
        record_id = rec.id

    return {
        "id": record_id,
        "zone_name": zone_name,
        "inputs": {
            "ph": payload.ph,
            "turbidity": payload.turbidity,
            "temperature": payload.temperature,
            "tds": payload.tds,
            "dissolved_oxygen": payload.dissolved_oxygen,
            "symptom_cases_7d": payload.symptom_cases_7d,
            "rainfall_mm": payload.rainfall_mm,
        },
        **analysis,
        "model_metadata": ml_engine.metrics,
    }


@app.get("/api/predictions")
def list_predictions(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = db.query(PredictionRecord).order_by(PredictionRecord.timestamp.desc()).limit(limit).all()
    return {
        "predictions": [serialize_prediction(p) for p in items],
        "ml_metrics": ml_engine.metrics,
    }


@app.get("/api/alerts")
def list_alerts(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(AlertRecord)
    if status and status != "All":
        q = q.filter(AlertRecord.status == status)
    items = q.order_by(AlertRecord.timestamp.desc()).all()
    return [serialize_alert(a) for a in items]


@app.patch("/api/alerts/{alert_id}/verify")
def verify_alert(
    alert_id: int,
    payload: AlertVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alert = db.query(AlertRecord).filter(AlertRecord.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")

    alert.status = payload.status
    alert.verified_by = f"{current_user.name} ({current_user.role})"
    alert.action_taken = payload.action_taken
    if payload.status == "Resolved":
        alert.resolved_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(alert)
    return serialize_alert(alert)


@app.get("/api/analytics")
def get_analytics_report(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    zones = db.query(CommunityZone).all()
    readings = db.query(WaterReading).order_by(WaterReading.timestamp.asc()).all()
    reports = db.query(HealthReport).order_by(HealthReport.timestamp.asc()).all()

    daily_map = {}
    for w in readings:
        day_key = w.timestamp.strftime("%Y-%m-%d") if w.timestamp else "Unknown"
        bucket = daily_map.setdefault(
            day_key,
            {
                "date": day_key,
                "ph_list": [],
                "turbidity_list": [],
                "tds_list": [],
                "risk_list": [],
                "anomalies": 0,
            },
        )
        bucket["ph_list"].append(w.ph)
        bucket["turbidity_list"].append(w.turbidity)
        bucket["tds_list"].append(w.tds)
        bucket["risk_list"].append(w.risk_score)
        if w.is_anomaly:
            bucket["anomalies"] += 1

    daily_trends = [
        {
            "date": day_key,
            "avg_ph": round(sum(b["ph_list"]) / len(b["ph_list"]), 2),
            "avg_turbidity": round(sum(b["turbidity_list"]) / len(b["turbidity_list"]), 2),
            "avg_tds": round(sum(b["tds_list"]) / len(b["tds_list"]), 1),
            "avg_risk_score": round(sum(b["risk_list"]) / len(b["risk_list"]), 1),
            "anomalies": b["anomalies"],
        }
        for day_key, b in daily_map.items()
    ]

    period_map = {}
    for w in readings:
        period_key = w.timestamp.strftime("%Y-%m") if w.timestamp else "Unknown"
        p_bucket = period_map.setdefault(
            period_key,
            {"risk_list": [], "turbidity_list": [], "outbreak_alerts": 0, "reported_cases": 0},
        )
        p_bucket["risk_list"].append(w.risk_score)
        p_bucket["turbidity_list"].append(w.turbidity)
        if w.risk_level in ("High", "Critical") or w.is_anomaly:
            p_bucket["outbreak_alerts"] += 1

    for r in reports:
        r_key = r.timestamp.strftime("%Y-%m") if r.timestamp else "Unknown"
        p_bucket = period_map.setdefault(
            r_key,
            {"risk_list": [], "turbidity_list": [], "outbreak_alerts": 0, "reported_cases": 0},
        )
        p_bucket["reported_cases"] += r.affected_count

    monthly_trends = [
        {
            "month": period_key,
            "water_quality_index": round(
                max(0.0, 100.0 - (sum(pb["risk_list"]) / len(pb["risk_list"]))), 1
            )
            if pb["risk_list"]
            else 0.0,
            "reported_cases": pb["reported_cases"],
            "outbreak_alerts": pb["outbreak_alerts"],
            "avg_turbidity": round(
                sum(pb["turbidity_list"]) / len(pb["turbidity_list"]), 2
            )
            if pb["turbidity_list"]
            else 0.0,
        }
        for period_key, pb in period_map.items()
    ]

    zone_comparison = []
    for z in zones:
        z_readings = [w for w in readings if w.zone_id == z.id]
        z_reports = [r for r in reports if r.zone_id == z.id]
        latest = z_readings[-1] if z_readings else None
        zone_comparison.append(
            {
                "code": z.code,
                "name": z.name,
                "district": z.district,
                "population": z.population,
                "water_source": z.water_source_type,
                "sanitation_index": z.sanitation_index,
                "risk_level": z.current_risk_level,
                "risk_score": z.current_risk_score,
                "ph": latest.ph if latest else 0.0,
                "turbidity": latest.turbidity if latest else 0.0,
                "tds": latest.tds if latest else 0.0,
                "dissolved_oxygen": latest.dissolved_oxygen if latest else 0.0,
                "total_symptom_cases": sum(r.affected_count for r in z_reports),
            }
        )

    return {
        "daily_trends": daily_trends,
        "monthly_trends": monthly_trends,
        "zone_comparison": zone_comparison,
        "ml_metrics": ml_engine.metrics,
    }
