import json
import os
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from sqlalchemy import event
from sqlalchemy.orm import Session

from models import (
    AlertRecord,
    CommunityZone,
    HealthReport,
    PredictionRecord,
    User,
    WaterReading,
)


def _load_dotenv_if_present() -> None:
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


_load_dotenv_if_present()

SUPABASE_PROJECT_ID = os.getenv("SUPABASE_PROJECT_ID", "mmgmgjtcyugfflbmzwac")
SUPABASE_URL = os.getenv(
    "SUPABASE_URL", f"https://{SUPABASE_PROJECT_ID}.supabase.co"
).rstrip("/")
SUPABASE_KEY = os.getenv(
    "SUPABASE_PUBLISHABLE_KEY", "sb_publishable_AHV9HsfPNuvD_vX1a1R6Zw_TaSMaXlO"
)

_REALTIME_ENABLED = False


def _iso(dt: Any) -> Any:
    if isinstance(dt, datetime):
        return dt.isoformat()
    return dt


def _parse_dt(val: Any) -> Any:
    if not val or isinstance(val, datetime):
        return val
    try:
        return datetime.fromisoformat(str(val).replace("Z", "+00:00"))
    except Exception:
        return datetime.now(timezone.utc)


def _model_to_payload(obj: Any) -> Dict[str, Any]:
    if isinstance(obj, User):
        return {
            "id": obj.id,
            "name": obj.name,
            "email": obj.email,
            "password_hash": obj.password_hash,
            "role": obj.role,
            "assigned_zone": obj.assigned_zone,
            "phone": obj.phone,
            "created_at": _iso(obj.created_at),
        }
    if isinstance(obj, CommunityZone):
        return {
            "id": obj.id,
            "code": obj.code,
            "name": obj.name,
            "district": obj.district,
            "latitude": obj.latitude,
            "longitude": obj.longitude,
            "population": obj.population,
            "water_source_type": obj.water_source_type,
            "sanitation_index": obj.sanitation_index,
            "current_risk_level": obj.current_risk_level,
            "current_risk_score": obj.current_risk_score,
            "last_updated": _iso(obj.last_updated),
        }
    if isinstance(obj, WaterReading):
        return {
            "id": obj.id,
            "zone_id": obj.zone_id,
            "zone_name": obj.zone_name,
            "ph": obj.ph,
            "turbidity": obj.turbidity,
            "temperature": obj.temperature,
            "tds": obj.tds,
            "electrical_conductivity": obj.electrical_conductivity,
            "dissolved_oxygen": obj.dissolved_oxygen,
            "rainfall_mm": obj.rainfall_mm,
            "is_anomaly": bool(obj.is_anomaly),
            "anomaly_score": obj.anomaly_score,
            "risk_level": obj.risk_level,
            "risk_score": obj.risk_score,
            "source": obj.source,
            "recorded_by": obj.recorded_by,
            "timestamp": _iso(obj.timestamp),
        }
    if isinstance(obj, HealthReport):
        return {
            "id": obj.id,
            "zone_id": obj.zone_id,
            "zone_name": obj.zone_name,
            "reporter_name": obj.reporter_name,
            "reporter_role": obj.reporter_role,
            "symptoms": obj.symptoms,
            "affected_count": obj.affected_count,
            "severity": obj.severity,
            "water_source_used": obj.water_source_used,
            "notes": obj.notes,
            "verified": bool(obj.verified),
            "timestamp": _iso(obj.timestamp),
        }
    if isinstance(obj, PredictionRecord):
        return {
            "id": obj.id,
            "zone_id": obj.zone_id,
            "zone_name": obj.zone_name,
            "ph": obj.ph,
            "turbidity": obj.turbidity,
            "temperature": obj.temperature,
            "tds": obj.tds,
            "dissolved_oxygen": obj.dissolved_oxygen,
            "symptom_cases_7d": obj.symptom_cases_7d,
            "predicted_risk_level": obj.predicted_risk_level,
            "risk_score": obj.risk_score,
            "rf_probabilities": obj.rf_probabilities,
            "is_anomaly": bool(obj.is_anomaly),
            "anomaly_score": obj.anomaly_score,
            "forecast_7d": obj.forecast_7d,
            "explanations": obj.explanations,
            "timestamp": _iso(obj.timestamp),
        }
    if isinstance(obj, AlertRecord):
        return {
            "id": obj.id,
            "zone_id": obj.zone_id,
            "zone_name": obj.zone_name,
            "severity": obj.severity,
            "title": obj.title,
            "message": obj.message,
            "trigger_source": obj.trigger_source,
            "risk_score": obj.risk_score,
            "status": obj.status,
            "verified_by": obj.verified_by,
            "action_taken": obj.action_taken,
            "timestamp": _iso(obj.timestamp),
            "resolved_at": _iso(obj.resolved_at),
        }
    return {}


def fetch_from_supabase(table_name: str) -> List[Dict[str, Any]]:
    if not SUPABASE_URL or not SUPABASE_KEY:
        return []
    url = f"{SUPABASE_URL}/rest/v1/{table_name}?select=*&order=id.asc"
    req = urllib.request.Request(
        url,
        headers={
            "apikey": SUPABASE_KEY,
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return []


def upsert_to_supabase(table_name: str, rows: List[Dict[str, Any]], on_conflict: str = "id") -> bool:
    if not rows or not SUPABASE_URL or not SUPABASE_KEY:
        return False
    url = f"{SUPABASE_URL}/rest/v1/{table_name}?on_conflict={on_conflict}"
    body = json.dumps(rows).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "apikey": SUPABASE_KEY,
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return 200 <= resp.status < 300
    except Exception as exc:
        print(f"[Supabase Sync] Warning upserting to {table_name}: {exc}")
        return False


def sync_all_to_supabase(db: Session) -> Dict[str, int]:
    """Synchronizes state between Supabase Postgres and local SQLAlchemy session."""
    global _REALTIME_ENABLED
    _REALTIME_ENABLED = False

    # Pull existing rows from Supabase if local tables are empty
    if db.query(User).count() == 0:
        for row in fetch_from_supabase("sch_users"):
            db.add(
                User(
                    id=row["id"],
                    name=row["name"],
                    email=row["email"],
                    password_hash=row["password_hash"],
                    role=row.get("role", "community_user"),
                    assigned_zone=row.get("assigned_zone"),
                    phone=row.get("phone"),
                    created_at=_parse_dt(row.get("created_at")),
                )
            )
        db.commit()

    if db.query(CommunityZone).count() == 0:
        for row in fetch_from_supabase("community_zones"):
            db.add(
                CommunityZone(
                    id=row["id"],
                    code=row["code"],
                    name=row["name"],
                    district=row["district"],
                    latitude=row["latitude"],
                    longitude=row["longitude"],
                    population=row.get("population", 0),
                    water_source_type=row["water_source_type"],
                    sanitation_index=row.get("sanitation_index", 0.0),
                    current_risk_level=row.get("current_risk_level", "Low"),
                    current_risk_score=row.get("current_risk_score", 0.0),
                    last_updated=_parse_dt(row.get("last_updated")),
                )
            )
        db.commit()

    if db.query(WaterReading).count() == 0:
        for row in fetch_from_supabase("water_readings"):
            db.add(
                WaterReading(
                    id=row["id"],
                    zone_id=row["zone_id"],
                    zone_name=row["zone_name"],
                    ph=row["ph"],
                    turbidity=row["turbidity"],
                    temperature=row["temperature"],
                    tds=row["tds"],
                    electrical_conductivity=row["electrical_conductivity"],
                    dissolved_oxygen=row["dissolved_oxygen"],
                    rainfall_mm=row.get("rainfall_mm", 0.0),
                    is_anomaly=bool(row.get("is_anomaly", False)),
                    anomaly_score=row.get("anomaly_score", 0.0),
                    risk_level=row.get("risk_level", "Low"),
                    risk_score=row.get("risk_score", 0.0),
                    source=row.get("source", "Field Telemetry"),
                    recorded_by=row.get("recorded_by", "Operator"),
                    timestamp=_parse_dt(row.get("timestamp")),
                )
            )
        db.commit()

    if db.query(HealthReport).count() == 0:
        for row in fetch_from_supabase("health_reports"):
            db.add(
                HealthReport(
                    id=row["id"],
                    zone_id=row["zone_id"],
                    zone_name=row["zone_name"],
                    reporter_name=row["reporter_name"],
                    reporter_role=row.get("reporter_role", "community_user"),
                    symptoms=row["symptoms"],
                    affected_count=row.get("affected_count", 1),
                    severity=row.get("severity", "Moderate"),
                    water_source_used=row.get("water_source_used", "Surface Water"),
                    notes=row.get("notes"),
                    verified=bool(row.get("verified", False)),
                    timestamp=_parse_dt(row.get("timestamp")),
                )
            )
        db.commit()

    if db.query(PredictionRecord).count() == 0:
        for row in fetch_from_supabase("prediction_records"):
            db.add(
                PredictionRecord(
                    id=row["id"],
                    zone_id=row.get("zone_id"),
                    zone_name=row["zone_name"],
                    ph=row["ph"],
                    turbidity=row["turbidity"],
                    temperature=row["temperature"],
                    tds=row["tds"],
                    dissolved_oxygen=row["dissolved_oxygen"],
                    symptom_cases_7d=row.get("symptom_cases_7d", 0),
                    predicted_risk_level=row["predicted_risk_level"],
                    risk_score=row["risk_score"],
                    rf_probabilities=row["rf_probabilities"],
                    is_anomaly=bool(row.get("is_anomaly", False)),
                    anomaly_score=row.get("anomaly_score", 0.0),
                    forecast_7d=row["forecast_7d"],
                    explanations=row["explanations"],
                    timestamp=_parse_dt(row.get("timestamp")),
                )
            )
        db.commit()

    if db.query(AlertRecord).count() == 0:
        for row in fetch_from_supabase("alert_records"):
            db.add(
                AlertRecord(
                    id=row["id"],
                    zone_id=row["zone_id"],
                    zone_name=row["zone_name"],
                    severity=row["severity"],
                    title=row["title"],
                    message=row["message"],
                    trigger_source=row.get("trigger_source", "AI Prediction"),
                    risk_score=row.get("risk_score", 0.0),
                    status=row.get("status", "Pending"),
                    verified_by=row.get("verified_by"),
                    action_taken=row.get("action_taken"),
                    timestamp=_parse_dt(row.get("timestamp")),
                    resolved_at=_parse_dt(row.get("resolved_at")) if row.get("resolved_at") else None,
                )
            )
        db.commit()

    table_counts: Dict[str, int] = {}
    mappings = [
        ("sch_users", User, "email"),
        ("community_zones", CommunityZone, "code"),
        ("water_readings", WaterReading, "id"),
        ("health_reports", HealthReport, "id"),
        ("prediction_records", PredictionRecord, "id"),
        ("alert_records", AlertRecord, "id"),
    ]
    for table_name, model_cls, conflict_col in mappings:
        records = db.query(model_cls).all()
        payloads = [_model_to_payload(r) for r in records if r.id is not None]
        if payloads:
            upsert_to_supabase(table_name, payloads, on_conflict=conflict_col)
        table_counts[table_name] = len(payloads)

    _REALTIME_ENABLED = True
    return table_counts


def _on_after_change(_mapper: Any, _connection: Any, target: Any) -> None:
    if not _REALTIME_ENABLED:
        return
    table_name = getattr(target, "__tablename__", None)
    if not table_name:
        return
    payload = _model_to_payload(target)
    if payload and payload.get("id") is not None:
        conflict_col = "email" if table_name == "sch_users" else ("code" if table_name == "community_zones" else "id")
        upsert_to_supabase(table_name, [payload], on_conflict=conflict_col)


for _cls in (User, CommunityZone, WaterReading, HealthReport, PredictionRecord, AlertRecord):
    event.listen(_cls, "after_insert", _on_after_change)
    event.listen(_cls, "after_update", _on_after_change)
