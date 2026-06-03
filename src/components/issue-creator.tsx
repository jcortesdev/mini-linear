'use client';

import { usePalette } from '@/components/palette/palette-provider';
import { useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { Plus } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

type Mode = 'collapsed' | 'expanded';

export function IssueCreator() {
  const [mode, setMode] = useState<Mode>('collapsed');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  const create = useMutation(api.issues.create).withOptimisticUpdate((localStore, args) => {
    const existing = localStore.getQuery(api.issues.list, {});
    if (existing === undefined) return;
    const nextNumber = existing.reduce((max, i) => Math.max(max, i.number), 0) + 1;
    localStore.setQuery(api.issues.list, {}, [
      ...existing,
      {
        _id: crypto.randomUUID() as Id<'issues'>,
        number: nextNumber,
        title: args.title.trim(),
        status: 'backlog',
        priority: 'no_priority',
        createdAt: Date.now(),
        assignee: null,
        labels: [],
      },
    ]);
  });

  const expand = useCallback(() => {
    setMode('expanded');
    setError(null);
  }, []);

  const collapse = useCallback(() => {
    setMode('collapsed');
    setTitle('');
    setError(null);
  }, []);

  useEffect(() => {
    if (mode === 'expanded') {
      inputRef.current?.focus();
    }
  }, [mode]);

  // Subscribe to "New issue" requests from the command palette. Fires once
  // when `pendingNewIssue` flips to true (and the creator is mounted — if the
  // user navigates from /board, this effect runs on mount with the flag set).
  // The rAF refocus is for the already-expanded case: expand() is a no-op so
  // the mode-change focus effect won't fire, but Radix Dialog has just sent
  // focus back to the topbar trigger on close.
  const palette = usePalette();
  useEffect(() => {
    if (palette.pendingNewIssue) {
      expand();
      palette.consumePendingNewIssue();
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [palette.pendingNewIssue, palette.consumePendingNewIssue, expand]);

  // `c` from anywhere opens the creator. Skip when the user is already typing
  // in a form field, editing content, or holding a modifier — those collisions
  // would feel buggy (e.g. ctrl+c to copy).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'c') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return;
        }
      }
      event.preventDefault();
      expand();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [expand]);

  async function submit() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Title is required.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await create({ title: trimmed });
      setTitle('');
      // Stay expanded so the user can rip off several in a row.
      inputRef.current?.focus();
    } catch (err) {
      const message =
        err instanceof ConvexError && typeof err.data === 'string'
          ? err.data
          : 'Could not create issue. Try again.';
      setError(message);
    } finally {
      setPending(false);
    }
  }

  if (mode === 'collapsed') {
    return (
      <div className="border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <button
          type="button"
          onClick={expand}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        >
          <Plus aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>
            New issue <kbd className="ml-1 font-mono text-[10px] text-zinc-500">c</kbd>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-2 py-1.5 focus-within:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-within:border-zinc-500"
      >
        <Plus aria-hidden="true" className="h-4 w-4 shrink-0 text-zinc-500" />
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              collapse();
            }
          }}
          placeholder="Issue title"
          aria-label="New issue title"
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          disabled={pending}
          maxLength={200}
          className="flex-1 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 outline-none disabled:opacity-60 dark:text-zinc-100"
        />
        <span className="hidden text-[10px] text-zinc-500 sm:inline">
          <kbd className="font-mono">enter</kbd> to add · <kbd className="font-mono">esc</kbd> to
          cancel
        </span>
      </form>
      {error && (
        <p id={errorId} role="alert" className="mt-1 px-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
