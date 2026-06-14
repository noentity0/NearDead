import { useState } from 'react';
import RecommendCard from './RecommendCard.jsx';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const CONDITION_ICONS = {
  cardiac: '❤️‍🔥',
  trauma: '🩹',
  stroke: '🧠',
  respiratory: '🫁',
  pediatric: '👶',
  burn: '🔥',
  obstetric: '🤱',
  other: '🏥'
};

const DEFAULT_FORM = {
  condition_type: 'cardiac',
  condition_notes: '55yo male, chest pain radiating to left arm, sweating. Possible STEMI.',
  caller_address: 'MG Road, Bengaluru',
  caller_lat: 12.9757,
  caller_lng: 77.6011,
  patient_age: 55,
  patient_gender: 'male',
  is_critical: true
};

export default function DispatchPanel({ dispatch, onConfirmed, onCaseChange }) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [confirmed, setConfirmed] = useState('');
  const [pinning, setPinning] = useState(false);

  function update(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      onCaseChange?.(next);
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    setConfirmed('');
    await dispatch.recommend(form);
  }

  async function pinTypedLocation() {
    if (!MAPBOX_TOKEN || !form.caller_address) return;
    setPinning(true);
    try {
      const params = new URLSearchParams({
        access_token: MAPBOX_TOKEN,
        proximity: '77.5946,12.9716',
        country: 'in',
        limit: '1'
      });
      const query = encodeURIComponent(form.caller_address);
      const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?${params}`);
      const payload = await response.json();
      const center = payload.features?.[0]?.center;
      if (!center) return;
      setForm((current) => {
        const next = {
          ...current,
          caller_lng: Number(center[0].toFixed(6)),
          caller_lat: Number(center[1].toFixed(6)),
          caller_address: payload.features[0].place_name || current.caller_address
        };
        onCaseChange?.(next);
        return next;
      });
    } finally {
      setPinning(false);
    }
  }

  async function confirm(hospitalId) {
    const response = await dispatch.confirm(hospitalId);
    setConfirmed('Route confirmed — ambulance en route.');
    onConfirmed?.(response);
  }

  return (
    <aside className="dispatchPanel">
      <div className="sectionHeader">
        <span>108 Intake</span>
        <strong>Target &lt; 8 sec</strong>
      </div>

      <form onSubmit={submit} className="intakeForm">
        <label>
          🏷️ Emergency Condition
          <select
            id="select-condition-type"
            value={form.condition_type}
            onChange={(e) => update('condition_type', e.target.value)}
          >
            {Object.entries(CONDITION_ICONS).map(([val, icon]) => (
              <option key={val} value={val}>
                {icon} {val.charAt(0).toUpperCase() + val.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label>
          📍 Caller Location
          <input
            id="input-caller-address"
            value={form.caller_address}
            onChange={(e) => update('caller_address', e.target.value)}
            placeholder="Enter address or landmark..."
          />
        </label>

        <button
          id="btn-pin-location"
          className="secondaryButton"
          type="button"
          onClick={pinTypedLocation}
          disabled={pinning || !MAPBOX_TOKEN}
        >
          {pinning ? '⏳ Pinning...' : '📌 Pin on Map'}
        </button>

        <div className="fieldGrid">
          <label>
            Latitude
            <input
              id="input-lat"
              type="number"
              step="0.0001"
              value={form.caller_lat}
              onChange={(e) => update('caller_lat', Number(e.target.value))}
            />
          </label>
          <label>
            Longitude
            <input
              id="input-lng"
              type="number"
              step="0.0001"
              value={form.caller_lng}
              onChange={(e) => update('caller_lng', Number(e.target.value))}
            />
          </label>
        </div>

        <label>
          📋 Clinical Notes
          <textarea
            id="input-condition-notes"
            value={form.condition_notes}
            onChange={(e) => update('condition_notes', e.target.value)}
            placeholder="Describe symptoms, vitals, patient condition..."
          />
        </label>

        <label
          className="checkRow"
          htmlFor="checkbox-critical"
          style={{ cursor: 'pointer' }}
        >
          <input
            id="checkbox-critical"
            type="checkbox"
            checked={form.is_critical}
            onChange={(e) => update('is_critical', e.target.checked)}
          />
          <span style={{ color: form.is_critical ? 'var(--red)' : 'var(--text-secondary)', fontWeight: 700, fontSize: '13px' }}>
            {form.is_critical ? '🔴 Critical Case' : '⚪ Standard Case'}
          </span>
        </label>

        <button
          id="btn-find-hospital"
          className="primaryButton"
          type="submit"
          disabled={dispatch.loading}
          style={{ width: '100%', padding: '12px', fontSize: '14px' }}
        >
          {dispatch.loading ? '⏳ Finding best hospital...' : '🔍 Find Hospital'}
        </button>
      </form>

      {dispatch.error && <p className="errorText" style={{ marginTop: '10px' }}>⚠️ {dispatch.error}</p>}
      {confirmed && <p className="successText" style={{ marginTop: '10px' }}>✅ {confirmed}</p>}

      <div className="recommendList">
        {dispatch.result?.recommendations?.map((recommendation) => (
          <RecommendCard
            key={recommendation.hospital_id}
            recommendation={recommendation}
            onConfirm={confirm}
          />
        ))}
      </div>
    </aside>
  );
}
