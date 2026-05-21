import { useState, useEffect } from 'react';
import { api } from '../api/client';

/**
 * Fetches a GET endpoint and returns { data, loading, error, refetch }.
 * Re-fetches whenever `url` changes.
 */
export function useFetch(url) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [tick,  setTick]  = useState(0);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    setState(s => ({ ...s, loading: true, error: null }));
    api.get(url)
      .then(d  => alive && setState({ data: d, loading: false, error: null }))
      .catch(e => alive && setState({ data: null, loading: false, error: e.message }));
    return () => { alive = false; };
  }, [url, tick]);

  return { ...state, refetch: () => setTick(t => t + 1) };
}
