# NearDead MVP Task Split

## Critical Path

1. Backend dispatch loop
   - Owner: backend/AI
   - Files: `backend/routers/dispatch.py`, `backend/services/capacity_filter.py`, `backend/services/ors_router.py`, `services/gemini_agent.py`
   - Done when: `POST /v1/dispatch/recommend` returns 3 ranked hospitals in under 4 seconds with fallback working.

2. Dispatcher dashboard
   - Owner: frontend
   - Files: `frontend/src/components/DispatchPanel.jsx`, `frontend/src/components/RecommendCard.jsx`, `frontend/src/App.jsx`
   - Done when: dispatcher enters a case, sees 3 ranked cards, and confirms the route.

3. Hospital capacity loop
   - Owner: backend/frontend
   - Files: `backend/routers/hospitals.py`, `frontend/src/components/AdminForm.jsx`, `frontend/src/hooks/useHospitals.js`
   - Done when: changing hospital status updates the dashboard within 2 seconds.

4. Demo controls
   - Owner: demo person
   - Files: `backend/routers/demo.py`, `data/seed_neardead.py`
   - Done when: Victoria can be stressed on cue and alert banner changes.

## Independent Work Packages

### Data/Supabase
- Run `data/supabase_setup.sql` in Supabase.
- Run `python data/seed_neardead.py`.
- Validate `get_hospital_current_status()` returns 10 rows.

### Backend
- Start with the local demo store, then wire Supabase by adding `.env`.
- Add ORS network routing only after fallback routing is stable.
- Keep Gemini optional; fallback ranker must always work.

### Frontend
- Keep the first screen as the dispatcher command surface.
- Replace the coordinate map in `Map.jsx` with Mapbox only after the API flow works.
- Add Supabase Realtime after polling behavior is verified.

### ML/Prediction
- Use `backend/services/predictor.py` for round 1.
- Promote to `ml/` only after there is real snapshot history.

## Build Order

1. Verify backend local demo mode.
2. Verify frontend can call backend.
3. Run one cardiac case from MG Road.
4. Confirm Manipal ranks above Victoria.
5. Trigger `POST /v1/demo/stress-event`.
6. Run `POST /v1/predictions/run`.
7. Replace local store with Supabase.
8. Add Mapbox and Supabase Realtime polish.

