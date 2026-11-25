import { createContext, useContext, useEffect, useMemo, useState } from 'react';

/** Each theme is a set of CSS variables in index.css under [data-theme="<id>"]. */
export const THEMES = [
  { id: 'system', label: 'Match device', swatch: ['#1f6b5a', '#c97a4a', '#101614'] },
  { id: 'home', label: 'Home', swatch: ['#1f6b5a', '#2a8069', '#f6f3ec'] },
  { id: 'evening', label: 'Evening', swatch: ['#4fb596', '#66c9ab', '#101614'] },
  { id: 'sunset', label: 'Sunset', swatch: ['#ff5e62', '#8b5cf6', '#fff6f2'] },
  { id: 'midnight', label: 'Midnight', swatch: ['#ff6b8b', '#a855f7', '#120d24'] },
  { id: 'ocean', label: 'Ocean', swatch: ['#06b6d4', '#3b82f6', '#f1f8ff'] },
  { id: 'mango', label: 'Mango', swatch: ['#ff9f1c', '#f43f5e', '#fff8ec'] },
  { id: 'neon', label: 'Neon', swatch: ['#22d3ee', '#a3e635', '#0b0b10'] },
];

const KEY = 'roomie_theme';
const ThemeContext = createContext(null);
const systemTheme = () => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'evening' : 'home');

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(KEY) || 'system'; } catch { return 'system'; }
  });

  useEffect(() => {
    const apply = () => { document.documentElement.dataset.theme = theme === 'system' ? systemTheme() : theme; };
    apply();
    try { localStorage.setItem(KEY, theme); } catch { /* storage unavailable */ }
    if (theme !== 'system') return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
