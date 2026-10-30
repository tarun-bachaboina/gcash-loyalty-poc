import { Moon, Sun } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

/** Shared by every app (one origin in the production build). No stored value = follow the OS. */
const KEY = 'gcash:theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

/** Effective theme plus a setter that persists the choice and forces it via <html data-theme>. */
export function useTheme() {
  const [pref, setPref] = useState<Theme | null>(stored);
  const [osDark, setOsDark] = useState(() => media().matches);

  useEffect(() => {
    if (pref) document.documentElement.dataset.theme = pref;
    else delete document.documentElement.dataset.theme;
  }, [pref]);

  useEffect(() => {
    const mq = media();
    const onMq = () => setOsDark(mq.matches);
    const onStorage = (e: StorageEvent) => e.key === KEY && setPref(stored());
    mq.addEventListener('change', onMq);
    window.addEventListener('storage', onStorage);
    return () => {
      mq.removeEventListener('change', onMq);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const theme: Theme = pref ?? (osDark ? 'dark' : 'light');
  const setTheme = useCallback((t: Theme) => {
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* private mode: still applies for this page */
    }
    setPref(t);
  }, []);
  return { theme, setTheme };
}

/** Sun/moon switch for the dark app headers (blue, navy, slate). */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const dark = theme === 'dark';
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
      className={`grid size-11 shrink-0 place-items-center rounded-full text-white transition-colors duration-150 hover:bg-white/12 ${className ?? ''}`}
    >
      {dark ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
    </button>
  );
}
