'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from 'convex/react';
import { Eye, Pencil } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { z } from 'zod';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

const MAX_DESCRIPTION_LENGTH = 50_000;

const descriptionSchema = z.object({
  description: z
    .string()
    .max(
      MAX_DESCRIPTION_LENGTH,
      `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`
    ),
});

type FormValues = z.infer<typeof descriptionSchema>;

type Props = {
  issueId: Id<'issues'>;
  initialValue: string;
};

/**
 * Description editor with a write/preview toggle (the decision locked at the
 * start of M2 — no split-pane, no WYSIWYG). react-hook-form + zod gives us
 * length validation messaging for free.
 */
export function DescriptionEditor({ issueId, initialValue }: Props) {
  const [mode, setMode] = useState<'preview' | 'edit'>(initialValue.trim() ? 'preview' : 'edit');
  const update = useMutation(api.issues.update).withOptimisticUpdate((localStore, args) => {
    if (args.description === undefined) return;
    const detail = localStore.getQuery(api.issues.get, { id: args.id });
    if (detail) {
      localStore.setQuery(
        api.issues.get,
        { id: args.id },
        { ...detail, description: args.description }
      );
    }
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(descriptionSchema),
    defaultValues: { description: initialValue },
  });

  const current = watch('description');

  async function onSubmit(values: FormValues) {
    try {
      await update({ id: issueId, description: values.description });
      reset({ description: values.description });
      if (values.description.trim()) setMode('preview');
    } catch {
      // Swallow — schema errors already surface via formState.errors and the
      // server-side validators are forgiving (any string length up to 50k).
    }
  }

  function cancel() {
    reset({ description: initialValue });
    if (initialValue.trim()) setMode('preview');
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Description</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode('edit')}
            aria-pressed={mode === 'edit'}
            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs transition ${
              mode === 'edit'
                ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <Pencil aria-hidden="true" className="h-3 w-3" />
            Write
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            aria-pressed={mode === 'preview'}
            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs transition ${
              mode === 'preview'
                ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <Eye aria-hidden="true" className="h-3 w-3" />
            Preview
          </button>
        </div>
      </div>

      {mode === 'edit' ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
          <textarea
            {...register('description')}
            aria-label="Issue description"
            aria-invalid={errors.description !== undefined}
            placeholder="Add a description. Markdown is supported."
            rows={6}
            className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-mono leading-relaxed text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          {errors.description && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {errors.description.message}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={cancel}
              disabled={isSubmitting}
              className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isDirty}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Save
            </button>
          </div>
        </form>
      ) : current.trim() ? (
        <div className="prose prose-sm prose-zinc max-w-none dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{current}</ReactMarkdown>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setMode('edit')}
          className="text-sm italic text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          No description. Click to add one.
        </button>
      )}
    </div>
  );
}
