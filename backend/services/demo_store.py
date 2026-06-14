from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from math import atan2, cos, radians, sin, sqrt
from uuid import uuid4

HOSPITALS = [
    {
        "id": "victoria",
        "name": "Victoria Hospital",
        "short_name": "Victoria",
        "address": "Fort Rd, Krishna Rajendra Market, Bengaluru",
        "lat": 12.9667,
        "lng": 77.5760,
        "zone": "Central",
        "tier": 1,
        "has_trauma_center": True,
        "has_icu": True,
        "has_ventilators": True,
        "has_blood_bank": True,
        "has_cath_lab": False,
        "has_burn_unit": True,
        "has_nicu": True,
        "specialties": ["trauma", "general_surgery", "orthopedics"],
        "total_er_beds": 40,
        "total_icu_beds": 12,
        "total_ventilators": 8,
        "available_er_beds": 2,
        "available_icu_beds": 0,
        "available_ventilators": 0,
        "doctors_on_duty": 3,
        "er_status": "overwhelmed",
        "wait_time_minutes": 185,
        "patients_in_queue": 47,
        "load_percentage": 96.0,
        "intake_rate_per_hour": 11,
        "blood_o_neg": False,
    },
    {
        "id": "manipal",
        "name": "Manipal Hospital (Old Airport Road)",
        "short_name": "Manipal",
        "address": "98, HAL Airport Rd, Kodihalli, Bengaluru",
        "lat": 12.9591,
        "lng": 77.6479,
        "zone": "East",
        "tier": 1,
        "has_trauma_center": True,
        "has_icu": True,
        "has_ventilators": True,
        "has_blood_bank": True,
        "has_cath_lab": True,
        "has_burn_unit": False,
        "has_nicu": True,
        "specialties": ["cardiology", "neurology", "oncology", "trauma"],
        "total_er_beds": 30,
        "total_icu_beds": 20,
        "total_ventilators": 15,
        "available_er_beds": 6,
        "available_icu_beds": 4,
        "available_ventilators": 3,
        "doctors_on_duty": 5,
        "er_status": "open",
        "wait_time_minutes": 15,
        "patients_in_queue": 14,
        "load_percentage": 45.0,
        "intake_rate_per_hour": 8,
        "blood_o_neg": True,
    },
    {
        "id": "st-johns",
        "name": "St. John's Medical College Hospital",
        "short_name": "St. Johns",
        "address": "Sarjapur Rd, John Nagar, Koramangala, Bengaluru",
        "lat": 12.9254,
        "lng": 77.6228,
        "zone": "South",
        "tier": 1,
        "has_trauma_center": True,
        "has_icu": True,
        "has_ventilators": True,
        "has_blood_bank": True,
        "has_cath_lab": True,
        "has_burn_unit": False,
        "has_nicu": True,
        "specialties": ["cardiology", "neurology", "pediatrics", "obstetrics"],
        "total_er_beds": 35,
        "total_icu_beds": 18,
        "total_ventilators": 12,
        "available_er_beds": 3,
        "available_icu_beds": 2,
        "available_ventilators": 2,
        "doctors_on_duty": 4,
        "er_status": "caution",
        "wait_time_minutes": 50,
        "patients_in_queue": 24,
        "load_percentage": 72.0,
        "intake_rate_per_hour": 7,
        "blood_o_neg": True,
    },
    {
        "id": "ramaiah",
        "name": "MS Ramaiah Memorial Hospital",
        "short_name": "Ramaiah",
        "address": "MSR Nagar, Mathikere, Bengaluru",
        "lat": 13.0195,
        "lng": 77.5637,
        "zone": "North",
        "tier": 1,
        "has_trauma_center": True,
        "has_icu": True,
        "has_ventilators": True,
        "has_blood_bank": True,
        "has_cath_lab": True,
        "has_burn_unit": False,
        "has_nicu": True,
        "specialties": ["trauma", "cardiology", "orthopedics", "neurosurgery"],
        "total_er_beds": 28,
        "total_icu_beds": 16,
        "total_ventilators": 10,
        "available_er_beds": 9,
        "available_icu_beds": 5,
        "available_ventilators": 4,
        "doctors_on_duty": 5,
        "er_status": "open",
        "wait_time_minutes": 28,
        "patients_in_queue": 15,
        "load_percentage": 55.0,
        "intake_rate_per_hour": 6,
        "blood_o_neg": True,
    },
    {
        "id": "fortis-bannerghatta",
        "name": "Fortis Hospital Bannerghatta Road",
        "short_name": "Fortis",
        "address": "Bannerghatta Rd, Bengaluru",
        "lat": 12.8912,
        "lng": 77.5975,
        "zone": "South",
        "tier": 1,
        "has_trauma_center": False,
        "has_icu": True,
        "has_ventilators": True,
        "has_blood_bank": True,
        "has_cath_lab": True,
        "has_burn_unit": False,
        "has_nicu": False,
        "specialties": ["cardiology", "oncology", "orthopedics"],
        "total_er_beds": 20,
        "total_icu_beds": 14,
        "total_ventilators": 8,
        "available_er_beds": 8,
        "available_icu_beds": 4,
        "available_ventilators": 3,
        "doctors_on_duty": 4,
        "er_status": "open",
        "wait_time_minutes": 18,
        "patients_in_queue": 8,
        "load_percentage": 40.0,
        "intake_rate_per_hour": 5,
        "blood_o_neg": True,
    },
    {
        "id": "narayana-health-city",
        "name": "Narayana Health City",
        "short_name": "Narayana",
        "address": "Bommasandra Industrial Area, Anekal Taluk, Bengaluru",
        "lat": 12.8340,
        "lng": 77.6680,
        "zone": "South East",
        "tier": 1,
        "has_trauma_center": True,
        "has_icu": True,
        "has_ventilators": True,
        "has_blood_bank": True,
        "has_cath_lab": True,
        "has_burn_unit": False,
        "has_nicu": True,
        "specialties": ["cardiology", "cardiac_surgery", "pediatric_cardiac"],
        "total_er_beds": 25,
        "total_icu_beds": 22,
        "total_ventilators": 16,
        "available_er_beds": 7,
        "available_icu_beds": 5,
        "available_ventilators": 4,
        "doctors_on_duty": 5,
        "er_status": "open",
        "wait_time_minutes": 24,
        "patients_in_queue": 12,
        "load_percentage": 50.0,
        "intake_rate_per_hour": 5,
        "blood_o_neg": True,
    },
    {
        "id": "bowring",
        "name": "Bowring & Lady Curzon Hospital",
        "short_name": "Bowring",
        "address": "Shivaji Nagar, Bengaluru",
        "lat": 12.9800,
        "lng": 77.6050,
        "zone": "Central",
        "tier": 2,
        "has_trauma_center": False,
        "has_icu": True,
        "has_ventilators": True,
        "has_blood_bank": True,
        "has_cath_lab": False,
        "has_burn_unit": False,
        "has_nicu": False,
        "specialties": ["general_medicine", "general_surgery"],
        "total_er_beds": 22,
        "total_icu_beds": 8,
        "total_ventilators": 4,
        "available_er_beds": 4,
        "available_icu_beds": 1,
        "available_ventilators": 1,
        "doctors_on_duty": 3,
        "er_status": "caution",
        "wait_time_minutes": 82,
        "patients_in_queue": 16,
        "load_percentage": 75.0,
        "intake_rate_per_hour": 6,
        "blood_o_neg": False,
    },
    {
        "id": "sparsh-infantry",
        "name": "Sparsh Hospital (Infantry Road)",
        "short_name": "Sparsh",
        "address": "Infantry Road, Bengaluru",
        "lat": 12.9831,
        "lng": 77.5968,
        "zone": "Central",
        "tier": 2,
        "has_trauma_center": True,
        "has_icu": True,
        "has_ventilators": True,
        "has_blood_bank": False,
        "has_cath_lab": False,
        "has_burn_unit": False,
        "has_nicu": False,
        "specialties": ["trauma", "orthopedics", "spine"],
        "total_er_beds": 18,
        "total_icu_beds": 10,
        "total_ventilators": 6,
        "available_er_beds": 7,
        "available_icu_beds": 3,
        "available_ventilators": 2,
        "doctors_on_duty": 4,
        "er_status": "open",
        "wait_time_minutes": 20,
        "patients_in_queue": 9,
        "load_percentage": 50.0,
        "intake_rate_per_hour": 4,
        "blood_o_neg": False,
    },
    {
        "id": "sakra",
        "name": "Sakra World Hospital",
        "short_name": "Sakra",
        "address": "Devarabeesanahalli, Bengaluru",
        "lat": 12.9361,
        "lng": 77.6959,
        "zone": "East",
        "tier": 1,
        "has_trauma_center": True,
        "has_icu": True,
        "has_ventilators": True,
        "has_blood_bank": True,
        "has_cath_lab": True,
        "has_burn_unit": False,
        "has_nicu": True,
        "specialties": ["neurology", "neurosurgery", "stroke", "orthopedics"],
        "total_er_beds": 22,
        "total_icu_beds": 12,
        "total_ventilators": 8,
        "available_er_beds": 8,
        "available_icu_beds": 4,
        "available_ventilators": 3,
        "doctors_on_duty": 5,
        "er_status": "open",
        "wait_time_minutes": 16,
        "patients_in_queue": 10,
        "load_percentage": 45.0,
        "intake_rate_per_hour": 5,
        "blood_o_neg": True,
    },
    {
        "id": "kidwai",
        "name": "Kidwai Memorial Institute of Oncology",
        "short_name": "Kidwai",
        "address": "Dr M H Marigowda Road, Bengaluru",
        "lat": 12.9342,
        "lng": 77.5850,
        "zone": "South Central",
        "tier": 2,
        "has_trauma_center": False,
        "has_icu": True,
        "has_ventilators": True,
        "has_blood_bank": True,
        "has_cath_lab": False,
        "has_burn_unit": False,
        "has_nicu": False,
        "specialties": ["oncology", "hematology", "palliative"],
        "total_er_beds": 15,
        "total_icu_beds": 8,
        "total_ventilators": 4,
        "available_er_beds": 9,
        "available_icu_beds": 3,
        "available_ventilators": 2,
        "doctors_on_duty": 3,
        "er_status": "open",
        "wait_time_minutes": 12,
        "patients_in_queue": 5,
        "load_percentage": 35.0,
        "intake_rate_per_hour": 3,
        "blood_o_neg": True,
    },
]

DEFAULT_HOSPITALS = deepcopy(HOSPITALS)

INCIDENTS: list[dict] = []
ROUTE_DECISIONS: list[dict] = []
ALERTS: list[dict] = []

def reset_store():
    global HOSPITALS
    HOSPITALS.clear()
    HOSPITALS.extend(deepcopy(DEFAULT_HOSPITALS))
    INCIDENTS.clear()
    ROUTE_DECISIONS.clear()
    ALERTS.clear()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def list_hospitals() -> list[dict]:
    return deepcopy(HOSPITALS)


def get_hospital(hospital_id: str) -> dict | None:
    return next((deepcopy(h) for h in HOSPITALS if h["id"] == hospital_id), None)


def update_capacity(hospital_id: str, payload: dict) -> dict:
    hospital = next((h for h in HOSPITALS if h["id"] == hospital_id), None)
    if not hospital:
        raise KeyError(hospital_id)
    hospital.update(payload)
    hospital["snapshot_age_seconds"] = 0
    hospital["recorded_at"] = _now()
    return deepcopy(hospital)


def create_incident(payload: dict, recommendations: list[dict]) -> dict:
    rank_one = recommendations[0] if recommendations else {}
    incident = {
        "id": str(uuid4()),
        "created_at": _now(),
        "updated_at": _now(),
        **payload,
        "recommended_hospital_id": rank_one.get("hospital_id"),
        "final_hospital_id": None,
        "gemini_reasoning": rank_one.get("reasoning"),
        "gemini_confidence": rank_one.get("confidence"),
        "estimated_eta_min": rank_one.get("eta_minutes"),
        "distance_km": rank_one.get("distance_km"),
        "status": "dispatched",
    }
    INCIDENTS.insert(0, incident)
    for rec in recommendations:
        ROUTE_DECISIONS.insert(0, {"incident_id": incident["id"], **rec})
    return deepcopy(incident)


def confirm_incident(incident_id: str, hospital_id: str, override: bool) -> dict:
    incident = next((i for i in INCIDENTS if i["id"] == incident_id), None)
    if not incident:
        raise KeyError(incident_id)
    incident["final_hospital_id"] = hospital_id
    incident["dispatcher_override"] = override
    incident["status"] = "en_route"
    incident["updated_at"] = _now()
    return deepcopy(incident)


def list_incidents() -> list[dict]:
    return deepcopy(INCIDENTS[:10])


def list_alerts() -> list[dict]:
    return deepcopy([a for a in ALERTS if not a.get("acknowledged")])


def create_alert(payload: dict) -> dict:
    alert = {"id": str(uuid4()), "created_at": _now(), "acknowledged": False, **payload}
    ALERTS.insert(0, alert)
    return deepcopy(alert)


def acknowledge_alert(alert_id: str, dispatcher_id: str) -> dict:
    alert = next((a for a in ALERTS if a["id"] == alert_id), None)
    if not alert:
        raise KeyError(alert_id)
    alert["acknowledged"] = True
    alert["acknowledged_by"] = dispatcher_id
    alert["acknowledged_at"] = _now()
    return deepcopy(alert)


def distance_km(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    radius = 6371.0
    d_lat = radians(b_lat - a_lat)
    d_lng = radians(b_lng - a_lng)
    lat1 = radians(a_lat)
    lat2 = radians(b_lat)
    x = sin(d_lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(d_lng / 2) ** 2
    return radius * 2 * atan2(sqrt(x), sqrt(1 - x))
