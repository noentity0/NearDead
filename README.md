# NearDead

NearDead is a Bangalore emergency routing MVP. It ranks hospitals by treatment capability, live capacity, wait time, and drive ETA.

## Current Structure

```text
backend/      FastAPI API, demo store, dispatch endpoints
data/         Supabase SQL and seed script
frontend/     React/Vite dispatcher dashboard
services/     Gemini dispatch agent and fallback ranker
```

## Run Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn backend.main:app --reload --app-dir ..
```

Without `.env`, the API runs against an in-memory demo store. With Supabase keys, it uses Supabase.
Install `backend/requirements-integrations.txt` only on a Python environment that can install Supabase/Gemini native dependencies cleanly.

Useful endpoints:

```text
GET  /health
GET  /v1/hospitals
POST /v1/dispatch/recommend
POST /v1/dispatch/confirm
POST /v1/demo/stress-event
POST /v1/predictions/run
```

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Demo Flow

1. Load the dashboard.
2. Keep the default cardiac case near MG Road.
3. Click `Find hospital`.
4. Confirm the rank 1 route.
5. Click `Stress Victoria`.
6. Click `Run prediction`.

The app is intentionally split so backend, frontend, data, and AI work can continue independently.
