import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { supabase } from '../lib/supabase.js';

export function useAlerts() {
  const [alerts, setAlerts] = useState([]);

  const refresh = useCallback(async () => {
    try {
      setAlerts(await api.alerts());
    } catch {
      setAlerts([]);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 10000);
    const channel = supabase
      ?.channel('prediction-alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'prediction_alerts' },
        () => refresh()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'prediction_alerts' },
        () => refresh()
      )
      .subscribe();

    return () => {
      window.clearInterval(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { alerts, refresh };
}
