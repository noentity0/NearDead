import { useEffect, useState } from 'react';

export default function RerouteAlert({ event, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!event) return;
    setVisible(true);
    setProgress(100);

    // countdown bar
    const start = Date.now();
    const duration = 8000;
    const tick = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining === 0) {
        clearInterval(tick);
        setVisible(false);
        onDismiss?.();
      }
    }, 80);

    return () => clearInterval(tick);
  }, [event?.id]);

  if (!visible || !event) return null;

  return (
    <div className="rerouteAlert" role="alert">
      <div className="rerouteAlertInner">
        {/* Left: Danger icon */}
        <div className="rerouteIcon">
          <span>⚠️</span>
        </div>

        {/* Center: Route change info */}
        <div className="rerouteContent">
          <div className="rerouteTitle">
            🔄 AUTO-REROUTING IN PROGRESS
          </div>
          <div className="rerouteHospitals">
            <div className="rerouteFrom">
              <span className="rerouteLabel">OVERWHELMED</span>
              <strong>{event.fromHospital}</strong>
            </div>
            <div className="rerouteArrow">→</div>
            <div className="rerouteTo">
              <span className="rerouteLabel">NEW DESTINATION</span>
              <strong>{event.toHospital}</strong>
            </div>
          </div>
          <p className="rerouteReason">{event.reason}</p>
        </div>

        {/* Right: ETA update */}
        <div className="rerouteEtaBadge">
          <span>New ETA</span>
          <strong>{event.newEta} min</strong>
        </div>

        {/* Dismiss */}
        <button className="rerouteDismiss" onClick={() => { setVisible(false); onDismiss?.(); }}>
          ✕
        </button>
      </div>

      {/* Countdown progress bar */}
      <div className="rerouteProgress">
        <div className="rerouteProgressBar" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
