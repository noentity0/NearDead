export default function AlertBanner({ alerts, onRunPrediction }) {
  const alert = alerts[0];
  const isCritical = alert?.alert_type === 'capacity_critical';

  return (
    <div className={`alertBanner ${isCritical ? 'critical' : ''}`} role="alert">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '20px', flexShrink: 0 }}>
          {isCritical ? '🚨' : '📡'}
        </span>
        <div>
          <span>
            {alert
              ? alert.alert_type.replace(/_/g, ' ')
              : 'Prediction watch'}
          </span>
          <strong>
            {alert
              ? alert.message
              : 'No active capacity alerts — system nominal.'}
          </strong>
        </div>
        {alerts.length > 1 && (
          <span style={{
            background: 'var(--red-dim)',
            border: '1px solid rgba(255,59,59,0.3)',
            color: 'var(--red)',
            fontSize: '10px',
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: '999px',
            flexShrink: 0
          }}>
            +{alerts.length - 1} more
          </span>
        )}
      </div>
      <button id="btn-run-prediction" onClick={onRunPrediction}>
        ▶ Run prediction
      </button>
    </div>
  );
}
