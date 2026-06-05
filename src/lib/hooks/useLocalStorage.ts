'use client';

import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  // Always start with initialValue to match SSR output, then sync after mount
  const [stored, setStored] = useState<T>(initialValue);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setStored(JSON.parse(raw) as T);
    } catch {
      // corrupt entry — leave default
    }
  }, [key]);

  const setValue = (value: T | ((prev: T) => T)) => {
    setStored((prev) => {
      const next = value instanceof Function ? value(prev) : value;
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // storage unavailable (private mode quota, etc.)
      }
      return next;
    });
  };

  return [stored, setValue] as const;
}
