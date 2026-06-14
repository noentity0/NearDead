import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.db import queries
from backend.services.capacity_filter import hard_filter, to_candidate, to_patient_context
from backend.services.ors_router import attach_routes
from services.gemini_agent import get_dispatch_recommendation

router = APIRouter()


def dump_model(model: BaseModel) -> dict:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


class DispatchRequest(BaseModel):
    caller_lat: float
    caller_lng: float
    caller_address: str | None = "Bengaluru"
    caller_phone: str | None = None
    condition_type: str
    condition_notes: str | None = ""
    is_critical: bool = False
    blood_type_needed: str | None = None
    patient_age: int | None = Field(default=None, ge=0)
    patient_gender: str | None = None
    dispatcher_id: str | None = "demo-dispatcher"


class ConfirmRequest(BaseModel):
    incident_id: str
    hospital_id: str
    dispatcher_override: bool = False


def _rec_to_dict(rec) -> dict:
    return {
        "rank": rec.rank,
        "hospital_id": rec.hospital_id,
        "hospital_name": rec.hospital_name,
        "eta_minutes": rec.eta_minutes,
        "distance_km": rec.distance_km,
        "confidence": rec.confidence,
        "reasoning": rec.reasoning,
        "disqualified": rec.disqualified,
        "disqualify_reason": rec.disqualify_reason,
        "source": rec.source,
    }


@router.post("/recommend")
async def recommend(payload: DispatchRequest):
    hospitals = queries.list_hospitals_with_capacity()
    if not hospitals:
        raise HTTPException(status_code=503, detail="No hospital capacity data available")

    payload_dict = dump_model(payload)
    patient = to_patient_context(payload_dict)
    candidates = [to_candidate(row) for row in hospitals]
    candidates = hard_filter(patient, candidates)
    routed_rows = attach_routes(
        payload.caller_lat,
        payload.caller_lng,
        [candidate.__dict__ for candidate in candidates],
    )
    candidates = [to_candidate(row) for row in routed_rows]

    recommendations, source = await get_dispatch_recommendation(
        patient=patient,
        candidates=candidates,
        gemini_api_key=os.environ.get("GEMINI_API_KEY", ""),
    )
    rec_payload = [_rec_to_dict(rec) for rec in recommendations]
    incident_payload = payload_dict
    incident = queries.create_incident(incident_payload, rec_payload)

    return {
        "incident_id": incident["id"],
        "source": source,
        "pipeline": {
            "total_hospitals": len(hospitals),
            "candidates_after_filter": len(candidates),
            "routing": "mapbox_directions_or_fallback",
            "decision": source,
        },
        "recommendations": rec_payload,
    }


@router.post("/confirm")
def confirm(payload: ConfirmRequest):
    try:
        incident = queries.confirm_incident(
            payload.incident_id,
            payload.hospital_id,
            payload.dispatcher_override,
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="Incident not found") from None
    return {
        "confirmed": True,
        "incident": incident,
        "eta_minutes": incident.get("estimated_eta_min"),
    }
