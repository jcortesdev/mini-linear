'use client';

import { useTheme } from '@/components/theme-provider';
import { Monitor, Moon, Sun } from 'lucide-react';

const OPTIONS = [
  { value: 'light' as const, label: 'Light', icon: Sun },
  { value: 'system' as const, label: 'System', icon: Monitor },
  { value: 'dark' as const, label: 'Dark', icon: Moon },
];

/**
 * Three-segment switch for the active theme mode. Sits in the topbar; below
 * `sm` it collapses to icon-only buttons so it stays compact on phones.
 *
 * Uses `aria-pressed` on each segment instead of a `<select>` so the keyboard
 * and screen-reader UX matches the rest of the app's toggle-y controls (e.g.
 * the bubble menu buttons in the description editor).
 */
export function ThemeToggle() {
  const { mode, setMode } = useTheme();

  return (
    // `role="group"` with `aria-label` over `<fieldset>` here: this is a
    // toolbar-style segmented control, not a form-field grouping. Suppress
    // biome's semantic preference.
    // biome-ignore lint/a11y/useSemanticElements: see comment above.
    <div
      role="group"
      aria-label="Theme"
      className="flex h-8 items-center gap-0.5 rounded-md border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      {OPTIONS.map((option) => {
        const active = option.value === mode;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setMode(option.value)}
            aria-label={`Theme: ${option.label}`}
            aria-pressed={active}
            title={option.label}
            className={`flex h-7 w-7 items-center justify-center rounded transition ${
              active
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
            }`}
          >
            <Icon aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
