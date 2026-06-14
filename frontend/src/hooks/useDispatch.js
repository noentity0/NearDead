import { useState } from 'react';
import { api } from '../lib/api.js';

export function useDispatch() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function recommend(payload) {
    setLoading(true);
    setError('');
    try {
      const data = await api.recommend(payload);
      setResult(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function confirm(hospitalId) {
    if (!result?.incident_id) return null;
    return api.confirm({
      incident_id: result.incident_id,
      hospital_id: hospitalId,
      dispatcher_override: false
    });
  }

  return { result, loading, error, recommend, confirm };
}

