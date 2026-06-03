'use client';

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
          className="pointer-events-auto fixed inset-y-0 right-0 z-50 w-full max-w-2xl border-l border-zinc-200 bg-white shadow-xl outline-none dark:border-zinc-800 dark:bg-zinc-950"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ duration, ease: 'easeOut' }}
        >
          <IssueDetailPanel id={id} onClose={() => setOpen(false)} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
