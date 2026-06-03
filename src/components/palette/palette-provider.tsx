'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { CommandPalette } from './command-palette';

type PaletteContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const PaletteContext = createContext<PaletteContextValue | null>(null);

export function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  // Global ⌘K / Ctrl+K toggle. preventDefault overrides Chrome's
  // omnibox-search shortcut so the palette wins on Windows/Linux.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isToggle = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (!isToggle) return;
      if (event.altKey || event.shiftKey) return;
      event.preventDefault();
      setOpen((prev) => !prev);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const value = useMemo<PaletteContextValue>(() => ({ open, setOpen }), [open]);

  return (
    <PaletteContext.Provider value={value}>
      {children}
      <CommandPalette />
    </PaletteContext.Provider>
  );
}

export function usePalette() {
  const ctx = useContext(PaletteContext);
  if (!ctx) throw new Error('usePalette must be used inside a <PaletteProvider>.');
  return ctx;
}
