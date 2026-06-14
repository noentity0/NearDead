const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/v1';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }
  return response.json();
}

export const api = {
  hospitals: () => request('/hospitals'),
  alerts: () => request('/predictions/alerts'),
  incidents: () => request('/incidents/active'),
  recommend: (payload) =>
    request('/dispatch/recommend', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  confirm: (payload) =>
    request('/dispatch/confirm', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateCapacity: (hospitalId, payload) =>
    request(`/hospitals/${hospitalId}/capacity`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  runPrediction: () => request('/predictions/run', { method: 'POST' }),
  stress: (hospitalId) =>
    request('/demo/stress-event', {
      method: 'POST',
      body: JSON.stringify({ hospital_id: hospitalId, severity: 'critical' })
    }),
  reset: () => request('/demo/reset', { method: 'POST' })
};

