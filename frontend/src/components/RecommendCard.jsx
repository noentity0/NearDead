export default function RecommendCard({ recommendation, onConfirm }) {
  const confidence = Math.round((recommendation.confidence || 0) * 100);
  const isTop = recommendation.rank === 1;

  // Color the load bar based on confidence
  const barColor = confidence >= 80
    ? 'linear-gradient(90deg, var(--green), var(--teal))'
    : confidence >= 50
    ? 'linear-gradient(90deg, var(--amber), #f59e0b)'
    : 'linear-gradient(90deg, var(--red), #ff6b6b)';

  return (
    <article className={`recommendCard rank${recommendation.rank}`}>
      <div className="recommendHeader">
        <span className="rank">#{recommendation.rank}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>{recommendation.hospital_name}</h3>
          <p>📍 {recommendation.distance_km} km away</p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <strong style={{ display: 'block' }}>{recommendation.eta_minutes} min</strong>
          <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>ETA</span>
        </div>
      </div>

      {isTop && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,179,0,0.1))',
          border: '1px solid rgba(255,215,0,0.3)',
          color: '#ffd700',
          fontSize: '10px',
          fontWeight: 800,
          padding: '3px 10px',
          borderRadius: '999px',
          marginBottom: '8px',
          letterSpacing: '0.5px',
        }}>
          ✦ Best Match
        </div>
      )}

      <div className="confidenceTrack" aria-label={`Confidence ${confidence}%`}>
        <span style={{ width: `${confidence}%`, background: barColor }} />
      </div>

      <div className="metaRow">
        <span>{confidence}% confidence</span>
        <span style={{ color: 'var(--teal)', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
          {recommendation.source}
        </span>
      </div>

      {recommendation.reasoning && (
        <p className="reasoning">{recommendation.reasoning}</p>
      )}

      {isTop && (
        <button
          id={`btn-confirm-route-${recommendation.hospital_id}`}
          className="primaryButton"
          style={{ width: '100%', marginTop: '4px' }}
          onClick={() => onConfirm(recommendation.hospital_id)}
        >
          ✓ Confirm &amp; Dispatch Route
        </button>
      )}
    </article>
  );
}
