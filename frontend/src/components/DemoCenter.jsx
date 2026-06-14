import { useState } from 'react';
import { api } from '../lib/api.js';

export default function DemoCenter({ hospitals, alerts, incidents, onActionComplete }) {
  const [loading, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [systemLogs, setSystemLogs] = useState([
    { time: new Date().toLocaleTimeString(), message: 'NearDead system initialized successfully.', type: 'info' },
    { time: new Date().toLocaleTimeString(), message: 'Connected to in-memory local fallback store.', type: 'info' },
    { time: new Date().toLocaleTimeString(), message: 'Dispatch engine ready. Awaiting events.', type: 'success' },
  ]);

  function log(message, type = 'info') {
    setSystemLogs((current) => [
      { time: new Date().toLocaleTimeString(), message, type },
      ...current
    ]);
  }

  async function triggerStress() {
    setLoading(true);
    setActionSuccess('');
    const victoria = hospitals.find(
      (h) => h.short_name?.toLowerCase() === 'victoria' || h.name?.toLowerCase().includes('victoria')
    );
    if (!victoria) {
      log('Error: Victoria Hospital not found in database.', 'error');
      setLoading(false);
      return;
    }

    log(`POST /v1/demo/stress-event → hospital_id: ${victoria.id}`, 'api');
    try {
      await api.stress(victoria.id);
      log('Victoria stressed to 96% load. Available beds → 0. Wait time → 185 min.', 'success');
      log('Realtime broadcast: capacity_snapshot insert fired to all channels.', 'realtime');
      setActionSuccess('Victoria Hospital is now overwhelmed! Check the map.');
      await onActionComplete?.();
    } catch (err) {
      log(`API Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function triggerPrediction() {
    setLoading(true);
    setActionSuccess('');
    log('POST /v1/predictions/run → triggering capacity prediction sweep...', 'api');
    try {
      const response = await api.runPrediction();
      log(`Prediction model completed. Created ${response.created || 0} new alert(s).`, 'success');
      setActionSuccess(`Prediction engine completed! ${response.created || 0} alert(s) fired.`);
      await onActionComplete?.();
    } catch (err) {
      log(`API Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function triggerReset() {
    setLoading(true);
    setActionSuccess('');
    log('POST /v1/demo/reset → resetting all demo state...', 'api');
    try {
      await api.reset();
      log('All hospitals reset to baseline. Incidents and alerts cleared.', 'success');
      log('System restored. Ready for next demo run.', 'info');
      setActionSuccess('Database reset to baseline successfully!');
      await onActionComplete?.();
    } catch (err) {
      log(`API Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="demoCenterContainer">
      <div className="demoHeader">
        <h1>⚙️ Presenter Control Panel</h1>
        <p>Use these triggers to stage emergency surges and run simulations during the live demo.</p>
      </div>

      {actionSuccess && (
        <div className="portalSuccessMessage">✅ {actionSuccess}</div>
      )}

      <div className="demoLayout">
        {/* Controls Grid */}
        <div className="demoControlsCol">
          <div className="controlCard">
            <div className="cardBadge red">Stress Event</div>
            <h3>Simulate ER Collapse</h3>
            <p>
              Instantly sets <strong>Victoria Hospital</strong> to 96% capacity, sets
              available beds to 0, and wait time to 185 mins. Fires a critical alert immediately.
            </p>
            <button
              id="btn-stress-victoria"
              className="demoBtn danger"
              onClick={triggerStress}
              disabled={loading}
            >
              {loading ? '⏳ Executing...' : '🔴 Stress Victoria Hospital'}
            </button>
          </div>

          <div className="controlCard">
            <div className="cardBadge yellow">Prediction Run</div>
            <h3>Trigger Prediction Alert</h3>
            <p>
              Simulates the 15-minute background cron job. Evaluates live capacity loads
              and raises alert flags on hospitals exceeding 85% capacity.
            </p>
            <button
              id="btn-run-prediction-demo"
              className="demoBtn warning"
              onClick={triggerPrediction}
              disabled={loading}
            >
              {loading ? '⏳ Running model...' : '📊 Run Prediction Engine'}
            </button>
          </div>

          <div className="controlCard">
            <div className="cardBadge blue">System Reset</div>
            <h3>Clear Demo State</h3>
            <p>
              Resets all hospitals to baseline capacity profiles. Clears active incidents,
              alerts, and decision logs. Start fresh for the next demo.
            </p>
            <button
              id="btn-reset-demo"
              className="demoBtn secondary"
              onClick={triggerReset}
              disabled={loading}
            >
              {loading ? '⏳ Resetting DB...' : '🔄 Reset Demo Database'}
            </button>
          </div>
        </div>

        {/* Console / Status Logs */}
        <div className="demoConsoleCol">
          <div className="consoleHeader">
            <h3>system logs</h3>
            <span className="consoleBadge">Active</span>
          </div>
          <div className="consoleStage">
            <div className="consoleWindow">
              {systemLogs.map((entry, idx) => (
                <div key={idx} className={`consoleLine ${entry.type}`}>
                  <span className="lineTime">[{entry.time}]</span>
                  <span className="lineMessage">{entry.message}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="demoQuickStats">
            <h4>// seeded parameters</h4>
            <div className="quickStatsGrid">
              <div className="statCell">
                <span>hospitals</span>
                <strong>{hospitals.length}</strong>
              </div>
              <div className="statCell">
                <span>incidents</span>
                <strong>{incidents.length}</strong>
              </div>
              <div className="statCell">
                <span>alerts</span>
                <strong style={{ color: alerts.length > 0 ? 'var(--red)' : 'var(--teal)' }}>
                  {alerts.length}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
