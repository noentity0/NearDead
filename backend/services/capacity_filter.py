from __future__ import annotations

from services.gemini_agent import HospitalCandidate, PatientContext


def to_patient_context(payload: dict) -> PatientContext:
    return PatientContext(
        condition_type=payload.get("condition_type", "other"),
        condition_notes=payload.get("condition_notes") or "",
        is_critical=bool(payload.get("is_critical", False)),
        patient_age=payload.get("patient_age"),
        patient_gender=payload.get("patient_gender"),
        blood_type_needed=payload.get("blood_type_needed"),
        caller_lat=float(payload["caller_lat"]),
        caller_lng=float(payload["caller_lng"]),
        caller_address=payload.get("caller_address") or "Bengaluru",
    )


def to_candidate(row: dict) -> HospitalCandidate:
    return HospitalCandidate(
        id=str(row["id"]),
        name=row["name"],
        short_name=row.get("short_name") or row["name"],
        lat=float(row["lat"]),
        lng=float(row["lng"]),
        zone=row.get("zone") or "Unknown",
        tier=int(row.get("tier") or 2),
        available_er_beds=int(row.get("available_er_beds") or 0),
        available_icu_beds=int(row.get("available_icu_beds") or 0),
        available_ventilators=int(row.get("available_ventilators") or 0),
        doctors_on_duty=int(row.get("doctors_on_duty") or 0),
        er_status=row.get("er_status") or "closed",
        wait_time_minutes=int(row.get("wait_time_minutes") or 999),
        load_percentage=float(row.get("load_percentage") or 100),
        has_icu=bool(row.get("has_icu")),
        has_trauma_center=bool(row.get("has_trauma_center")),
        has_ventilators=bool(row.get("has_ventilators")),
        has_blood_bank=bool(row.get("has_blood_bank")),
        has_cath_lab=bool(row.get("has_cath_lab")),
        has_burn_unit=bool(row.get("has_burn_unit")),
        has_nicu=bool(row.get("has_nicu")),
        specialties=row.get("specialties") or [],
        distance_km=float(row.get("distance_km") or 0),
        eta_minutes=int(row.get("eta_minutes") or 0),
    )


def hard_filter(patient: PatientContext, candidates: list[HospitalCandidate]) -> list[HospitalCandidate]:
    open_candidates = [h for h in candidates if h.er_status != "closed"]
    if not open_candidates:
        return candidates

    filtered = [h for h in open_candidates if h.er_status != "overwhelmed" and h.available_er_beds > 0]
    if not filtered:
        filtered = open_candidates

    condition = patient.condition_type
    if condition == "cardiac":
        cath_lab_matches = [h for h in filtered if h.has_cath_lab]
        matched = cath_lab_matches or [h for h in filtered if h.has_icu]
    elif condition == "stroke":
        matched = [h for h in filtered if h.has_icu or "neurology" in h.specialties or "stroke" in h.specialties]
    elif condition == "trauma":
        matched = [h for h in filtered if h.has_trauma_center]
        if patient.is_critical:
            blood_matched = [h for h in matched if h.has_blood_bank]
            matched = blood_matched or matched
    elif condition == "burn":
        matched = [h for h in filtered if h.has_burn_unit]
    elif condition == "pediatric" or (patient.patient_age is not None and patient.patient_age < 14):
        matched = [h for h in filtered if h.has_nicu or "pediatrics" in h.specialties]
    elif condition == "respiratory":
        matched = [h for h in filtered if h.has_ventilators and h.available_ventilators > 0]
    elif condition == "obstetric":
        matched = [h for h in filtered if "obstetrics" in h.specialties]
    else:
        matched = filtered

    return matched or filtered or open_candidates
