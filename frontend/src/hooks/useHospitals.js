import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { supabase } from '../lib/supabase.js';

export function useHospitals() {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const data = await api.hospitals();
      setHospitals(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 10000);
    const channel = supabase
      ?.channel('hospital-capacity')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'capacity_snapshots' },
        () => refresh()
      )
      .subscribe();

    return () => {
      window.clearInterval(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { hospitals, loading, error, refresh };
}
