'use client';

import { useMediaQuery } from '@/lib/use-media-query';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Id } from '../../convex/_generated/dataModel';
import { IssueDetailPanel } from './issue-detail-panel';

type Props = {
  id: Id<'issues'>;
};

/**
 * Linear-style right-side slide-over rendered as a non-modal dialog: the list
 * behind stays interactive so the user can click another row to swap issues
 * without closing. Esc animates out, then returns focus to the row that opened
 * the panel.
 */
export function IssueDetailSlideOver({ id }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const reducedMotion = useReducedMotion();
  // Below `md` the panel slides up from the bottom as a full-screen sheet —
  // standard mobile pattern (iOS / Android both ship this). Above `md` it
  // keeps the desktop-style right-side slide-over.
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [open, setOpen] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    previousFocusRef.current = document.activeElement as HTMLElement | null;
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        setOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function handleExitComplete() {
    previousFocusRef.current?.focus?.();
    router.back();
  }

  if (!mounted) return null;

  const duration = reducedMotion ? 0 : 0.2;
  const variants = isMobile
    ? { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }
    : { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } };

  return createPortal(
    <AnimatePresence onExitComplete={handleExitComplete}>
      {open && (
        <motion.div
          ref={containerRef}
          // biome-ignore lint/a11y/useSemanticElements: native <dialog> with showModal() makes
          // the panel modal and blocks the underlying list — we want non-modal so the user can
          // click another row to swap issues without closing first (Linear-style).
          role="dialog"
          aria-labelledby="issue-detail-title"
          className="pointer-events-auto fixed inset-0 z-50 bg-white shadow-xl outline-none dark:bg-zinc-950 md:inset-y-0 md:left-auto md:right-0 md:w-full md:max-w-2xl md:border-l md:border-zinc-200 md:dark:border-zinc-800"
          initial={variants.initial}
          animate={variants.animate}
          exit={variants.exit}
          transition={{ duration, ease: 'easeOut' }}
        >
          <IssueDetailPanel id={id} onClose={() => setOpen(false)} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
