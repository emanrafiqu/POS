import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';

/**
 * Loads async data with loading/error state and a `reload` function.
 * Guards against state updates after unmount.
 */
export function useAsyncData(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (alive.current) setData(result);
    } catch (err) {
      console.error('[useAsyncData]', err);
      if (alive.current) {
        setError(err);
        toast.error(err.message || 'Failed to load data.');
      }
    } finally {
      if (alive.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    alive.current = true;
    load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  return { data, loading, error, reload: load };
}
