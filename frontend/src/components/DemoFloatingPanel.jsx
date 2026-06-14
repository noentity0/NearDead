import { useState } from 'react';
import { api } from '../lib/api.js';

export default function DemoFloatingPanel({ hospitals, alerts, incidents, onActionComplete }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('hospitals'); // 'hospitals' | 'demo'
  const [loading, setLoading] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [feedback, setFeedback] = useState('');

  /* ── Demo actions ──────────────────────────────────────── */
  async function runDemo(action) {
    setLoading(action);
    setFeedback('');
    try {
      if (action === 'stress') {
        const victoria = hospitals.find(
          (h) => h.short_name?.toLowerCase() === 'victoria' || h.name?.toLowerCase().includes('victoria')
        );
        if (!victoria) { setFeedback('Victoria not found.'); return; }
        await api.stress(victoria.id);
        setFeedback('Victoria overwhelmed — watch for auto-reroute!');
      } else if (action === 'predict') {
        const res = await api.runPrediction();
        setFeedback(`Prediction run: ${res.created || 0} alert(s) created.`);
      } else if (action === 'reset') {
        await api.reset();
        setFeedback('System reset to baseline.');
      }
      await onActionComplete?.();
    } catch (err) {
      setFeedback(`Error: ${err.message}`);
    } finally {
      setLoading(null);
    }
  }

  /* ── Hospital status quick-set ─────────────────────────── */
  async function setHospitalStatus(hospital, status) {
    setSavingId(hospital.id + status);
    setFeedback('');
    try {
      const loadMap = { open: 45, caution: 75, overwhelmed: 97 };
      const bedMap  = { open: hospital.total_er_beds || 10, caution: Math.ceil((hospital.total_er_beds || 20) * 0.25), overwhelmed: 0 };
      await api.updateCapacity(hospital.id, {
        er_status: status,
        load_percentage: loadMap[status],
        available_er_beds: bedMap[status],
        wait_time_minutes: status === 'overwhelmed' ? 180 : status === 'caution' ? 45 : 15,
      });
      setFeedback(`${hospital.short_name || hospital.name} → ${status.toUpperCase()}`);
      await onActionComplete?.();
    } catch (err) {
      setFeedback(`Error: ${err.message}`);
    } finally {
      setSavingId(null);
    }
  }

  const STATUS_CONFIG = {
    open:        { label: 'Open',        color: 'var(--green)', bg: 'var(--green-dim)',  border: 'rgba(0,230,118,0.35)' },
    caution:     { label: 'Caution',     color: 'var(--amber)', bg: 'var(--amber-dim)',  border: 'rgba(245,158,11,0.35)' },
    overwhelmed: { label: 'Overwhelmed', color: 'var(--red)',   bg: 'var(--red-dim)',    border: 'rgba(255,59,59,0.35)' },
  };

  return (
    <>
      {/* ── Floating gear button ─────────────────────────── */}
      <button
        id="btn-demo-toggle"
        className="demoFab"
        onClick={() => setOpen((o) => !o)}
        title="Hospital Manager & Demo Controls"
      >
        {open ? '✕' : '⚙️'}
      </button>

      {/* ── Panel ───────────────────────────────────────── */}
      {open && (
        <div className="demoFabPanel">

          {/* Header with tabs */}
          <div className="demoFabHeader">
            <div className="demoFabTabs">
              <button
                className={`demoFabTab ${activeTab === 'hospitals' ? 'active' : ''}`}
                onClick={() => setActiveTab('hospitals')}
              >
                🏥 Hospitals
              </button>
              <button
                className={`demoFabTab ${activeTab === 'demo' ? 'active' : ''}`}
                onClick={() => setActiveTab('demo')}
              >
                ⚡ Demo
              </button>
            </div>
            <div className="demoFabStats">
              <span style={{ color: incidents.length > 0 ? 'var(--amber)' : undefined }}>
                {incidents.length} active
              </span>
              <span style={{ color: alerts.length > 0 ? 'var(--red)' : undefined }}>
                {alerts.length} alerts
              </span>
            </div>
          </div>

          {/* ── HOSPITALS TAB ────────────────────────────── */}
          {activeTab === 'hospitals' && (
            <div className="demoHospitalList">
              {hospitals.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
                  No hospitals loaded yet.
                </div>
              )}
              {hospitals.map((h) => {
                const cfg = STATUS_CONFIG[h.er_status] || STATUS_CONFIG.open;
                return (
                  <div key={h.id} className="demoHospitalCard">
                    {/* Hospital name + current status */}
                    <div className="demoHospitalTop">
                      <div className="demoHospitalName">{h.short_name || h.name}</div>
                      <span
                        className="demoHospitalCurrent"
                        style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
                      >
                        {h.er_status?.toUpperCase() || 'OPEN'}
                      </span>
                    </div>

                    {/* Load bar */}
                    <div className="demoHospitalMeta">
                      <span>{Math.round(h.load_percentage ?? 0)}% load</span>
                      <span>{h.available_er_beds ?? '?'} ER beds</span>
                      <span>{h.wait_time_minutes ?? '?'}m wait</span>
                    </div>
                    <div className="demoHospitalBar">
                      <div
                        className="demoHospitalBarFill"
                        style={{
                          width: `${Math.min(100, h.load_percentage ?? 0)}%`,
                          background: cfg.color,
                        }}
                      />
                    </div>

                    {/* Quick status buttons */}
                    <div className="demoStatusBtns">
                      {['open', 'caution', 'overwhelmed'].map((status) => {
                        const s = STATUS_CONFIG[status];
                        const isCurrent = h.er_status === status;
                        const isLoading = savingId === h.id + status;
                        return (
                          <button
                            key={status}
                            id={`btn-set-${h.id}-${status}`}
                            className="demoStatusBtn"
                            disabled={isCurrent || !!savingId}
                            onClick={() => setHospitalStatus(h, status)}
                            style={{
                              color: isCurrent ? s.color : 'var(--text-dim)',
                              background: isCurrent ? s.bg : 'var(--bg-glass)',
                              borderColor: isCurrent ? s.border : 'var(--border-subtle)',
                            }}
                          >
                            {isLoading ? '…' : s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── DEMO TAB ─────────────────────────────────── */}
          {activeTab === 'demo' && (
            <div className="demoFabActions">
              <button
                id="btn-stress-victoria-fab"
                className="demoFabBtn danger"
                onClick={() => runDemo('stress')}
                disabled={!!loading}
              >
                <span className="demoFabBtnIcon">🔴</span>
                <div>
                  <strong>Stress Victoria</strong>
                  <span>Trigger ER collapse → auto-reroute fires</span>
                </div>
                {loading === 'stress' && <span className="demoFabSpinner" />}
              </button>

              <button
                id="btn-predict-fab"
                className="demoFabBtn warning"
                onClick={() => runDemo('predict')}
                disabled={!!loading}
              >
                <span className="demoFabBtnIcon">📊</span>
                <div>
                  <strong>Run Prediction</strong>
                  <span>Evaluate capacity thresholds now</span>
                </div>
                {loading === 'predict' && <span className="demoFabSpinner" />}
              </button>

              <button
                id="btn-reset-fab"
                className="demoFabBtn secondary"
                onClick={() => runDemo('reset')}
                disabled={!!loading}
              >
                <span className="demoFabBtnIcon">🔄</span>
                <div>
                  <strong>Reset Database</strong>
                  <span>Restore all hospitals to baseline</span>
                </div>
                {loading === 'reset' && <span className="demoFabSpinner" />}
              </button>
            </div>
          )}

          {/* Feedback */}
          {feedback && (
            <div className="demoFabFeedback">✓ {feedback}</div>
          )}
        </div>
      )}
    </>
  );
}
