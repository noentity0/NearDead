<div align="center">

# 🚑 NearDead

### AI-Powered Emergency Dispatch — Anywhere in the World

**Every second counts. NearDead makes sure the right ambulance goes to the right hospital — right now.**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-Vite-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![Gemini](https://img.shields.io/badge/Gemini_2.5_Flash-AI_Brain-4285F4?style=for-the-badge&logo=google)](https://deepmind.google/technologies/gemini/)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime_DB-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com)
[![Mapbox](https://img.shields.io/badge/Mapbox-Routing-000000?style=for-the-badge&logo=mapbox)](https://mapbox.com)

</div>

---

## 🧠 The Problem

In any major city, when an emergency call comes in, dispatchers make a life-or-death hospital selection in seconds — often from memory, guesswork, or a phone call to the hospital.

The result? Ambulances arrive at overwhelmed ERs. Cardiac patients go to hospitals without cath labs. Critical minutes are lost — **in every city, every day.**

**NearDead fixes this — for any city, at any scale.**

---

## 💡 What We Built

NearDead is a **real-time emergency dispatch intelligence system** that gives dispatchers a single, AI-ranked answer: *which hospital should this ambulance go to right now?*

It is built to work in **any city** — plug in hospitals, configure capacity, and the system is live. Bangalore is our current demo city, but the platform is city-agnostic by design.

It combines:
- **Live hospital capacity** (ER beds, ICU, ventilators, wait times)
- **Condition-specific capability matching** (cath lab for cardiac, trauma center for accidents, NICU for pediatric)
- **Real-time drive ETAs** via Mapbox routing
- **Gemini 2.5 Flash** as the decision brain — with a rule-based fallback that always works

The dispatcher sees **3 ranked recommendations with plain-English reasoning** in under 4 seconds.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🤖 **Gemini AI Dispatch** | Gemini 2.5 Flash ranks hospitals using a structured medical decision framework — capability match, live capacity, ETA, and tier |
| 🛡️ **Offline Fallback Ranker** | Pure rule-based scoring kicks in if Gemini is unavailable. The system **never goes dark** |
| 🗺️ **Live Route ETAs** | Mapbox Directions API calculates real drive time from the caller's location to each hospital |
| ⚡ **Realtime Capacity Updates** | Hospital status (beds, ICU, ER status) updates propagate to the dispatcher dashboard in < 2s via Supabase Realtime |
| 🎛️ **Dispatcher Dashboard** | React/Vite command surface purpose-built for speed — enter a case, see ranked cards, confirm the route |
| 🔴 **Demo Stress Mode** | Trigger a mass-casualty event to overflow Victoria Hospital and watch the AI instantly reroute |
| 📈 **Predictive Capacity** | ML predictor forecasts which hospitals will be overwhelmed in the next hour |
| 🏥 **Admin Hospital Panel** | Hospitals update their own ER status and bed count in real time |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Dispatcher Dashboard                      │
│              React + Vite + Mapbox GL JS                     │
└─────────────────────────┬────────────────────────────────────┘
                          │ REST  +  Supabase Realtime
┌─────────────────────────▼────────────────────────────────────┐
│                      FastAPI Backend                          │
│                                                              │
│   ┌─────────────┐   ┌──────────────┐   ┌─────────────────┐  │
│   │  /dispatch  │ → │capacity_     │ → │  ors_router.py  │  │
│   │  /recommend │   │filter.py     │   │ (Mapbox ETAs)   │  │
│   └─────────────┘   └──────────────┘   └────────┬────────┘  │
│                                                  │           │
│   ┌───────────────────────────────────────────── ▼ ────────┐ │
│   │              gemini_agent.py                           │ │
│   │   Gemini 2.5 Flash  →  fallback_ranker (always on)    │ │
│   └────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                   Supabase (Postgres + Realtime)              │
│         hospitals · incidents · capacity_snapshots           │
└──────────────────────────────────────────────────────────────┘
```

---

## 🤖 How the AI Makes Decisions

The Gemini dispatch agent uses a **4-factor priority framework** (hardcoded in its system prompt):

1. **Capability Match** *(non-negotiable)* — Cardiac needs a cath lab. Stroke needs neurology. Trauma needs a trauma center. A hospital that can't treat the condition is disqualified.

2. **Current Capacity** — ER status (`open` / `caution` / `overwhelmed`) adds a time penalty. Overwhelmed adds 60 minutes to effective wait. Zero ER beds = disqualified unless no alternative exists.

3. **Time to Treatment** — `ETA + effective wait`. A hospital 5 km away with 2 min wait beats a 1 km hospital with 90 min wait.

4. **Hospital Tier & Specialty Depth** — All else equal, prefer Tier 1. More matching specialties = better outcome.

> **Fallback guarantee:** If Gemini is down, rate-limited, or returns unparseable JSON, the rule-based `fallback_ranker` fires automatically. It uses the same 4-factor logic in pure Python. The dispatcher never sees an error.

---

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- A Supabase project (or run in demo mode without it)

### 1. Clone & Configure

```bash
git clone https://github.com/noentity0/NearDead.git
cd NearDead
cp .env.example .env
# Fill in your keys in .env
```

### 2. Run the Backend

```bash
cd backend
pip install -r requirements.txt
# Optional: for Supabase + Gemini integrations
pip install -r requirements-integrations.txt

# Run from the project root:
uvicorn backend.main:app --reload --app-dir ..
```

> **No `.env`?** No problem. The API runs against an in-memory demo store with pre-seeded Bangalore hospital data. Zero setup required.

### 3. Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 4. (Optional) Seed Supabase

```bash
# 1. Run data/supabase_setup.sql in the Supabase SQL editor
# 2. Then:
python data/seed_neardead.py
```

---

## 🎬 Demo Walkthrough

This is the 5-step demo flow to show all system capabilities:

| Step | Action | What You See |
|------|--------|--------------|
| 1 | Load the dispatcher dashboard | Live hospital map of Bangalore with capacity indicators |
| 2 | Enter a cardiac case near MG Road | Condition form auto-fills sensible defaults |
| 3 | Click **"Find Hospital"** | Gemini returns 3 ranked hospitals in ~2s with plain-English reasoning |
| 4 | Confirm Rank #1 (Manipal) | Route locked, incident created, ETA displayed |
| 5 | Click **"Stress Victoria"** | Victoria Hospital goes to `overwhelmed`, dashboard updates live |
| 6 | Click **"Run Prediction"** | ML predictor flags which hospitals will hit capacity in 60 min |

> **Demo city:** Bangalore. Expected result: Manipal Hospital (East) ranks above Victoria despite being farther away — because Victoria has no cath lab and is overwhelmed. The same logic applies to any city's hospital network.

---

## 📡 API Reference

Base URL: `http://localhost:8000`

> The API is city-agnostic. Hospital data, coordinates, and capacity are loaded from your database — swap the seed data for any city.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/v1/hospitals` | List all hospitals with live capacity |
| `POST` | `/v1/dispatch/recommend` | **Core endpoint.** Get AI-ranked hospital recommendations |
| `POST` | `/v1/dispatch/confirm` | Confirm a dispatch decision, lock the route |
| `POST` | `/v1/incidents` | Log a new incident manually |
| `POST` | `/v1/demo/stress-event` | Trigger a mass-casualty demo event |
| `POST` | `/v1/predictions/run` | Run the capacity predictor |

### Example: Dispatch Request

```json
POST /v1/dispatch/recommend
{
  "caller_lat": 12.9757,
  "caller_lng": 77.6011,
  "caller_address": "MG Road, Bengaluru",
  "condition_type": "cardiac",
  "condition_notes": "55yo male, chest pain, possible STEMI",
  "is_critical": true,
  "patient_age": 55,
  "patient_gender": "male"
}
```

### Example: Response

```json
{
  "incident_id": "uuid-...",
  "source": "gemini",
  "recommendations": [
    {
      "rank": 1,
      "hospital_name": "Manipal Hospital (Old Airport Road)",
      "eta_minutes": 7,
      "distance_km": 2.8,
      "confidence": 0.94,
      "reasoning": "Manipal has a functioning cath lab and 6 ICU beds free. Cardiac patient arrives in 7 min with 15 min wait — 22 min to treatment, vs Victoria's 4 min ETA but 185 min wait and no cath lab.",
      "source": "gemini"
    }
  ]
}
```

---

## 📁 Project Structure

```
NearDead/
├── backend/                  # FastAPI application
│   ├── main.py               # App entry point, CORS, router registration
│   ├── routers/
│   │   ├── dispatch.py       # Core dispatch pipeline
│   │   ├── hospitals.py      # Hospital capacity CRUD
│   │   ├── incidents.py      # Incident logging
│   │   ├── predictions.py    # Capacity forecasting
│   │   └── demo.py           # Demo / stress-test controls
│   ├── services/
│   │   ├── capacity_filter.py  # Hard filter: remove hospitals that can't treat condition
│   │   ├── ors_router.py       # Mapbox Directions ETAs
│   │   ├── predictor.py        # ML capacity predictor
│   │   └── demo_store.py       # In-memory demo hospital data
│   └── db/
│       ├── client.py           # Supabase client
│       └── queries.py          # All DB queries
│
├── services/
│   └── gemini_agent.py       # Gemini 2.5 Flash dispatch brain + fallback ranker
│
├── frontend/                 # React + Vite dispatcher dashboard
│   └── src/
│       ├── App.jsx
│       ├── components/
│       │   ├── DispatchPanel.jsx       # Main case entry form
│       │   ├── RecommendCard.jsx       # Hospital recommendation card
│       │   ├── Map.jsx                 # Mapbox live map
│       │   ├── HospitalDrawer.jsx      # Hospital detail drawer
│       │   ├── AlertBanner.jsx         # Real-time alert system
│       │   ├── DispatcherConsole.jsx   # Full dispatcher command view
│       │   ├── AdminForm.jsx           # Hospital admin panel
│       │   ├── DemoCenter.jsx          # Demo controls
│       │   └── FamilyTracker.jsx       # Patient family tracking view
│       ├── hooks/
│       │   ├── useHospitals.js         # Live hospital capacity hook
│       │   ├── useDispatch.js          # Dispatch workflow hook
│       │   ├── useIncidents.js         # Incidents feed hook
│       │   └── useAlerts.js            # Alert system hook
│       └── lib/
│           ├── api.js                  # API client
│           ├── supabase.js             # Supabase realtime client
│           └── constants.js            # Condition types, config
│
├── data/
│   ├── supabase_setup.sql    # Full Supabase schema
│   └── seed_neardead.py      # Seeds 10 Bangalore hospitals with realistic data
│
├── .env.example              # Template for environment variables
└── README.md
```

---

## 🔑 Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Optional | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Optional | Supabase service role key (backend) |
| `SUPABASE_ANON_KEY` | Optional | Supabase anon key |
| `GEMINI_API_KEY` | Optional | Google Gemini API key (falls back to rule-based ranker if absent) |
| `MAPBOX_TOKEN` | Optional | Mapbox token for routing and map display |
| `VITE_API_BASE` | Required | Backend URL for frontend (`http://localhost:8000/v1`) |

> The system is fully functional **without any keys** — it runs entirely in demo mode with in-memory data.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python · FastAPI · Uvicorn |
| **AI** | Google Gemini 2.5 Flash |
| **Frontend** | React 18 · Vite · Mapbox GL JS |
| **Database** | Supabase (Postgres + Realtime) |
| **Routing** | Mapbox Directions API |
| **Auth / Realtime** | Supabase |

---

## 👥 Team

Built with ❤️ for Bangalore's emergency services.

---

<div align="center">
<sub>NearDead — Because the right hospital, at the right time, saves lives.</sub>
</div>
