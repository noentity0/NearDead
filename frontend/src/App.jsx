import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import EmergencyCommandView from './components/EmergencyCommandView.jsx';
import RerouteAlert from './components/RerouteAlert.jsx';
import DemoFloatingPanel from './components/DemoFloatingPanel.jsx';
import { api } from './lib/api.js';
import { useAlerts } from './hooks/useAlerts.js';
import { useHospitals } from './hooks/useHospitals.js';
import { useIncidents } from './hooks/useIncidents.js';

/* ── Default emergency (demo: cardiac near MG Road) ─────────── */
const DEFAULT_CASE = {
  condition_type:   'cardiac',
  condition_notes:  '55yo male, chest pain radiating to left arm, sweating. Possible STEMI.',
  caller_address:   'MG Road, Bengaluru',
  caller_lat:       12.9757,
  caller_lng:       77.6011,
  patient_age:      55,
  patient_gender:   'male',
  is_critical:      true,
};

function distanceKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
    Math.cos((bLat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateEta(distKm) {
  return Math.max(3, Math.round((distKm / 24) * 60 + 2));
}

function useLiveClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

/* ── Poll interval ──────────────────────────────────────── */
const POLL_MS = 5_000; // check every 5 seconds for fast rerouting

export default function App() {
  const hospitals  = useHospitals();
  const alerts     = useAlerts();
  const incidents  = useIncidents();
  const clock      = useLiveClock();

  /* Dispatch state */
  const [dispatchResult, setDispatchResult]   = useState(null);
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [dispatchError, setDispatchError]     = useState(null);
  const [activeCase, setActiveCase] = useState(DEFAULT_CASE);

  /* Reroute state */
  const [rerouteEvent, setRerouteEvent]     = useState(null);  // { id, fromHospital, toHospital, reason, newEta }
  const [rerouteCount, setRerouteCount]     = useState(0);
  const [isRerouting, setIsRerouting]       = useState(false);
  const rerouteIdRef = useRef(0);

  /* Active hospital tracking */
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [startedAt] = useState(Date.now());

  /* ── Compute routed hospitals (merge dispatch results with hospital data) */
  const routedHospitals = useMemo(() => {
    const byId = new Map(
      dispatchResult?.recommendations?.map((r) => [r.hospital_id, r]) || []
    );
    return hospitals.hospitals.map((h) => {
      const dist = distanceKm(
        Number(activeCase.caller_lat), Number(activeCase.caller_lng),
        Number(h.lat), Number(h.lng)
      );
      return {
        ...h,
        distance_km:  Number(dist.toFixed(2)),
        eta_minutes:  estimateEta(dist),
        ...(byId.get(h.id) || {}),
      };
    });
  }, [activeCase, dispatchResult, hospitals.hospitals]);

  /* ── Top recommendation (merged with live hospital data) */
  const topRecommendationId = dispatchResult?.recommendations?.[0]?.hospital_id;
  const recommendation = useMemo(() => {
    if (!topRecommendationId) return null;
    const rec = dispatchResult.recommendations[0];
    const liveHospital = hospitals.hospitals.find((h) => h.id === topRecommendationId);
    return { ...liveHospital, ...rec };
  }, [topRecommendationId, hospitals.hospitals, dispatchResult]);

  /* ── Auto-dispatch: call recommend on mount ─────────────── */
  const recommend = useCallback(async (excludeIds = []) => {
    setDispatchLoading(true);
    setDispatchError(null);
    try {
      const payload = { ...activeCase };
      if (excludeIds.length > 0) payload.exclude_hospital_ids = excludeIds;
      const result = await api.recommend(payload);
      setDispatchResult(result);
      return result;
    } catch (err) {
      setDispatchError(err.message);
      return null;
    } finally {
      setDispatchLoading(false);
    }
  }, [activeCase]);

  /* On mount: auto-dispatch immediately */
  useEffect(() => {
    recommend();
  }, []);

  /* ── Polling: fetch FRESH data from API directly to avoid stale closure ── */
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!topRecommendationId || dispatchLoading) return;

      try {
        // ✅ Fetch fresh from API — don't read stale React state
        const freshHospitals = await api.hospitals();

        // Sync UI state too
        hospitals.refresh();
        alerts.refresh();

        // Check FRESH data for overwhelmed status
        const activeHospital = freshHospitals.find((h) => h.id === topRecommendationId);
        if (!activeHospital) return;

        if (activeHospital.er_status === 'overwhelmed') {
          const fromName = activeHospital.name || activeHospital.short_name;
          setIsRerouting(true);

          // Re-recommend excluding this overwhelmed hospital
          const newResult = await recommend([topRecommendationId]);

          setIsRerouting(false);

          if (newResult?.recommendations?.[0]) {
            const newTop = newResult.recommendations[0];
            // Find new hospital name from fresh list
            const newHospitalFresh = freshHospitals.find((h) => h.id === newTop.hospital_id);
            const toName = newTop.hospital_name || newHospitalFresh?.name || 'Next Hospital';

            // Fire reroute alert
            rerouteIdRef.current += 1;
            setRerouteEvent({
              id:           rerouteIdRef.current,
              fromHospital: fromName,
              toHospital:   toName,
              newEta:       newTop.eta_minutes,
              reason:       `${fromName} ER is overwhelmed. Auto-switching to next best facility.`,
            });
            setRerouteCount((c) => c + 1);
          }
        }
      } catch (err) {
        // Silently ignore polling errors (network hiccup etc.)
        console.warn('Poll error:', err.message);
      }
    }, POLL_MS);

    return () => clearInterval(interval);
  // Only re-create interval when the target hospital or dispatch state changes
  }, [topRecommendationId, dispatchLoading, recommend]);

  /* ── When hospitals refresh, also update dispatch result hospitals */
  const handleActionComplete = useCallback(async () => {
    await hospitals.refresh();
    await alerts.refresh();
    await incidents.refresh();
  }, []);

  const timeString = clock.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  const dateString = clock.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });

  return (
    <div className="appShell">
      {/* ── Slim topbar ──────────────────────────────────── */}
      <header className="cmdTopBar">
        <div className="cmdBranding">
          <span className="cmdBrandIcon">🚨</span>
          <div>
            <div className="cmdBrandName">NEARDEAD</div>
            <div className="cmdBrandSub">Emergency Routing System · Bangalore CATS</div>
          </div>
        </div>

        <div className="cmdTopClock">
          <div className="cmdClockTime">{timeString}</div>
          <div className="cmdClockDate">{dateString}</div>
        </div>

        <div className="cmdTopStats">
          <div className="cmdTopStat">
            <span className="cmdTopStatVal">{hospitals.hospitals.length}</span>
            <span className="cmdTopStatLabel">Hospitals</span>
          </div>
          <div className="cmdTopStat">
            <span className="cmdTopStatVal" style={{ color: incidents.incidents.length > 0 ? 'var(--amber)' : undefined }}>
              {incidents.incidents.length}
            </span>
            <span className="cmdTopStatLabel">Active</span>
          </div>
          <div className="cmdTopStat">
            <span className="cmdTopStatVal" style={{ color: alerts.alerts.length > 0 ? 'var(--red)' : undefined }}>
              {alerts.alerts.length}
            </span>
            <span className="cmdTopStatLabel">Alerts</span>
          </div>
          <div className="cmdLivePill">
            <span className="liveDot" />
            LIVE
          </div>
        </div>
      </header>

      {/* ── Reroute alert banner ─────────────────────────── */}
      <RerouteAlert
        event={rerouteEvent}
        onDismiss={() => setRerouteEvent(null)}
      />

      {/* ── Error toast ──────────────────────────────────── */}
      {dispatchError && (
        <div className="cmdErrorBanner">
          ⚠️ Dispatch API error: {dispatchError}
          <button onClick={() => recommend()}>Retry</button>
        </div>
      )}

      {/* ── Main command view ────────────────────────────── */}
      <EmergencyCommandView
        activeCase={activeCase}
        setActiveCase={setActiveCase}
        recommendation={recommendation}
        routedHospitals={routedHospitals}
        selectedHospital={selectedHospital}
        setSelectedHospital={setSelectedHospital}
        dispatchResult={dispatchResult}
        dispatchLoading={dispatchLoading}
        isRerouting={isRerouting}
        rerouteCount={rerouteCount}
        startedAt={startedAt}
        onLocationPinned={() => recommend()}
      />

      {/* ── Floating demo controls ───────────────────────── */}
      <DemoFloatingPanel
        hospitals={hospitals.hospitals}
        alerts={alerts.alerts}
        incidents={incidents.incidents}
        onActionComplete={handleActionComplete}
      />
    </div>
  );
}
