from __future__ import annotations

import os
import urllib.parse
import urllib.request

from backend.services.demo_store import distance_km


def _fallback_route(caller_lat: float, caller_lng: float, hospital: dict) -> dict:
    distance = distance_km(caller_lat, caller_lng, float(hospital["lat"]), float(hospital["lng"]))
    urban_speed_kmph = 24.0
    eta = max(3, round((distance / urban_speed_kmph) * 60 + 2))
    return {
        "distance_km": round(distance, 2),
        "eta_minutes": eta,
        "route_polyline": None,
    }


def estimate_route(caller_lat: float, caller_lng: float, hospital: dict) -> dict:
    return _fallback_route(caller_lat, caller_lng, hospital)


def _matrix_routes(caller_lat: float, caller_lng: float, hospitals: list[dict]) -> list[dict]:
    token = os.environ.get("MAPBOX_TOKEN") or os.environ.get("VITE_MAPBOX_TOKEN")
    if not token or not hospitals:
        raise RuntimeError("Mapbox matrix routing is not configured")

    coordinates = [f"{caller_lng},{caller_lat}"] + [
        f"{hospital['lng']},{hospital['lat']}" for hospital in hospitals
    ]
    destinations = ";".join(str(index) for index in range(1, len(coordinates)))
    query = urllib.parse.urlencode(
        {
            "sources": "0",
            "destinations": destinations,
            "annotations": "duration,distance",
            "access_token": token,
        }
    )
    coord_path = ";".join(coordinates)
    url = f"https://api.mapbox.com/directions-matrix/v1/mapbox/driving-traffic/{coord_path}?{query}"

    with urllib.request.urlopen(url, timeout=1.8) as response:
        import json

        payload = json.loads(response.read().decode("utf-8"))

    durations = payload.get("durations", [[]])[0]
    distances = payload.get("distances", [[]])[0]
    routed = []
    for index, hospital in enumerate(hospitals):
        duration = durations[index] if index < len(durations) else None
        distance = distances[index] if index < len(distances) else None
        if duration is None or distance is None:
            route = _fallback_route(caller_lat, caller_lng, hospital)
        else:
            route = {
                "distance_km": round(float(distance) / 1000, 2),
                "eta_minutes": max(1, round(float(duration) / 60)),
                "route_polyline": None,
            }
        routed.append({**hospital, **route})
    return routed


def attach_routes(caller_lat: float, caller_lng: float, hospitals: list[dict]) -> list[dict]:
    try:
        return _matrix_routes(caller_lat, caller_lng, hospitals)
    except Exception:
        return [
            {**hospital, **estimate_route(caller_lat, caller_lng, hospital)}
            for hospital in hospitals
        ]
