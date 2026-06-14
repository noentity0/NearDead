import { useState, useEffect } from 'react';
import Map from './Map.jsx';

const CONDITION_META = {
  cardiac:     { icon: '❤️‍🔥', label: 'Cardiac Arrest',       color: '#ff3b3b' },
  trauma:      { icon: '🩹',    label: 'Trauma',                color: '#f59e0b' },
  stroke:      { icon: '🧠',    label: 'Stroke',                color: '#a78bfa' },
  respiratory: { icon: '🫁',    label: 'Respiratory Failure',   color: '#60a5fa' },
  pediatric:   { icon: '👶',    label: 'Pediatric Emergency',   color: '#34d399' },
  burn:        { icon: '🔥',    label: 'Burn Injury',           color: '#fb923c' },
  obstetric:   { icon: '🤱',    label: 'Obstetric Emergency',   color: '#f472b6' },
  other:       { icon: '🏥',    label: 'Medical Emergency',     color: '#94a3b8' },
};

function LoadBar({ percent, status }) {
  const color =
    status === 'overwhelmed' ? 'var(--red)' :
    status === 'caution'     ? 'var(--amber)' :
    'var(--green)';
  return (
    <div className="cmdLoadBar">
      <div
        className="cmdLoadBarFill"
        style={{ width: `${Math.min(100, percent || 0)}%`, background: color }}
      />
    </div>
  );
}

function Timer({ startedAt }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  return <span className="cmdHeroStatNum">{mm}:{ss}</span>;
}

export default function EmergencyCommandView({
  activeCase,
  setActiveCase,
  recommendation,
  routedHospitals,
  selectedHospital,
  setSelectedHospital,
  dispatchResult,
  dispatchLoading,
  isRerouting,
  rerouteCount,
  startedAt,
  onLocationPinned,
}) {
  const meta = CONDITION_META[activeCase?.condition_type] || CONDITION_META.other;
  const top = recommendation;
  const load = top?.load_percentage ?? 0;

  const statusLabel = dispatchLoading
    ? 'ROUTING…'
    : isRerouting
    ? 'REROUTING…'
    : top
    ? 'DISPATCHED'
    : 'STANDBY';

  const statusClass = dispatchLoading || isRerouting ? 'routing' : top ? 'active' : 'idle';

  return (
    <div className="cmdRoot">

      {/* ── COMPACT INFO STRIP (overlaid on top of map area) ── */}
      <div className="cmdInfoStrip">
        <div className="cmdInfoStripLeft">
          <div className={`cmdStatusChip ${statusClass}`}>
            <span className="cmdStatusDot" />
            <span>{statusLabel}</span>
          </div>
          <div className="cmdInfoStripTitle">
            <span className="cmdInfoStripIcon" style={{ color: meta.color }}>{meta.icon}</span>
            <h1 className="cmdInfoStripHeading">{meta.label}</h1>
            {activeCase?.is_critical && (
              <span className="cmdHeroCritical">🔴 CRITICAL</span>
            )}
          </div>
          <div className="cmdHeroMeta">
            <span className="cmdHeroMetaIcon">📍</span>
            <span>{activeCase?.caller_address?.split(',')[0] || 'MG Road'}</span>
          </div>
        </div>

        <div className="cmdInfoStripRight">
          <div className="cmdInfoStatPill">
            <span>⏱ Dispatch</span>
            <Timer startedAt={startedAt} />
          </div>
          {top && (
            <div className="cmdInfoStatPill accent">
              <span>🤖 AI</span>
              <strong>{Math.round((top.confidence || 0) * 100)}%</strong>
            </div>
          )}
          {rerouteCount > 0 && (
            <div className="cmdInfoStatPill warn">
              <span>🔀 Reroutes</span>
              <strong>{rerouteCount}</strong>
            </div>
          )}
        </div>
      </div>

      {/* ── FULL-HEIGHT MAP STAGE ─────────────────────────── */}
      <div className="cmdMapFull">
        {dispatchLoading && !top && (
          <div className="cmdMapOverlay">
            <div className="cmdMapSpinner" />
            <p>Auto-routing to best available hospital…</p>
          </div>
        )}
        <Map
          hospitals={routedHospitals}
          selectedHospital={selectedHospital}
          onSelectHospital={setSelectedHospital}
          recommendations={dispatchResult?.recommendations}
          callLocation={activeCase}
          onCallLocationChange={setActiveCase}
          onCallLocationCommit={onLocationPinned}
        />

        {/* ── FLOATING DESTINATION SIDEBAR ─────────────────── */}
        <aside className="cmdFloatPanel">
          {!top ? (
            <div className="cmdHospitalEmpty">
              <div className="cmdHospitalEmptyIcon">🏥</div>
              <p>Calculating best route…</p>
            </div>
          ) : (
            <>
              <div className="cmdHospitalHeader">
                <span className="cmdHospitalBadge">Destination</span>
                <h2 className="cmdHospitalName">{top.name}</h2>
                <p className="cmdHospitalAddr">📍 {top.address}</p>
                <span className={`cmdHospitalStatus ${top.er_status}`}>
                  {top.er_status?.toUpperCase()}
                </span>
              </div>

              {/* ETA row */}
              <div className="cmdEtaRow">
                <div className="cmdEtaCell">
                  <span>Drive</span>
                  <strong>{top.eta_minutes ?? '--'} min</strong>
                </div>
                <div className="cmdEtaDivider" />
                <div className="cmdEtaCell">
                  <span>Wait</span>
                  <strong>{top.wait_time_minutes ?? '--'} min</strong>
                </div>
                <div className="cmdEtaDivider" />
                <div className="cmdEtaCell">
                  <span>Total</span>
                  <strong className="total">
                    {top.eta_minutes != null && top.wait_time_minutes != null
                      ? `${Number(top.eta_minutes) + Number(top.wait_time_minutes)} min`
                      : '--'}
                  </strong>
                </div>
              </div>

              {/* Load meter */}
              <div className="cmdLoadBlock">
                <div className="cmdLoadHeader">
                  <span className="cmdInfoLabel" style={{ marginBottom: 0 }}>ER capacity load</span>
                  <span
                    className="cmdLoadPct"
                    style={{
                      color:
                        top.er_status === 'overwhelmed' ? 'var(--red-bright)' :
                        top.er_status === 'caution'      ? 'var(--amber)' :
                        'var(--green)'
                    }}
                  >
                    {Math.round(load)}%
                  </span>
                </div>
                <LoadBar percent={load} status={top.er_status} />
              </div>

              {/* Bed stats */}
              <div className="cmdBedGrid">
                <div className="cmdBedCell">
                  <strong>{top.available_er_beds ?? '?'}</strong>
                  <span>ER beds</span>
                </div>
                <div className="cmdBedCell">
                  <strong>{top.available_icu_beds ?? '?'}</strong>
                  <span>ICU beds</span>
                </div>
                <div className="cmdBedCell">
                  <strong>{top.available_ventilators ?? '?'}</strong>
                  <span>Vents</span>
                </div>
                <div className="cmdBedCell">
                  <strong>{top.wait_time_minutes ?? '?'}m</strong>
                  <span>Wait</span>
                </div>
              </div>

              {/* Capabilities */}
              {(top.has_icu || top.has_cath_lab || top.has_trauma_center || top.has_blood_bank) && (
                <div className="cmdCapabilities">
                  <span className="cmdInfoLabel">Active capabilities</span>
                  <div className="cmdCapPills">
                    {top.has_cath_lab      && <span>❤️ Cath Lab</span>}
                    {top.has_icu           && <span>🏥 ICU</span>}
                    {top.has_trauma_center && <span>🚑 Trauma</span>}
                    {top.has_blood_bank    && <span>🩸 Blood Bank</span>}
                    {top.blood_o_neg       && <span>🔴 O-Neg</span>}
                  </div>
                </div>
              )}

              {/* AI Reasoning */}
              {top.reasoning && (
                <div className="cmdReasonBlock">
                  <div className="cmdReasonLabel">✦ AI routing decision</div>
                  <p className="cmdReason">"{top.reasoning}"</p>
                </div>
              )}

              {/* Fallback hospitals */}
              {dispatchResult?.recommendations?.length > 1 && (
                <div className="cmdAlternatives">
                  <span className="cmdInfoLabel">Fallback hospitals</span>
                  {dispatchResult.recommendations.slice(1, 3).map((r, i) => (
                    <div key={r.hospital_id} className="cmdAltRow">
                      <span className="cmdAltRank">#{i + 2}</span>
                      <span className="cmdAltName">{r.hospital_name}</span>
                      <span className="cmdAltEta">{r.eta_minutes}m ETA</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
