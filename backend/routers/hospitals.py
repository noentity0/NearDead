from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.db import queries

router = APIRouter()


def dump_model(model: BaseModel) -> dict:
    if hasattr(model, "model_dump"):
        return model.model_dump(exclude_none=True)
    return model.dict(exclude_none=True)


class CapacityUpdate(BaseModel):
    available_er_beds: int = Field(ge=0)
    available_icu_beds: int | None = Field(default=None, ge=0)
    available_ventilators: int | None = Field(default=None, ge=0)
    doctors_on_duty: int | None = Field(default=None, ge=0)
    nurses_on_duty: int | None = Field(default=None, ge=0)
    er_status: str
    wait_time_minutes: int | None = Field(default=None, ge=0)
    patients_in_queue: int | None = Field(default=None, ge=0)
    load_percentage: float | None = Field(default=None, ge=0, le=100)


@router.get("")
def list_hospitals():
    return queries.list_hospitals_with_capacity()


@router.get("/{hospital_id}")
def get_hospital(hospital_id: str):
    hospital = queries.get_hospital(hospital_id)
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
    return hospital


@router.post("/{hospital_id}/capacity")
def update_capacity(hospital_id: str, payload: CapacityUpdate):
    try:
        snapshot = queries.insert_capacity_snapshot(
            hospital_id,
            dump_model(payload),
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="Hospital not found") from None
    return {"snapshot": snapshot}
