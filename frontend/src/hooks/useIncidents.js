import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { supabase } from '../lib/supabase.js';

export function useIncidents() {
  const [incidents, setIncidents] = useState([]);

  const refresh = useCallback(async () => {
    try {
      setIncidents(await api.incidents());
    } catch {
      setIncidents([]);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 10000);
    const channel = supabase
      ?.channel('active-incidents')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'active_incidents' },
        () => refresh()
      )
      .subscribe();

    return () => {
      window.clearInterval(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { incidents, refresh };
}
