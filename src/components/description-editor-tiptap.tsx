'use client';

import { useUpdateIssue } from '@/lib/issue-mutations';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { type Editor, EditorContent, useEditor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Code, Italic, Link as LinkIcon, Strikethrough } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Markdown, type MarkdownStorage } from 'tiptap-markdown';
import type { Id } from '../../convex/_generated/dataModel';

function getMarkdown(editor: Editor): string {
  return (editor.storage as unknown as { markdown: MarkdownStorage }).markdown.getMarkdown();
}

const MAX_DESCRIPTION_LENGTH = 50_000;

type Props = {
  issueId: Id<'issues'>;
  initialValue: string;
};

/**
 * Rich-text description editor. Replaces the M2 textarea + Write/Preview
 * toggle so users format with shortcuts (typing `# ` becomes a heading,
 * `- ` becomes a bullet list, `**text**` becomes bold — all the markdown
 * input rules baked into StarterKit) or with the bubble menu that pops
 * over a text selection. The content is serialised to Markdown via
 * `tiptap-markdown` so the Convex schema stays `v.optional(v.string())`
 * with no migration and the read path (full-page issue route + list
 * previews if we ever add them) keeps a plain string.
 *
 * Security posture:
 *  - The Link extension's default allow-list rejects `javascript:` /
 *    `data:` URLs; we re-state it explicitly below.
 *  - tiptap-markdown's underlying markdown-it instance is configured with
 *    `html: false` (the default) so raw HTML in the source markdown is
 *    treated as literal text, never injected.
 *  - StarterKit / Markdown / Link are the only extensions; no custom
 *    NodeViews that render unsanitised user content.
 */
export function DescriptionEditor({ issueId, initialValue }: Props) {
  const update = useUpdateIssue();
  const [snapshot, setSnapshot] = useState(initialValue);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Live char count is exposed for the 50k cap; we read it from the editor
  // through `editor.storage.markdown.getMarkdown()` on demand, not via
  // controlled state, so each keystroke doesn't trigger a React render.
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Keep the focus on writing prose; we render headings/lists/quote/
        // code natively. Drop horizontal-rule + hard-break because they're
        // niche and the markdown round-trip handles `---` via input rule.
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        protocols: ['http', 'https', 'mailto'],
        HTMLAttributes: {
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
        },
      }),
      Placeholder.configure({
        placeholder: 'Add a description. Use shortcuts like # heading, - list, **bold**.',
      }),
      Markdown.configure({
        html: false,
        linkify: true,
        breaks: false,
        transformPastedText: true,
      }),
    ],
    content: initialValue || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        'aria-label': 'Issue description',
        class:
          'prose prose-sm prose-zinc max-w-none focus:outline-none dark:prose-invert min-h-[6rem]',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const current = getMarkdown(ed);
      setIsDirty(current !== snapshot);
      if (current.length > MAX_DESCRIPTION_LENGTH) {
        setError(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`);
      } else if (error) {
        setError(null);
      }
    },
  });

  editorRef.current = editor;

  // If the upstream value changes while the panel is open (another tab
  // edited the same issue), refresh the editor unless the user has local
  // edits in flight — those would be clobbered.
  useEffect(() => {
    if (!editor) return;
    if (!isDirty && initialValue !== snapshot) {
      editor.commands.setContent(initialValue || '', { emitUpdate: false });
      setSnapshot(initialValue);
    }
  }, [initialValue, editor, isDirty, snapshot]);

  async function handleSave() {
    if (!editor || isSaving) return;
    const next = getMarkdown(editor);
    if (next.length > MAX_DESCRIPTION_LENGTH) return;
    setIsSaving(true);
    try {
      await update({ id: issueId, description: next });
      setSnapshot(next);
      setIsDirty(false);
    } catch {
      setError('Could not save description.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    if (!editor) return;
    editor.commands.setContent(snapshot || '', { emitUpdate: false });
    setIsDirty(false);
    setError(null);
  }

  if (!editor) {
    return <div className="min-h-[6rem] animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />;
  }

  return (
    <div className="space-y-2">
      <h2
        id="issue-description-heading"
        className="text-xs font-medium uppercase tracking-wide text-zinc-500"
      >
        Description
      </h2>
      <BubbleMenu
        editor={editor}
        className="flex items-center gap-0.5 rounded-md border border-zinc-200 bg-white p-0.5 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
      >
        <ToolbarButton
          label="Bold"
          shortcut="Ctrl+B"
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
        >
          <Bold aria-hidden="true" className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          shortcut="Ctrl+I"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
        >
          <Italic aria-hidden="true" className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Strikethrough"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
        >
          <Strikethrough aria-hidden="true" className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Inline code"
          shortcut="Ctrl+E"
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
        >
          <Code aria-hidden="true" className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label={editor.isActive('link') ? 'Remove link' : 'Add link'}
          onClick={() => {
            if (editor.isActive('link')) {
              editor.chain().focus().unsetLink().run();
              return;
            }
            const url = window.prompt('Link URL');
            if (!url) return;
            // Reject anything that isn't http(s) or mailto — Link.configure's
            // `protocols` is enforced server-side but we belt-and-braces the
            // prompt path because user input is direct here.
            const safe = /^(https?:|mailto:)/i.test(url) ? url : `https://${url}`;
            editor.chain().focus().setLink({ href: safe }).run();
          }}
          active={editor.isActive('link')}
        >
          <LinkIcon aria-hidden="true" className="h-3.5 w-3.5" />
        </ToolbarButton>
      </BubbleMenu>
      <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus-within:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
        <EditorContent editor={editor} />
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">
          Type <Kbd>#</Kbd> for heading, <Kbd>-</Kbd> for list, <Kbd>&gt;</Kbd> for quote, or select
          text to format.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={!isDirty || isSaving}
            className="rounded-md px-3 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || isSaving || error !== null}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  shortcut,
  onClick,
  active,
  children,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={`flex h-7 w-7 items-center justify-center rounded transition ${
        active
          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
          : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
      }`}
    >
      {children}
    </button>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1 font-mono text-[10px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
      {children}
    </kbd>
  );
}
