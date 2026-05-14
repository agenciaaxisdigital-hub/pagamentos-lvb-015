import { useState, useCallback } from "react";

export function usePersistedState<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(key);
      return stored !== null ? (JSON.parse(stored) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setPersisted = useCallback((value: T | ((prev: T) => T)) => {
    setState(prev => {
      const next = typeof value === "function" ? (value as (p: T) => T)(prev) : value;
      try { sessionStorage.setItem(key, JSON.stringify(next)); } catch { /* sessionStorage pode estar cheio */ }
      return next;
    });
  }, [key]);

  return [state, setPersisted];
}
