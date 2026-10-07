import { useEffect, useState } from 'react';
import { apiRequest } from '../auth/client';
export function useResource<T>(path: string | null) {
  const [retry, setRetry] = useState(0);
  const key = `${path}:${retry}`;
  const [result, setResult] = useState<{
    key: string;
    data?: T;
    error?: string;
  }>({ key: '' });
  useEffect(() => {
    if (!path) return;
    let active = true;
    apiRequest<T>(path)
      .then((data) => {
        if (active) setResult({ key, data });
      })
      .catch((error: Error) => {
        if (active) setResult({ key, error: error.message });
      });
    return () => {
      active = false;
    };
  }, [path, key]);
  return {
    data: result.key === key ? result.data : undefined,
    error: result.key === key ? result.error : undefined,
    loading: !!path && result.key !== key,
    reload: () => setRetry((value) => value + 1),
    replace: (data: T) => setResult({ key, data }),
  };
}
