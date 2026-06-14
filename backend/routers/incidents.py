from fastapi import APIRouter

from backend.db import queries

router = APIRouter()


@router.get("/active")
def active_incidents():
    return queries.list_active_incidents()

