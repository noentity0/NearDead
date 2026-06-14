"""
NearDead — Demo Data Seed Script
Seeds 10 real Bangalore hospitals into Supabase with:
  - Real coordinates
  - Realistic ER capacity
  - Equipment flags
  - Time-of-day intake simulation
  - Stress event toggle for demo

Usage:
  pip install supabase python-dotenv
  
  # Normal seed
  python seed_neardead.py

  # Seed + immediately stress a hospital (for demo prep)
  python seed_neardead.py --stress victoria

  # Simulate a surge over 10 mins (run before demo, let it build)
  python seed_neardead.py --simulate-surge victoria --minutes 10

  # Full reset to baseline
  python seed_neardead.py --reset

Env vars needed (.env file):
  SUPABASE_URL=https://xxxx.supabase.co
  SUPABASE_SERVICE_KEY=your_service_role_key   ← NOT the anon key
"""

import os
import sys
import random
import argparse
import time
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# ─────────────────────────────────────────────────────────────────
# SUPABASE CLIENT
# ─────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌  Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ─────────────────────────────────────────────────────────────────
# 10 REAL BANGALORE HOSPITALS
# Coordinates verified. All tier-1 and tier-2 facilities.
# ─────────────────────────────────────────────────────────────────
HOSPITALS = [
    {
        "name": "Victoria Hospital",
        "short_name": "Victoria",
        "address": "Fort Rd, Krishna Rajendra Market, Bengaluru - 560002",
        "lat": 12.9667,
        "lng": 77.5760,
        "zone": "Central",
        "tier": 1,
        # Capabilities
        "has_trauma_center": True,
        "has_icu": True,
        "has_ventilators": True,
        "has_blood_bank": True,
        "has_cath_lab": False,
        "has_burn_unit": True,
        "has_nicu": True,
        "specialties": ["trauma", "general_surgery", "orthopedics"],
        # Capacity
        "total_er_beds": 40,
        "total_icu_beds": 12,
        "total_ventilators": 8,
        # Demo context
        "_note": "Oldest govt hospital. Always overcrowded. Perfect 'broken system' villain.",
        "_demo_role": "overwhelmed_hospital",   # stress this one in demo
        "_baseline_load": 0.88,                 # starts at 88% load
    },
    {
        "name": "Manipal Hospital (Old Airport Road)",
        "short_name": "Manipal",
        "address": "98, HAL Airport Rd, Kodihalli, Bengaluru - 560017",
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
        "_note": "Best cardiac care in east Bangalore. NearDead's hero hospital.",
        "_demo_role": "hero_hospital",
        "_baseline_load": 0.45,
    },
    {
        "name": "St. John's Medical College Hospital",
        "short_name": "St. Johns",
        "address": "Sarjapur Rd, John Nagar, Koramangala, Bengaluru - 560034",
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
        "_note": "Top teaching hospital, strong cardiac + neuro.",
        "_demo_role": "secondary_option",
        "_baseline_load": 0.60,
    },
    {
        "name": "MS Ramaiah Memorial Hospital",
        "short_name": "Ramaiah",
        "address": "MSR Nagar, MSRIT Post, Mathikere, Bengaluru - 560054",
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
        "_note": "North Bangalore's best trauma centre.",
        "_demo_role": "north_option",
        "_baseline_load": 0.55,
    },
    {
        "name": "Fortis Hospital Bannerghatta Road",
        "short_name": "Fortis Bannerghatta",
        "address": "154/9, Bannerghatta Rd, Opposite IIM-B, Bengaluru - 560076",
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
        "_note": "Strong cardiac. Private. Generally less crowded.",
        "_demo_role": "private_option",
        "_baseline_load": 0.40,
    },
    {
        "name": "Narayana Health City",
        "short_name": "Narayana",
        "address": "258/A, Bommasandra Industrial Area, Anekal Taluk, Bengaluru - 560099",
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
        "_note": "World-class cardiac surgery. Far south but exceptional capability.",
        "_demo_role": "specialist_option",
        "_baseline_load": 0.50,
    },
    {
        "name": "Bowring & Lady Curzon Hospital",
        "short_name": "Bowring",
        "address": "Shivaji Nagar, Bengaluru - 560001",
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
        "_note": "Government secondary hospital. Central location but limited specialist care.",
        "_demo_role": "limited_option",
        "_baseline_load": 0.75,
    },
    {
        "name": "Sparsh Hospital (Infantry Road)",
        "short_name": "Sparsh",
        "address": "29/P2, The Executive Centre, Infantry Rd, Bengaluru - 560001",
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
        "_note": "Best for trauma/ortho in central Bangalore.",
        "_demo_role": "trauma_specialist",
        "_baseline_load": 0.50,
    },
    {
        "name": "Sakra World Hospital",
        "short_name": "Sakra",
        "address": "Sy No 52/2 & 52/3, Devarabeesanahalli, Varthur Hobli, Bengaluru - 560103",
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
        "_note": "Top stroke and neuro centre. Whitefield corridor.",
        "_demo_role": "neuro_specialist",
        "_baseline_load": 0.45,
    },
    {
        "name": "Kidwai Memorial Institute of Oncology",
        "short_name": "Kidwai",
        "address": "Dr M H Marigowda Rd, Hombegowda Nagar, Bengaluru - 560029",
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
        "_note": "Specialist cancer hospital. Limited ER scope but blood bank is strong.",
        "_demo_role": "specialist_limited",
        "_baseline_load": 0.35,
    },
]


# ─────────────────────────────────────────────────────────────────
# TIME-OF-DAY INTAKE MULTIPLIER
# Models real Bangalore hospital patterns
# ─────────────────────────────────────────────────────────────────
def get_time_of_day_multiplier() -> float:
    """
    Returns a load multiplier based on current hour.
    Bangalore ER patterns:
      - Morning rush (8-11am): accidents, chronic collapses
      - Afternoon (12-3pm): relatively stable
      - Evening rush (5-9pm): peak trauma / road accidents
      - Night (10pm-6am): lower but ICU-heavy cases
    """
    hour = datetime.now(timezone.utc).hour
    # IST = UTC + 5:30, approximate with +5
    ist_hour = (hour + 5) % 24

    schedule = {
        0: 0.55,   # midnight
        1: 0.45,
        2: 0.40,
        3: 0.40,
        4: 0.45,
        5: 0.50,
        6: 0.60,
        7: 0.70,
        8: 0.85,   # morning peak starts
        9: 0.95,
        10: 1.00,  # peak
        11: 0.90,
        12: 0.80,
        13: 0.75,
        14: 0.70,
        15: 0.75,
        16: 0.85,
        17: 1.00,  # evening peak
        18: 1.10,  # highest — rush hour accidents
        19: 1.05,
        20: 0.90,
        21: 0.80,
        22: 0.70,
        23: 0.60,
    }
    return schedule.get(ist_hour, 0.75)


# ─────────────────────────────────────────────────────────────────
# CAPACITY SNAPSHOT GENERATOR
# ─────────────────────────────────────────────────────────────────
def generate_snapshot(hospital: dict, override_load: float = None) -> dict:
    """
    Generate a realistic capacity snapshot for a hospital.
    
    override_load: 0.0–1.0 force a specific load level
                   (used for stress events)
    """
    total_er    = hospital["total_er_beds"]
    total_icu   = hospital["total_icu_beds"]
    total_vents = hospital["total_ventilators"]

    # Base load from hospital profile + time of day adjustment
    tod_multiplier = get_time_of_day_multiplier()
    base_load = hospital["_baseline_load"]

    if override_load is not None:
        effective_load = override_load
    else:
        # Add realistic jitter: ±8%
        jitter = random.uniform(-0.08, 0.08)
        effective_load = min(0.99, max(0.05, base_load * tod_multiplier + jitter))

    # Calculate available beds from load
    occupied_er   = int(total_er * effective_load)
    available_er  = max(0, total_er - occupied_er)

    occupied_icu  = int(total_icu * effective_load * 0.9)  # ICU fills slightly slower
    available_icu = max(0, total_icu - occupied_icu)

    occupied_vents  = int(total_vents * effective_load * 0.7)
    available_vents = max(0, total_vents - occupied_vents)

    # Doctors scale inversely with load (they get overwhelmed)
    max_doctors = 6 if hospital["tier"] == 1 else 4
    # As load → 100%, doctors feel like there are fewer effective ones
    effective_doctors = max(1, int(max_doctors * (1 - effective_load * 0.4)))
    doctors_on_duty   = effective_doctors + random.randint(0, 2)

    nurses_on_duty = doctors_on_duty * random.randint(3, 5)

    # Wait time: exponential growth after 70% load
    if effective_load < 0.5:
        wait_minutes = random.randint(5, 20)
    elif effective_load < 0.7:
        wait_minutes = random.randint(20, 45)
    elif effective_load < 0.85:
        wait_minutes = random.randint(45, 90)
    elif effective_load < 0.95:
        wait_minutes = random.randint(90, 180)
    else:
        wait_minutes = random.randint(180, 360)  # 3–6 hours. Heartbreaking.

    # ER Status
    if effective_load >= 0.95:
        er_status = "overwhelmed"
    elif effective_load >= 0.75:
        er_status = "caution"
    elif effective_load >= 0.0:
        er_status = "open"

    # Intake rate (patients/hour) — peaks during high load
    base_intake = 8 if hospital["tier"] == 1 else 4
    intake_rate = int(base_intake * tod_multiplier * random.uniform(0.8, 1.2))

    # Blood bank availability
    # Under load, blood gets used faster
    blood_shortage = effective_load > 0.80
    blood_a_pos  = random.random() > (0.15 if not blood_shortage else 0.45)
    blood_b_pos  = random.random() > (0.15 if not blood_shortage else 0.45)
    blood_o_pos  = random.random() > (0.10 if not blood_shortage else 0.55)
    blood_ab_pos = random.random() > (0.20 if not blood_shortage else 0.50)
    blood_o_neg  = random.random() > (0.30 if not blood_shortage else 0.70)  # rarest

    return {
        "available_er_beds":      available_er,
        "available_icu_beds":     available_icu,
        "available_ventilators":  available_vents,
        "doctors_on_duty":        doctors_on_duty,
        "nurses_on_duty":         nurses_on_duty,
        "er_status":              er_status,
        "wait_time_minutes":      wait_minutes,
        "patients_in_queue":      occupied_er,
        "blood_a_pos":            blood_a_pos,
        "blood_b_pos":            blood_b_pos,
        "blood_o_pos":            blood_o_pos,
        "blood_ab_pos":           blood_ab_pos,
        "blood_o_neg":            blood_o_neg,
        "load_percentage":        round(effective_load * 100, 2),
        "intake_rate_per_hour":   intake_rate,
        "recorded_by":            "seed_script",
        "is_simulated":           True,
    }


# ─────────────────────────────────────────────────────────────────
# CORE OPERATIONS
# ─────────────────────────────────────────────────────────────────
def upsert_hospitals():
    """Insert all 10 hospitals. Skip internal demo keys."""
    SKIP_KEYS = {"_note", "_demo_role", "_baseline_load"}
    print("\n🏥  Seeding hospitals...")

    for h in HOSPITALS:
        row = {k: v for k, v in h.items() if k not in SKIP_KEYS}
        result = (
            supabase.table("hospitals")
            .upsert(row, on_conflict="name")
            .execute()
        )
        status = "✓" if result.data else "✗"
        print(f"  {status}  {h['short_name']:20s} ({h['zone']:12s}) — tier {h['tier']}")

    print(f"\n  ✅  {len(HOSPITALS)} hospitals seeded.\n")


def seed_initial_snapshots():
    """
    Insert one capacity snapshot per hospital based on
    current time of day and baseline load profile.
    """
    print("📸  Seeding initial capacity snapshots...")

    # Get hospital IDs from DB
    result = supabase.table("hospitals").select("id, short_name, name").execute()
    hospital_rows = {r["name"]: r["id"] for r in result.data}

    snapshots_inserted = 0
    for h in HOSPITALS:
        hospital_id = hospital_rows.get(h["name"])
        if not hospital_id:
            print(f"  ⚠  Hospital not found in DB: {h['name']}")
            continue

        snapshot = generate_snapshot(h)
        snapshot["hospital_id"] = hospital_id

        supabase.table("capacity_snapshots").insert(snapshot).execute()
        snapshots_inserted += 1

        load = snapshot["load_percentage"]
        status = snapshot["er_status"]
        beds = snapshot["available_er_beds"]
        wait = snapshot["wait_time_minutes"]

        # Color-coded status for terminal readability
        if status == "overwhelmed":
            status_display = f"\033[91m{status}\033[0m"   # red
        elif status == "caution":
            status_display = f"\033[93m{status}\033[0m"   # yellow
        else:
            status_display = f"\033[92m{status}\033[0m"   # green

        print(
            f"  ✓  {h['short_name']:22s} "
            f"load={load:5.1f}%  "
            f"beds={beds:2d}  "
            f"wait={wait:3d}min  "
            f"status={status_display}"
        )

    print(f"\n  ✅  {snapshots_inserted} snapshots inserted.\n")


def stress_hospital(short_name: str, severity: str = "high"):
    """
    Instantly overwhelm a hospital for demo purposes.
    Severity: 'high' = 95%+ load, 'medium' = 85% load
    """
    load_map = {
        "high":     random.uniform(0.93, 0.99),
        "medium":   random.uniform(0.82, 0.90),
        "critical": 0.99,
    }
    override_load = load_map.get(severity, 0.95)

    print(f"\n🔴  Stressing '{short_name}' to {severity} load ({override_load*100:.0f}%)...")

    # Find hospital
    hospital_data = next(
        (h for h in HOSPITALS if h["short_name"].lower() == short_name.lower()),
        None
    )
    if not hospital_data:
        print(f"  ❌  Hospital '{short_name}' not found.")
        print(f"  Available: {[h['short_name'] for h in HOSPITALS]}")
        return

    # Get hospital ID
    result = (
        supabase.table("hospitals")
        .select("id")
        .eq("short_name", hospital_data["short_name"])
        .execute()
    )
    if not result.data:
        print(f"  ❌  Not found in DB. Run seed first.")
        return

    hospital_id = result.data[0]["id"]

    # Insert overwhelmed snapshot
    snapshot = generate_snapshot(hospital_data, override_load=override_load)
    snapshot["hospital_id"] = hospital_id
    snapshot["er_status"] = "overwhelmed"  # force this regardless of load calc

    supabase.table("capacity_snapshots").insert(snapshot).execute()

    # Also fire a prediction alert
    supabase.table("prediction_alerts").insert({
        "hospital_id": hospital_id,
        "alert_type": "capacity_critical",
        "predicted_at": datetime.now(timezone.utc).isoformat(),
        "confidence": 0.95,
        "message": (
            f"{hospital_data['short_name']} is critically overwhelmed. "
            f"{snapshot['available_er_beds']} beds available. "
            f"Wait time: {snapshot['wait_time_minutes']} minutes. "
            f"Do not route non-critical cases here."
        ),
        "minutes_until": 0,
        "acknowledged": False,
    }).execute()

    print(f"  ✅  Stress event applied:")
    print(f"      Load:      {snapshot['load_percentage']}%")
    print(f"      Beds left: {snapshot['available_er_beds']}")
    print(f"      Wait:      {snapshot['wait_time_minutes']} min")
    print(f"      Status:    OVERWHELMED")
    print(f"      Alert:     Fired to prediction_alerts table")
    print(f"\n  → Dashboard will show {hospital_data['short_name']} in RED immediately.\n")


def simulate_surge(short_name: str, minutes: int = 10):
    """
    Gradually increases load on a hospital over N minutes.
    Run this before the demo — the surge will be in progress
    when judges watch.
    
    Inserts one snapshot every 90 seconds by default,
    escalating from baseline to overwhelmed.
    """
    hospital_data = next(
        (h for h in HOSPITALS if h["short_name"].lower() == short_name.lower()),
        None
    )
    if not hospital_data:
        print(f"❌  Hospital '{short_name}' not found.")
        return

    result = (
        supabase.table("hospitals")
        .select("id")
        .eq("short_name", hospital_data["short_name"])
        .execute()
    )
    if not result.data:
        print(f"❌  Not found in DB. Run seed first.")
        return

    hospital_id = result.data[0]["id"]
    steps = max(4, minutes * 60 // 90)     # one update every ~90s
    start_load = hospital_data["_baseline_load"]
    end_load   = 0.97                       # fully overwhelmed

    print(f"\n📈  Simulating surge for '{short_name}'")
    print(f"    From {start_load*100:.0f}% → {end_load*100:.0f}% over {minutes} min")
    print(f"    {steps} updates, every ~90 seconds\n")
    print("    (Leave this running. Open the dashboard to watch it live.)\n")

    for i in range(steps):
        progress = i / (steps - 1)
        current_load = start_load + (end_load - start_load) * progress

        snapshot = generate_snapshot(hospital_data, override_load=current_load)
        snapshot["hospital_id"] = hospital_id

        supabase.table("capacity_snapshots").insert(snapshot).execute()

        bar_filled = int(progress * 20)
        bar = "█" * bar_filled + "░" * (20 - bar_filled)
        print(
            f"  [{bar}] {progress*100:4.0f}%  "
            f"load={snapshot['load_percentage']:5.1f}%  "
            f"beds={snapshot['available_er_beds']:2d}  "
            f"status={snapshot['er_status']}"
        )

        # Fire warning alert at 80%
        if snapshot["load_percentage"] >= 80 and i == int(steps * 0.6):
            minutes_to_full = int((1 - progress) * minutes)
            supabase.table("prediction_alerts").insert({
                "hospital_id": hospital_id,
                "alert_type": "capacity_warning",
                "predicted_at": datetime.now(timezone.utc).isoformat(),
                "confidence": 0.87,
                "message": (
                    f"⚠ {hospital_data['short_name']} approaching capacity. "
                    f"Estimated to reach critical load in ~{minutes_to_full} minutes. "
                    f"Pre-route incoming cases to alternatives."
                ),
                "minutes_until": minutes_to_full,
                "acknowledged": False,
            }).execute()
            print(f"\n  ⚠  PREDICTION ALERT FIRED → Dashboard will show warning\n")

        if i < steps - 1:
            time.sleep(90)

    print(f"\n  ✅  Surge complete. {short_name} is now OVERWHELMED.\n")


def reset_all():
    """
    Reset all hospitals to baseline capacity.
    Inserts fresh snapshots at normal load levels.
    """
    print("\n🔄  Resetting all hospitals to baseline...\n")

    result = supabase.table("hospitals").select("id, name, short_name").execute()
    hospital_rows = {r["name"]: r["id"] for r in result.data}

    for h in HOSPITALS:
        hospital_id = hospital_rows.get(h["name"])
        if not hospital_id:
            continue

        snapshot = generate_snapshot(h)  # uses baseline load, no override
        snapshot["hospital_id"] = hospital_id

        supabase.table("capacity_snapshots").insert(snapshot).execute()
        print(f"  ✓  {h['short_name']:22s} reset → {snapshot['load_percentage']}% load")

    # Clear unacknowledged alerts
    supabase.table("prediction_alerts").delete().eq("acknowledged", False).execute()
    print("\n  ✅  All hospitals reset. Alerts cleared.\n")


def print_status():
    """Print current status of all hospitals from DB."""
    result = supabase.rpc("get_hospital_current_status").execute()

    if not result.data:
        print("⚠  No data. Try running: python seed_neardead.py")
        return

    print(f"\n{'Hospital':25s} {'Load':6s} {'Beds':5s} {'Wait':6s} {'Status':12s}")
    print("─" * 60)
    for row in result.data:
        print(
            f"{row['short_name']:25s} "
            f"{row['load_percentage']:5.1f}%  "
            f"{row['available_er_beds']:3d}   "
            f"{row['wait_time_minutes']:4d}m  "
            f"{row['er_status']}"
        )


# ─────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="NearDead demo data seeder",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python seed_neardead.py                          # Full seed
  python seed_neardead.py --stress victoria        # Overwhelm Victoria
  python seed_neardead.py --stress victoria --severity critical
  python seed_neardead.py --simulate-surge victoria --minutes 10
  python seed_neardead.py --reset                  # Reset to baseline
  python seed_neardead.py --status                 # Print current state
        """
    )
    parser.add_argument(
        "--stress",
        metavar="HOSPITAL_SHORT_NAME",
        help="Instantly overwhelm a hospital (e.g. --stress victoria)"
    )
    parser.add_argument(
        "--severity",
        choices=["medium", "high", "critical"],
        default="high",
        help="Stress severity (default: high)"
    )
    parser.add_argument(
        "--simulate-surge",
        metavar="HOSPITAL_SHORT_NAME",
        help="Gradually overwhelm hospital over N minutes"
    )
    parser.add_argument(
        "--minutes",
        type=int,
        default=10,
        help="Duration for --simulate-surge (default: 10)"
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Reset all hospitals to baseline capacity"
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="Print current hospital status from DB"
    )
    parser.add_argument(
        "--snapshots-only",
        action="store_true",
        help="Only insert new snapshots (skip hospital upsert)"
    )

    args = parser.parse_args()

    print("\n" + "═" * 55)
    print("  🚑  NearDead — Demo Data Seeder")
    print("═" * 55)

    if args.status:
        print_status()

    elif args.reset:
        reset_all()

    elif args.stress:
        stress_hospital(args.stress, args.severity)

    elif args.simulate_surge:
        simulate_surge(args.simulate_surge, args.minutes)

    elif args.snapshots_only:
        seed_initial_snapshots()

    else:
        # Default: full seed
        upsert_hospitals()
        seed_initial_snapshots()
        print("─" * 55)
        print("  💡  Demo commands:")
        print("  Stress Victoria:  python seed_neardead.py --stress victoria")
        print("  Live surge:       python seed_neardead.py --simulate-surge victoria --minutes 10")
        print("  Reset:            python seed_neardead.py --reset")
        print("─" * 55 + "\n")


if __name__ == "__main__":
    main()
