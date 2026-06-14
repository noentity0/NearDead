from __future__ import annotations

from backend.db.client import get_supabase
from backend.services import demo_store


def list_hospitals_with_capacity() -> list[dict]:
    supabase = get_supabase()
    if supabase is None:
        return demo_store.list_hospitals()
    result = supabase.rpc("get_hospital_current_status").execute()
    return result.data or []


def get_hospital(hospital_id: str) -> dict | None:
    supabase = get_supabase()
    if supabase is None:
        return demo_store.get_hospital(hospital_id)
    result = supabase.table("hospitals").select("*").eq("id", hospital_id).limit(1).execute()
    return result.data[0] if result.data else None


def insert_capacity_snapshot(hospital_id: str, payload: dict) -> dict:
    supabase = get_supabase()
    if supabase is None:
        return demo_store.update_capacity(hospital_id, payload)
    row = {"hospital_id": hospital_id, "recorded_by": "admin", **payload}
    result = supabase.table("capacity_snapshots").insert(row).execute()
    return result.data[0] if result.data else row


def create_incident(payload: dict, recommendations: list[dict]) -> dict:
    supabase = get_supabase()
    if supabase is None:
        return demo_store.create_incident(payload, recommendations)

    rank_one = recommendations[0] if recommendations else {}
    incident_row = {
        **payload,
        "recommended_hospital_id": rank_one.get("hospital_id"),
        "gemini_reasoning": rank_one.get("reasoning"),
        "gemini_confidence": rank_one.get("confidence"),
        "estimated_eta_min": rank_one.get("eta_minutes"),
        "distance_km": rank_one.get("distance_km"),
        "status": "dispatched",
    }
    incident = supabase.table("active_incidents").insert(incident_row).execute().data[0]

    decision_rows = []
    hospitals_by_id = {h["id"]: h for h in list_hospitals_with_capacity()}
    for rec in recommendations:
        h = hospitals_by_id.get(rec["hospital_id"], {})
        decision_rows.append(
            {
                "incident_id": incident["id"],
                "rank": rec["rank"],
                "hospital_id": rec["hospital_id"],
                "available_beds": h.get("available_er_beds"),
                "doctors_on_duty": h.get("doctors_on_duty"),
                "er_status": h.get("er_status"),
                "wait_time_min": h.get("wait_time_minutes"),
                "distance_km": rec["distance_km"],
                "eta_minutes": rec["eta_minutes"],
                "confidence_score": rec["confidence"],
                "reasoning": rec["reasoning"],
                "disqualified": rec.get("disqualified", False),
                "disqualify_reason": rec.get("disqualify_reason"),
            }
        )
    if decision_rows:
        supabase.table("route_decisions").insert(decision_rows).execute()
    return incident


def confirm_incident(incident_id: str, hospital_id: str, override: bool) -> dict:
    supabase = get_supabase()
    if supabase is None:
        return demo_store.confirm_incident(incident_id, hospital_id, override)
    result = (
        supabase.table("active_incidents")
        .update(
            {
                "final_hospital_id": hospital_id,
                "dispatcher_override": override,
                "status": "en_route",
            }
        )
        .eq("id", incident_id)
        .execute()
    )
    return result.data[0] if result.data else {}


def list_active_incidents() -> list[dict]:
    supabase = get_supabase()
    if supabase is None:
        return demo_store.list_incidents()
    result = (
        supabase.table("active_incidents")
        .select("*")
        .neq("status", "closed")
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )
    return result.data or []


def list_prediction_alerts() -> list[dict]:
    supabase = get_supabase()
    if supabase is None:
        return demo_store.list_alerts()
    result = (
        supabase.table("prediction_alerts")
        .select("*")
        .eq("acknowledged", False)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


def create_prediction_alert(payload: dict) -> dict:
    supabase = get_supabase()
    if supabase is None:
        return demo_store.create_alert(payload)
    result = supabase.table("prediction_alerts").insert(payload).execute()
    return result.data[0] if result.data else payload


def acknowledge_prediction_alert(alert_id: str, dispatcher_id: str) -> dict:
    supabase = get_supabase()
    if supabase is None:
        return demo_store.acknowledge_alert(alert_id, dispatcher_id)
    result = (
        supabase.table("prediction_alerts")
        .update(
            {
                "acknowledged": True,
                "acknowledged_by": dispatcher_id,
                "acknowledged_at": "now()",
            }
        )
        .eq("id", alert_id)
        .execute()
    )
    return result.data[0] if result.data else {}


def reset_db() -> None:
    supabase = get_supabase()
    if supabase is None:
        demo_store.reset_store()
        return

    # Clear active alerts, incidents (cascade handles route_decisions), and simulated snapshots
    try:
        supabase.table("prediction_alerts").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        supabase.table("active_incidents").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        supabase.table("capacity_snapshots").delete().eq("is_simulated", True).execute()
    except Exception as e:
        print(f"Warning during Supabase DB reset: {e}")

