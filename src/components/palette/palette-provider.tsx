'use client';

import { type KeySequenceMatcher, createKeySequenceMatcher } from '@/lib/key-sequence';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CommandPalette } from './command-palette';

type PaletteContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const PaletteContext = createContext<PaletteContextValue | null>(null);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const matcherRef = useRef<KeySequenceMatcher | null>(null);

  // ⌘K / Ctrl+K toggle works from anywhere — even inside form inputs — so
  // users can summon the palette without re-focusing. preventDefault overrides
  // Chrome's omnibox-search shortcut on Windows/Linux.
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

  // Leader-key sequences (`g i`, `g b`) — skip while the palette has the
  // keyboard or while the user is typing in a form field.
  useEffect(() => {
    const matcher = createKeySequenceMatcher({
      sequences: [
        { keys: ['g', 'i'], onMatch: () => router.push('/issues') },
        { keys: ['g', 'b'], onMatch: () => router.push('/board') },
      ],
    });
    matcherRef.current = matcher;

    function onKeyDown(event: KeyboardEvent) {
      if (open) return;
      if (isEditableTarget(event.target)) return;
      matcher.handleKeyDown(event);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      matcher.reset();
    };
  }, [open, router]);

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
