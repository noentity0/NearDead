from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.db import queries

router = APIRouter()


class StressRequest(BaseModel):
    hospital_id: str
    severity: str = "high"


@router.post("/stress-event")
def stress_event(payload: StressRequest):
    load_by_severity = {"medium": 86.0, "high": 96.0, "critical": 99.0}
    load = load_by_severity.get(payload.severity, 96.0)
    try:
        snapshot = queries.insert_capacity_snapshot(
            payload.hospital_id,
            {
                "available_er_beds": 0 if load >= 95 else 2,
                "available_icu_beds": 0,
                "available_ventilators": 0,
                "doctors_on_duty": 2,
                "er_status": "overwhelmed" if load >= 95 else "caution",
                "wait_time_minutes": 185 if load >= 95 else 95,
                "patients_in_queue": 47,
                "load_percentage": load,
                "is_simulated": True,
            },
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="Hospital not found") from None

    alert = queries.create_prediction_alert(
        {
            "hospital_id": payload.hospital_id,
            "alert_type": "capacity_critical" if load >= 95 else "capacity_warning",
            "confidence": 0.95 if load >= 95 else 0.86,
            "minutes_until": 0 if load >= 95 else 75,
            "message": "Victoria approaching capacity. Pre-route critical cases to alternatives.",
        }
    )
    return {"snapshot": snapshot, "alert": alert}


@router.post("/reset")
def reset():
    queries.reset_db()
    return {"ok": True, "reset": True}

