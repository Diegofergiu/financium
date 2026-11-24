'use client';

import { useEffect, useState } from 'react';

export interface DollarQuote {
  casa: string;
  nombre: string;
  compra: number | null;
  venta: number | null;
  fechaActualizacion?: string;
}

const CACHE_KEY = 'mibolsillo:dolar';
const MANUAL_KEY = 'mibolsillo:dolar-manual';
const PREF_KEY = 'mibolsillo:dolar-casa';
const TTL = 30 * 60 * 1000;

/** Cotizaciones del dólar en Argentina (dolarapi.com), con caché de 30 minutos. */
export function useDollarQuotes(enabled: boolean) {
  const [quotes, setQuotes] = useState<DollarQuote[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached?.data) setQuotes(cached.data);
      if (cached && Date.now() - cached.at < TTL) return;
    } catch {}
    const ctrl = new AbortController();
    fetch('https://dolarapi.com/v1/dolares', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: DollarQuote[]) => {
        setQuotes(data);
        setError(false);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
        } catch {}
      })
      .catch(() => setError(true));
    return () => ctrl.abort();
  }, [enabled]);

  return { quotes, error };
}

export function getPreferredCasa() {
  try {
    return localStorage.getItem(PREF_KEY) || 'blue';
  } catch {
    return 'blue';
  }
}
export function setPreferredCasa(c: string) {
  try {
    localStorage.setItem(PREF_KEY, c);
  } catch {}
}
export function getManualRate(): number | null {
  try {
    const v = Number(localStorage.getItem(MANUAL_KEY));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}
export function setManualRate(v: number | null) {
  try {
    if (v && v > 0) localStorage.setItem(MANUAL_KEY, String(v));
    else localStorage.removeItem(MANUAL_KEY);
  } catch {}
}
