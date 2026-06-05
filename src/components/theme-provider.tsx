'use client';

import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'mini-linear.theme';

type ThemeContextValue = {
  /** The user's selected mode — 'system' means "follow OS". */
  mode: ThemeMode;
  /** What the document is actually displaying right now. */
  resolved: ResolvedTheme;
  setMode: (next: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
}

function readSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === 'system' ? readSystemTheme() : mode;
}

/**
 * Three-way theme controller (light / dark / system). The actual `data-theme`
 * attribute is set by the inline anti-flash script in the root layout BEFORE
 * React hydrates, so the initial paint already matches the user's choice.
 * This provider keeps the state in sync after hydration and persists user
 * choices to localStorage.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initialise from localStorage so React's first render matches what the
  // anti-flash script already set. SSR returns 'system' — the inline script
  // reconciles before hydration so there's no flash.
  const [mode, setModeState] = useState<ThemeMode>(() =>
    typeof window === 'undefined' ? 'system' : readStoredMode()
  );
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    typeof window === 'undefined' ? 'light' : resolveTheme(readStoredMode())
  );

  // Apply the data-theme attribute whenever the resolution changes.
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  // Recompute the resolved theme whenever the mode changes.
  useEffect(() => {
    setResolved(resolveTheme(mode));
  }, [mode]);

  // When in 'system' mode, follow OS changes live.
  useEffect(() => {
    if (mode !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      setResolved(event.matches ? 'dark' : 'light');
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode / storage disabled — fall back to in-memory only.
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

/**
 * Stringified IIFE injected into <head> via `dangerouslySetInnerHTML`. Runs
 * synchronously before React hydration so the first paint matches the user's
 * stored preference (or system) — eliminates the dark-mode flash that would
 * otherwise occur for a light-mode user when the server returns the default.
 *
 * Keep this in lockstep with the constants in ThemeProvider: storage key,
 * data-theme attribute name, accepted values.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var mode = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    var resolved = mode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : mode;
    document.documentElement.setAttribute('data-theme', resolved);
  } catch (_) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`.trim();
