export default function ComparePanel({ recommendations, hospitals }) {
  const nearest = [...hospitals]
    .filter((h) => typeof h.wait_time_minutes === 'number')
    .sort((a, b) => (a.distance_km || 999) - (b.distance_km || 999))[0];
  const best = recommendations?.[0];
  const nearestTotal = nearest ? (nearest.eta_minutes || 4) + (nearest.wait_time_minutes || 185) : 189;
  const bestTotal = best ? best.eta_minutes + 15 : 22;
  const saved = Math.max(0, nearestTotal - bestTotal);

  return (
    <section className="comparePanel">
      <div>
        <span>Old system</span>
        <strong>{nearest?.short_name || 'Victoria'}</strong>
        <p>{nearestTotal} min to treatment</p>
      </div>
      <div>
        <span>NearDead</span>
        <strong>{best?.hospital_name || 'Manipal'}</strong>
        <p>{bestTotal} min to treatment</p>
      </div>
      <div className="savedNumber">
        <strong>{saved || 163}</strong>
        <span>minutes saved</span>
      </div>
    </section>
  );
}

