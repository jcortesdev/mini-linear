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
 * This provider keeps state in sync after hydration and persists user choices
 * to localStorage.
 *
 * Both `mode` and `resolved` start at deterministic defaults so SSR and the
 * first client render produce identical output (otherwise the toggle's
 * `aria-pressed` and active classes differ → hydration mismatch warning).
 * A mount-once effect reads the real values (localStorage + the data-theme
 * attribute the anti-flash script set on <html>) and pushes them into state.
 * Until that effect runs, we leave `<html data-theme>` alone — the anti-flash
 * script is the source of truth for the very first paint.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [resolved, setResolved] = useState<ResolvedTheme>('light');
  const [hydrated, setHydrated] = useState(false);

  // Mount-once: sync React state to what the anti-flash script + localStorage
  // already established. After this fires, the data-theme effect below takes
  // over and pushes future changes into the DOM.
  useEffect(() => {
    const stored = readStoredMode();
    const dom = document.documentElement.dataset.theme;
    setModeState(stored);
    setResolved(dom === 'dark' ? 'dark' : 'light');
    setHydrated(true);
  }, []);

  // Keep <html data-theme> in sync with `resolved` — but only after the
  // initial sync above, so we don't overwrite the anti-flash value during
  // the first commit.
  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.dataset.theme = resolved;
  }, [hydrated, resolved]);

  // Recompute the resolved theme whenever the mode changes (post-hydration).
  useEffect(() => {
    if (!hydrated) return;
    setResolved(resolveTheme(mode));
  }, [hydrated, mode]);

  // Follow OS changes live when in 'system' mode.
  useEffect(() => {
    if (!hydrated || mode !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      setResolved(event.matches ? 'dark' : 'light');
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [hydrated, mode]);

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
