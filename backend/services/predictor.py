from __future__ import annotations


def build_alerts_for_hospitals(hospitals: list[dict]) -> list[dict]:
    alerts = []
    for hospital in hospitals:
        load = float(hospital.get("load_percentage") or 0)
        status = hospital.get("er_status")
        if load >= 95 or status == "overwhelmed":
            alerts.append(
                {
                    "hospital_id": hospital["id"],
                    "alert_type": "capacity_critical",
                    "confidence": 0.95,
                    "minutes_until": 0,
                    "message": f"{hospital['short_name']} is critically overloaded. Route non-critical cases away.",
                }
            )
        elif load >= 85:
            alerts.append(
                {
                    "hospital_id": hospital["id"],
                    "alert_type": "capacity_warning",
                    "confidence": 0.86,
                    "minutes_until": 75,
                    "message": f"{hospital['short_name']} likely to hit capacity in about 75 minutes.",
                }
            )
    return alerts

