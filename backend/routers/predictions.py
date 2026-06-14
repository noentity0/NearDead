from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.db import queries
from backend.services.predictor import build_alerts_for_hospitals

router = APIRouter()


class AcknowledgeRequest(BaseModel):
    dispatcher_id: str = "demo-dispatcher"


@router.get("/alerts")
def alerts():
    return queries.list_prediction_alerts()


@router.post("/run")
def run_prediction():
    hospitals = queries.list_hospitals_with_capacity()
    alerts = []
    for alert in build_alerts_for_hospitals(hospitals):
        alerts.append(queries.create_prediction_alert(alert))
    return {"created": len(alerts), "alerts": alerts}


@router.patch("/alerts/{alert_id}/acknowledge")
def acknowledge(alert_id: str, payload: AcknowledgeRequest):
    try:
        alert = queries.acknowledge_prediction_alert(alert_id, payload.dispatcher_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Alert not found") from None
    return {"acknowledged": True, "alert": alert}

