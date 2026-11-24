'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';
const KEY = 'mibolsillo:theme';
const SIZE_KEY = 'mibolsillo:text-size';
export type TextSize = 'normal' | 'large' | 'xl';
const SIZES: Record<TextSize, string> = { normal: '100%', large: '112.5%', xl: '125%' };

/** Script que se ejecuta antes de pintar para evitar el "parpadeo" de tema. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${KEY}')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';var s=localStorage.getItem('${SIZE_KEY}');var m={large:'112.5%',xl:'125%'};if(m[s])document.documentElement.style.fontSize=m[s];}catch(e){}})();`;

const ThemeContext = createContext<{ theme: ThemePref; setTheme: (t: ThemePref) => void; textSize: TextSize; setTextSize: (s: TextSize) => void }>({
  theme: 'system',
  setTheme: () => {},
  textSize: 'normal',
  setTextSize: () => {},
});

function apply(theme: ThemePref) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]:not([media])');
  if (meta) meta.setAttribute('content', dark ? '#0f1715' : '#fbfaf7');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>('system');
  const [textSize, setTextSizeState] = useState<TextSize>('normal');

  useEffect(() => {
    try {
      const s = localStorage.getItem(SIZE_KEY) as TextSize;
      if (s && SIZES[s]) setTextSizeState(s);
    } catch {}
  }, []);

  const setTextSize = useCallback((s: TextSize) => {
    setTextSizeState(s);
    document.documentElement.style.fontSize = SIZES[s];
    try {
      localStorage.setItem(SIZE_KEY, s);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      setThemeState((localStorage.getItem(KEY) as ThemePref) || 'system');
    } catch {}
  }, []);

  useEffect(() => {
    apply(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((t: ThemePref) => {
    setThemeState(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {}
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme, textSize, setTextSize }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
