import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  /** Re-run; keeps showing the previous data while refreshing. */
  reload: () => Promise<void>;
}

/** Minimal data loader: runs `fn` on mount and when `deps` change; ignores stale responses. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(true);
  const call = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(async () => {
    const id = ++call.current;
    setLoading(true);
    try {
      const result = await fnRef.current();
      if (id === call.current) {
        setData(result);
        setError(undefined);
      }
    } catch (e) {
      if (id === call.current) setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (id === call.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload };
}
