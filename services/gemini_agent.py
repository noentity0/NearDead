"""
NearDead — Gemini Dispatch Agent
File: backend/services/gemini_agent.py

The brain of NearDead. Takes a patient + location + live hospital list.
Returns a ranked list of 3 hospitals with reasoning, confidence, ETA.

Usage:
    from services.gemini_agent import get_dispatch_recommendation

    result = await get_dispatch_recommendation(
        patient=patient_data,
        candidates=hospital_list,   # pre-filtered by capacity_filter.py
        ors_results=ors_data,        # ETAs from ors_router.py
    )
"""

import json
import re
import logging
try:
    import google.generativeai as genai
except ImportError:  # Allows the fallback ranker to run before Gemini deps are installed.
    genai = None
from datetime import datetime, timezone
from typing import Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────
# gemini-1.5-flash: free tier, ~1-2s latency, good enough for dispatch
# Do NOT use gemini-1.5-pro — latency too high for emergency use
GEMINI_MODEL = "gemini-2.5-flash"
MAX_TOKENS   = 1024   # Enough for 3 ranked hospitals + reasoning
TEMPERATURE  = 0.1    # Near-deterministic. This is life/death, not creative writing.


# ─────────────────────────────────────────────────────────────────
# DATA TYPES
# ─────────────────────────────────────────────────────────────────
@dataclass
class PatientContext:
    condition_type: str          # cardiac|trauma|stroke|respiratory|pediatric|burn|obstetric|other
    condition_notes: str         # Free text from dispatcher
    is_critical: bool
    patient_age: Optional[int]
    patient_gender: Optional[str]
    blood_type_needed: Optional[str]
    caller_lat: float
    caller_lng: float
    caller_address: str


@dataclass
class HospitalCandidate:
    id: str
    name: str
    short_name: str
    lat: float
    lng: float
    zone: str
    tier: int
    # Live capacity
    available_er_beds: int
    available_icu_beds: int
    available_ventilators: int
    doctors_on_duty: int
    er_status: str              # open|caution|overwhelmed
    wait_time_minutes: int
    load_percentage: float
    # Equipment
    has_icu: bool
    has_trauma_center: bool
    has_ventilators: bool
    has_blood_bank: bool
    has_cath_lab: bool
    has_burn_unit: bool
    has_nicu: bool
    specialties: list[str]
    # Routing (filled in by ors_router.py before Gemini call)
    distance_km: float
    eta_minutes: int


@dataclass
class DispatchRecommendation:
    rank: int
    hospital_id: str
    hospital_name: str
    eta_minutes: int
    distance_km: float
    confidence: float           # 0.0 – 1.0
    reasoning: str              # 1-2 sentence plain English
    disqualified: bool = False
    disqualify_reason: str = ""
    source: str = "gemini"      # "gemini" | "fallback"


# ─────────────────────────────────────────────────────────────────
# ════════════════════════════════════════════════════════════════
# SYSTEM PROMPT
# This is the identity and rules Gemini always operates under.
# Change this carefully — it defines the entire decision framework.
# ════════════════════════════════════════════════════════════════
# ─────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """
You are NearDead's emergency dispatch AI, operating in Bangalore, India.
Your sole function is to recommend which hospital an ambulance should go to
right now, for a specific patient, given live hospital capacity data.

## YOUR DECISION FRAMEWORK

You rank hospitals by combining four factors in this exact priority order:

1. CAPABILITY MATCH (non-negotiable)
   The hospital must be able to treat this specific condition.
   - Cardiac arrest / chest pain / STEMI → requires: has_cath_lab OR has_icu
   - Stroke / TIA → requires: neurology specialty OR has_icu
   - Major trauma / accident → requires: has_trauma_center
   - Severe burns → requires: has_burn_unit
   - Pediatric emergency (patient age < 14) → requires: has_nicu OR pediatric specialty
   - Obstetric emergency → requires: obstetric specialty
   - Respiratory failure → requires: has_ventilators AND available_ventilators > 0
   - Blood type needed → requires: has_blood_bank
   If a hospital fails capability match for a critical case, mark it
   disqualified with reason "missing_capability". It must not appear in
   the top 3 unless no alternative exists.

2. CURRENT CAPACITY (most important practical factor)
   - er_status "overwhelmed" → deprioritize heavily (add 60 min penalty to effective wait)
   - er_status "caution" → mild deprioritization (add 20 min penalty)
   - er_status "open" → no penalty
   - available_er_beds = 0 → disqualify unless no alternative
   - Effective wait = wait_time_minutes + status_penalty

3. TIME TO TREATMENT (ETA + wait)
   Total time to treatment = eta_minutes + effective_wait_minutes
   Minimise this. A hospital 5km away with 2 min wait beats a 1km hospital
   with 90 min wait. Always show this total in your reasoning.

4. HOSPITAL TIER & CAPABILITY DEPTH
   All else equal, prefer tier 1 over tier 2. Prefer hospitals with more
   matching specialties. A cardiac case gets better outcomes at a hospital
   with both ICU and cath lab vs just ICU.

## EDGE CASE RULES

ALL_OVERWHELMED: If all hospitals have er_status "overwhelmed":
  - Still rank them. Best of bad options is better than no decision.
  - Flag this in reasoning: "All facilities are currently overwhelmed."
  - Rank by: available_er_beds DESC, then eta_minutes ASC.
  - Set confidence scores lower (max 0.65).

NO_CAPABILITY_MATCH: If no hospital has the required capability:
  - Recommend nearest hospital anyway.
  - Add to reasoning: "No facility with [capability] available within range.
    Routing to nearest open facility. Consider specialist transfer after stabilisation."
  - Set confidence to 0.50.

PEDIATRIC_CRITICAL: Patient age < 2 or condition is neonatal:
  - has_nicu is mandatory unless truly no alternative.
  - Penalise adult-only trauma centres even if they have capacity.

TRAUMA_WITH_BLOOD_LOSS: condition_type = trauma AND is_critical = true:
  - has_blood_bank becomes near-mandatory (treat like capability match).
  - Penalise hospitals without blood bank even if they have trauma centre.

## OUTPUT FORMAT

You MUST respond with valid JSON only. No markdown. No explanation outside
the JSON. No preamble. No postamble. The dispatcher's screen parses your
response directly.

{
  "recommendations": [
    {
      "rank": 1,
      "hospital_id": "<uuid>",
      "hospital_name": "<name>",
      "eta_minutes": <integer>,
      "distance_km": <float>,
      "confidence": <float 0.0-1.0>,
      "reasoning": "<1-2 plain English sentences explaining why this hospital, what the total time to treatment is, and what makes it the right choice for this specific condition>",
      "disqualified": false
    },
    {
      "rank": 2,
      ...
    },
    {
      "rank": 3,
      ...
    }
  ],
  "edge_case_triggered": "<none|all_overwhelmed|no_capability_match|pediatric_critical|trauma_blood_loss>",
  "decision_summary": "<one sentence: what was the key factor that determined rank 1>"
}

## REASONING QUALITY RULES

Each reasoning string must:
- Mention the specific condition and why this hospital matches
- State total time to treatment (ETA + wait)
- Be readable by a non-medical dispatcher in under 5 seconds
- Be specific to THIS patient, not generic

BAD reasoning: "Good hospital with available beds."
GOOD reasoning: "Manipal has a functioning cath lab and 6 ICU beds free.
  Cardiac patient arrives in 7 min with 15 min wait — 22 min to treatment,
  vs Victoria's 4 min ETA but 180 min wait."

## CONFIDENCE SCORING GUIDE

0.90–1.00: Clear best option. Capability match, open status, low ETA.
0.75–0.89: Good option. One moderate tradeoff (slightly higher ETA, caution status).
0.60–0.74: Acceptable. Multiple tradeoffs or caution status + moderate wait.
0.40–0.59: Compromise. Used when options are limited or conditions are edge cases.
0.00–0.39: Last resort only. Used when all options are poor.

## WHAT YOU ARE NOT

- You are not a medical diagnosis engine. Do not suggest treatments.
- You are not a triage system. Do not assess patient severity beyond
  what the dispatcher has told you.
- You are not infallible. Dispatcher can override your recommendation.
  Your job is to give them the best information, not to make the decision.
"""


# ─────────────────────────────────────────────────────────────────
# USER PROMPT BUILDER
# Called fresh for every dispatch request.
# ─────────────────────────────────────────────────────────────────

def build_user_prompt(
    patient: PatientContext,
    candidates: list[HospitalCandidate],
) -> str:
    """
    Builds the per-request user prompt.
    Structured so Gemini can parse it reliably.
    """

    # Time context (affects interpretation of intake rates)
    now_ist = datetime.now(timezone.utc)
    ist_hour = (now_ist.hour + 5) % 24
    ist_minute = now_ist.minute
    time_str = f"{ist_hour:02d}:{ist_minute:02d} IST"

    # Format patient block
    age_str    = f"{patient.patient_age} years old" if patient.patient_age else "unknown age"
    gender_str = patient.patient_gender or "unknown gender"
    blood_str  = f"Blood type needed: {patient.blood_type_needed}" if patient.blood_type_needed else "Blood type not specified"
    critical_str = "CRITICAL — immediate intervention required" if patient.is_critical else "Stable enough for transport"

    patient_block = f"""
PATIENT:
  Condition type: {patient.condition_type.upper()}
  Status: {critical_str}
  Age/gender: {age_str}, {gender_str}
  {blood_str}
  Dispatcher notes: "{patient.condition_notes or 'No additional notes'}"
  Location: {patient.caller_address} ({patient.caller_lat:.4f}, {patient.caller_lng:.4f})
  Time of call: {time_str}
""".strip()

    # Format hospital list
    hospital_lines = []
    for i, h in enumerate(candidates, 1):
        # Build capability string
        caps = []
        if h.has_icu:           caps.append("ICU")
        if h.has_trauma_center: caps.append("Trauma Centre")
        if h.has_cath_lab:      caps.append("Cath Lab")
        if h.has_ventilators:   caps.append("Ventilators")
        if h.has_blood_bank:    caps.append("Blood Bank")
        if h.has_burn_unit:     caps.append("Burn Unit")
        if h.has_nicu:          caps.append("NICU")
        caps_str = ", ".join(caps) if caps else "Basic ER only"

        specialties_str = ", ".join(h.specialties) if h.specialties else "General"

        # Status flag for dispatcher clarity
        status_flag = {
            "open":        "✓ OPEN",
            "caution":     "⚠ CAUTION",
            "overwhelmed": "✗ OVERWHELMED",
        }.get(h.er_status, h.er_status)

        hospital_lines.append(f"""
  Hospital {i}: {h.name} (ID: {h.id})
    Status: {status_flag}
    Distance/ETA: {h.distance_km:.1f} km | {h.eta_minutes} min drive
    Capacity: {h.available_er_beds} ER beds free | {h.available_icu_beds} ICU beds free
    Ventilators: {h.available_ventilators} available
    Doctors on duty: {h.doctors_on_duty}
    Current wait: {h.wait_time_minutes} min
    Load: {h.load_percentage:.0f}%
    Tier: {h.tier} | Zone: {h.zone}
    Capabilities: {caps_str}
    Specialties: {specialties_str}
""".strip())

    hospitals_block = "\n\n".join(hospital_lines)

    prompt = f"""
{patient_block}

AVAILABLE HOSPITALS ({len(candidates)} candidates after pre-filter):

{hospitals_block}

TASK:
Rank the top 3 hospitals for this patient RIGHT NOW.
Apply your decision framework. Return valid JSON only.
""".strip()

    return prompt


# ─────────────────────────────────────────────────────────────────
# RESPONSE PARSER
# Gemini sometimes wraps JSON in markdown fences. Strip and parse.
# ─────────────────────────────────────────────────────────────────

def parse_gemini_response(raw: str) -> dict:
    """
    Extracts and parses JSON from Gemini's response.
    Handles markdown code fences, trailing text, minor formatting issues.
    """
    # Strip markdown fences if present
    cleaned = re.sub(r"```json\s*", "", raw)
    cleaned = re.sub(r"```\s*", "", cleaned)
    cleaned = cleaned.strip()

    # Find the JSON object (starts with { ends with })
    start = cleaned.find("{")
    end   = cleaned.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError(f"No JSON object found in response: {raw[:200]}")

    json_str = cleaned[start:end]

    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON parse failed: {e}\nRaw: {json_str[:300]}")


def validate_and_map_response(
    parsed: dict,
    candidates: list[HospitalCandidate],
) -> list[DispatchRecommendation]:
    """
    Validates Gemini's response structure and maps to typed objects.
    Repairs minor issues (missing fields) rather than failing hard.
    """
    recs = parsed.get("recommendations", [])
    if not recs:
        raise ValueError("Gemini returned empty recommendations list")

    # Build lookup by hospital_id for fast validation
    candidate_map = {h.id: h for h in candidates}

    results = []
    for rec in recs[:3]:  # Take max 3
        hospital_id = rec.get("hospital_id", "")

        # Validate hospital_id exists in our candidate list
        if hospital_id not in candidate_map:
            logger.warning(f"Gemini returned unknown hospital_id: {hospital_id}")
            # Try to match by name
            name = rec.get("hospital_name", "")
            matched = next((h for h in candidates if h.name == name), None)
            if matched:
                hospital_id = matched.id
            else:
                logger.error(f"Cannot resolve hospital: {name}. Skipping.")
                continue

        h = candidate_map[hospital_id]

        # Clamp confidence to valid range
        confidence = float(rec.get("confidence", 0.5))
        confidence = max(0.0, min(1.0, confidence))

        # Use ORS ETA if Gemini's ETA is suspiciously off
        gemini_eta = int(rec.get("eta_minutes", h.eta_minutes))
        if abs(gemini_eta - h.eta_minutes) > 15:
            logger.warning(
                f"Gemini ETA {gemini_eta} diverges from ORS ETA {h.eta_minutes} "
                f"for {h.short_name}. Using ORS value."
            )
            gemini_eta = h.eta_minutes

        results.append(DispatchRecommendation(
            rank=int(rec.get("rank", len(results) + 1)),
            hospital_id=hospital_id,
            hospital_name=h.name,
            eta_minutes=gemini_eta,
            distance_km=h.distance_km,
            confidence=confidence,
            reasoning=rec.get("reasoning", "No reasoning provided."),
            disqualified=bool(rec.get("disqualified", False)),
            disqualify_reason=rec.get("disqualify_reason", ""),
            source="gemini",
        ))

    return sorted(results, key=lambda r: r.rank)


# ─────────────────────────────────────────────────────────────────
# FALLBACK RANKER
# Used when: Gemini API fails, rate limited, or response unparseable.
# Pure Python. No external calls. Always works.
# ─────────────────────────────────────────────────────────────────

CONDITION_CAPABILITY_MAP = {
    "cardiac":     ["has_cath_lab", "has_icu"],
    "stroke":      ["has_icu"],
    "trauma":      ["has_trauma_center"],
    "burn":        ["has_burn_unit"],
    "pediatric":   ["has_nicu"],
    "obstetric":   [],  # check specialties separately
    "respiratory": ["has_ventilators"],
    "other":       [],
}

def fallback_ranker(
    patient: PatientContext,
    candidates: list[HospitalCandidate],
) -> list[DispatchRecommendation]:
    """
    Rule-based scoring when Gemini is unavailable.
    
    Score = 0.40 * capacity_score
           + 0.35 * time_score
           + 0.15 * capability_score
           + 0.10 * tier_score
    
    All sub-scores normalised 0–1 within this candidate set.
    """
    logger.warning("Using fallback ranker — Gemini unavailable")

    if not candidates:
        return []

    # Status penalties (minutes added to effective wait)
    STATUS_PENALTY = {"open": 0, "caution": 20, "overwhelmed": 60}

    # Required capabilities for this condition
    required_caps = CONDITION_CAPABILITY_MAP.get(patient.condition_type, [])
    needs_blood   = bool(patient.blood_type_needed)
    is_pediatric  = (patient.patient_age or 99) < 14

    scores = []
    for h in candidates:
        # ── Capability score ─────────────────────────────────────
        cap_score = 1.0
        missing_caps = []
        for cap in required_caps:
            if not getattr(h, cap, False):
                missing_caps.append(cap)
                cap_score -= 0.4
        if needs_blood and not h.has_blood_bank:
            cap_score -= 0.3
            missing_caps.append("has_blood_bank")
        if is_pediatric and not h.has_nicu:
            cap_score -= 0.2
        cap_score = max(0.0, cap_score)

        # ── Capacity score ────────────────────────────────────────
        # Normalise beds: more beds = better
        bed_score = min(1.0, h.available_er_beds / 10.0)
        # Penalise load
        load_penalty = h.load_percentage / 100.0
        capacity_score = max(0.0, bed_score * (1 - load_penalty * 0.5))

        # ── Time score ────────────────────────────────────────────
        penalty     = STATUS_PENALTY.get(h.er_status, 0)
        total_time  = h.eta_minutes + h.wait_time_minutes + penalty
        # Will normalise across candidates after computing all

        # ── Tier score ────────────────────────────────────────────
        tier_score = 1.0 if h.tier == 1 else 0.5

        scores.append({
            "hospital":       h,
            "cap_score":      cap_score,
            "capacity_score": capacity_score,
            "total_time":     total_time,
            "tier_score":     tier_score,
            "missing_caps":   missing_caps,
        })

    # Normalise time scores across candidates
    max_time = max(s["total_time"] for s in scores) or 1
    min_time = min(s["total_time"] for s in scores)
    time_range = max_time - min_time or 1

    results = []
    for s in scores:
        normalised_time = 1.0 - (s["total_time"] - min_time) / time_range

        final_score = (
            0.40 * s["capacity_score"] +
            0.35 * normalised_time +
            0.15 * s["cap_score"] +
            0.10 * s["tier_score"]
        )

        s["final_score"] = final_score

    # Sort by score descending
    scores.sort(key=lambda s: s["final_score"], reverse=True)

    recommendations = []
    for rank, s in enumerate(scores[:3], 1):
        h = s["hospital"]

        # Generate plain-English reasoning
        time_to_treatment = h.eta_minutes + h.wait_time_minutes
        if s["missing_caps"]:
            cap_note = f"Note: missing {', '.join(s['missing_caps'])}. "
        else:
            cap_note = ""

        status_note = {
            "open":        "ER is open with capacity.",
            "caution":     "ER is under moderate load.",
            "overwhelmed": "⚠ ER is overwhelmed — best available option.",
        }.get(h.er_status, "")

        reasoning = (
            f"{h.short_name} has {h.available_er_beds} beds and "
            f"{h.doctors_on_duty} doctors on duty. "
            f"Time to treatment: {time_to_treatment} min "
            f"({h.eta_minutes} min drive + {h.wait_time_minutes} min wait). "
            f"{status_note} {cap_note}"
        ).strip()

        # Confidence: scaled from final score, capped at 0.82 for fallback
        confidence = round(min(0.82, s["final_score"]), 2)

        recommendations.append(DispatchRecommendation(
            rank=rank,
            hospital_id=h.id,
            hospital_name=h.name,
            eta_minutes=h.eta_minutes,
            distance_km=h.distance_km,
            confidence=confidence,
            reasoning=reasoning,
            source="fallback",
        ))

    return recommendations


# ─────────────────────────────────────────────────────────────────
# MAIN ENTRY POINT
# Called by backend/routers/dispatch.py
# ─────────────────────────────────────────────────────────────────

async def get_dispatch_recommendation(
    patient: PatientContext,
    candidates: list[HospitalCandidate],
    gemini_api_key: str,
) -> tuple[list[DispatchRecommendation], str]:
    """
    Main dispatch recommendation function.
    
    Returns:
        (recommendations, source)
        source = "gemini" | "fallback"
    
    Never raises — always returns a usable recommendation.
    Falls back to rule-based ranker if Gemini fails.
    """
    if not candidates:
        logger.error("No candidates passed to dispatch agent")
        return [], "error"

    if genai is None:
        logger.warning("google-generativeai is not installed. Using fallback ranker.")
        return fallback_ranker(patient, candidates), "fallback"

    # ── Try Gemini first ─────────────────────────────────────────
    try:
        genai.configure(api_key=gemini_api_key)
        model = genai.GenerativeModel(
            model_name=GEMINI_MODEL,
            system_instruction=SYSTEM_PROMPT,
            generation_config=genai.types.GenerationConfig(
                temperature=TEMPERATURE,
                max_output_tokens=MAX_TOKENS,
                response_mime_type="application/json",   # Force JSON output
            ),
        )

        user_prompt = build_user_prompt(patient, candidates)

        logger.info(f"Calling Gemini for {patient.condition_type} case, "
                    f"{len(candidates)} candidates")

        response = await model.generate_content_async(user_prompt)
        raw_text = response.text

        logger.debug(f"Gemini raw response: {raw_text[:500]}")

        parsed   = parse_gemini_response(raw_text)
        results  = validate_and_map_response(parsed, candidates)

        if not results:
            raise ValueError("Gemini returned 0 valid recommendations after validation")

        logger.info(f"Gemini recommendation: #{1} = {results[0].hospital_name} "
                    f"(confidence: {results[0].confidence})")

        return results, "gemini"

    except Exception as e:
        logger.warning(f"Gemini dispatch failed: {type(e).__name__}: {e}. "
                       f"Falling back to rule-based ranker.")

        results = fallback_ranker(patient, candidates)
        return results, "fallback"


# ─────────────────────────────────────────────────────────────────
# DEMO / TEST HARNESS
# Run directly to test the agent without the full server:
#   python gemini_agent.py
# ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import asyncio
    import os
    from dotenv import load_dotenv
    load_dotenv()

    # ── Sample: Cardiac arrest near MG Road ─────────────────────
    test_patient = PatientContext(
        condition_type="cardiac",
        condition_notes="55yo male, chest pain radiating to left arm, sweating. Possible STEMI.",
        is_critical=True,
        patient_age=55,
        patient_gender="male",
        blood_type_needed=None,
        caller_lat=12.9757,
        caller_lng=77.6011,
        caller_address="MG Road, Bengaluru",
    )

    # 3 candidates (as would come from capacity_filter.py + ors_router.py)
    test_candidates = [
        HospitalCandidate(
            id="hosp-001",
            name="Victoria Hospital",
            short_name="Victoria",
            lat=12.9667, lng=77.5760,
            zone="Central", tier=1,
            available_er_beds=1,
            available_icu_beds=0,
            available_ventilators=0,
            doctors_on_duty=2,
            er_status="overwhelmed",
            wait_time_minutes=185,
            load_percentage=96.0,
            has_icu=True, has_trauma_center=True,
            has_ventilators=True, has_blood_bank=True,
            has_cath_lab=False,   # ← no cath lab: bad for cardiac
            has_burn_unit=True,   has_nicu=True,
            specialties=["trauma", "general_surgery"],
            distance_km=1.2, eta_minutes=4,
        ),
        HospitalCandidate(
            id="hosp-002",
            name="Manipal Hospital (Old Airport Road)",
            short_name="Manipal",
            lat=12.9591, lng=77.6479,
            zone="East", tier=1,
            available_er_beds=6,
            available_icu_beds=4,
            available_ventilators=3,
            doctors_on_duty=5,
            er_status="open",
            wait_time_minutes=15,
            load_percentage=45.0,
            has_icu=True, has_trauma_center=True,
            has_ventilators=True, has_blood_bank=True,
            has_cath_lab=True,    # ← cath lab: ideal for STEMI
            has_burn_unit=False,  has_nicu=True,
            specialties=["cardiology", "neurology"],
            distance_km=2.8, eta_minutes=7,
        ),
        HospitalCandidate(
            id="hosp-003",
            name="St. John's Medical College Hospital",
            short_name="St. Johns",
            lat=12.9254, lng=77.6228,
            zone="South", tier=1,
            available_er_beds=3,
            available_icu_beds=2,
            available_ventilators=2,
            doctors_on_duty=4,
            er_status="caution",
            wait_time_minutes=50,
            load_percentage=72.0,
            has_icu=True, has_trauma_center=True,
            has_ventilators=True, has_blood_bank=True,
            has_cath_lab=True,
            has_burn_unit=False,  has_nicu=True,
            specialties=["cardiology", "neurology", "pediatrics"],
            distance_km=4.1, eta_minutes=11,
        ),
    ]

    async def run_test():
        api_key = os.environ.get("GEMINI_API_KEY")

        print("\n" + "═" * 60)
        print("  NearDead — Gemini Dispatch Agent Test")
        print("═" * 60)
        print(f"\n  Patient: {test_patient.condition_type.upper()} | "
              f"Critical: {test_patient.is_critical}")
        print(f"  Location: {test_patient.caller_address}")
        print(f"  Notes: {test_patient.condition_notes}\n")

        if not api_key:
            print("  ⚠  No GEMINI_API_KEY found. Testing fallback ranker only.\n")
            results = fallback_ranker(test_patient, test_candidates)
            source  = "fallback"
        else:
            results, source = await get_dispatch_recommendation(
                test_patient, test_candidates, api_key
            )

        print(f"  Source: {source.upper()}\n")
        print("  RECOMMENDATIONS:")
        print("  " + "─" * 56)

        for r in results:
            stars = "★" * int(r.confidence * 5)
            print(f"\n  #{r.rank} — {r.hospital_name}")
            print(f"      ETA: {r.eta_minutes} min | "
                  f"Distance: {r.distance_km}km | "
                  f"Confidence: {r.confidence:.2f} {stars}")
            print(f"      Reasoning: {r.reasoning}")

        print("\n" + "═" * 60 + "\n")

    asyncio.run(run_test())
