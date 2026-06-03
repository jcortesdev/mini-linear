'use client';

import { type KeySequenceMatcher, createKeySequenceMatcher } from '@/lib/key-sequence';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CommandPalette } from './command-palette';

type PaletteContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  /**
   * Set when "New issue" is picked from the palette while the creator may
   * not be mounted yet (e.g. user is on /board). The creator subscribes and
   * consumes it on mount; the regular `c` shortcut bypasses this entirely.
   */
  pendingNewIssue: boolean;
  requestNewIssue: () => void;
  consumePendingNewIssue: () => void;
  /**
   * Opens the palette with the input pre-filled with `query`. Used by the
   * `?` shortcut to deep-link into the Keyboard Shortcuts group.
   */
  openWithSearch: (query: string) => void;
  pendingSearch: string | null;
  consumePendingSearch: () => void;
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
  const [open, setOpenInternal] = useState(false);
  const [pendingNewIssue, setPendingNewIssue] = useState(false);
  const [pendingSearch, setPendingSearch] = useState<string | null>(null);
  const router = useRouter();
  const matcherRef = useRef<KeySequenceMatcher | null>(null);
  // Radix Dialog's FocusScope snapshots `activeElement` at mount, but cmdk's
  // Command.Input auto-focuses synchronously during the same render — so the
  // snapshot ends up being the input itself. On close FocusScope's restore
  // target is gone and focus falls to <body>. We snapshot the trigger here
  // before each open and restore it ourselves on the close transition.
  const triggerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  const snapshotFocus = useCallback(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;
  }, []);

  const setOpen = useCallback(
    (next: boolean) => {
      if (next) snapshotFocus();
      setOpenInternal(next);
    },
    [snapshotFocus]
  );

  // Restore focus to whatever opened the palette (topbar trigger, or whatever
  // element was focused when ⌘K fired). See triggerRef in the context type
  // for why Radix's built-in FocusScope can't be trusted here.
  useEffect(() => {
    if (wasOpenRef.current && !open) {
      const target = triggerRef.current;
      if (target && document.contains(target)) {
        target.focus();
      }
    }
    wasOpenRef.current = open;
  }, [open]);

  const requestNewIssue = useCallback(() => setPendingNewIssue(true), []);
  const consumePendingNewIssue = useCallback(() => setPendingNewIssue(false), []);

  const openWithSearch = useCallback(
    (query: string) => {
      snapshotFocus();
      setPendingSearch(query);
      setOpenInternal(true);
    },
    [snapshotFocus]
  );
  const consumePendingSearch = useCallback(() => setPendingSearch(null), []);

  // ⌘K / Ctrl+K toggle works from anywhere — even inside form inputs — so
  // users can summon the palette without re-focusing. preventDefault overrides
  // Chrome's omnibox-search shortcut on Windows/Linux.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isToggle = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (!isToggle) return;
      if (event.altKey || event.shiftKey) return;
      event.preventDefault();
      setOpenInternal((prev) => {
        const next = !prev;
        if (next) snapshotFocus();
        return next;
      });
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [snapshotFocus]);

  // Leader-key sequences (`g i`, `g b`, `?`) — skip while the palette has the
  // keyboard or while the user is typing in a form field.
  useEffect(() => {
    const matcher = createKeySequenceMatcher({
      sequences: [
        { keys: ['g', 'i'], onMatch: () => router.push('/issues') },
        { keys: ['g', 'b'], onMatch: () => router.push('/board') },
        { keys: ['?'], onMatch: () => openWithSearch('shortcut') },
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
  }, [open, router, openWithSearch]);

  const value = useMemo<PaletteContextValue>(
    () => ({
      open,
      setOpen,
      pendingNewIssue,
      requestNewIssue,
      consumePendingNewIssue,
      openWithSearch,
      pendingSearch,
      consumePendingSearch,
    }),
    [
      open,
      setOpen,
      pendingNewIssue,
      requestNewIssue,
      consumePendingNewIssue,
      openWithSearch,
      pendingSearch,
      consumePendingSearch,
    ]
  );

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
