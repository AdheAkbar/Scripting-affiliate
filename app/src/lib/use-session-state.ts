import { useEffect, useState } from "react";

/** State yang bertahan saat pindah tab di aplikasi (sessionStorage), hilang saat app ditutup. */
export function useSessionState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // penyimpanan penuh/diblokir: state tetap jalan di memori
    }
  }, [key, value]);
  return [value, setValue] as const;
}
