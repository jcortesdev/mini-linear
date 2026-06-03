'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { KanbanSquare, ListTodo } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { usePalette } from './palette-provider';

export function CommandPalette() {
  const { open, setOpen } = usePalette();
  const router = useRouter();

  function go(path: string) {
    setOpen(false);
    router.push(path);
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      overlayClassName="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm data-[state=open]:opacity-100 data-[state=closed]:opacity-0 motion-reduce:transition-none transition-opacity duration-150"
      contentClassName="fixed left-1/2 top-[18%] z-[100] w-[640px] max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xl outline-none data-[state=open]:opacity-100 data-[state=closed]:opacity-0 motion-reduce:transition-none transition-opacity duration-150 dark:border-zinc-800 dark:bg-zinc-950"
    >
      {/* Radix Dialog requires a Title + Description for screen readers; cmdk
          does not inject them automatically. */}
      <Dialog.Title className="sr-only">Command palette</Dialog.Title>
      <Dialog.Description className="sr-only">
        Search and run commands. Use arrow keys to navigate, enter to confirm, escape to close.
      </Dialog.Description>

      <Command.Input
        placeholder="Search or run a command…"
        className="w-full border-b border-zinc-200 bg-transparent px-4 py-3 text-sm text-zinc-900 placeholder-zinc-500 outline-none dark:border-zinc-800 dark:text-zinc-100"
      />
      <Command.List className="max-h-[400px] overflow-y-auto p-1">
        <Command.Empty className="px-3 py-6 text-center text-sm text-zinc-500">
          No results.
        </Command.Empty>

        <Command.Group
          heading="Navigation"
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-zinc-500"
        >
          <PaletteItem
            value="go to issues"
            icon={<ListTodo aria-hidden="true" className="h-4 w-4" />}
            label="Go to Issues"
            shortcut={['g', 'i']}
            onSelect={() => go('/issues')}
          />
          <PaletteItem
            value="go to board"
            icon={<KanbanSquare aria-hidden="true" className="h-4 w-4" />}
            label="Go to Board"
            shortcut={['g', 'b']}
            onSelect={() => go('/board')}
          />
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}

type PaletteItemProps = {
  value: string;
  icon: React.ReactNode;
  label: string;
  shortcut?: readonly string[];
  onSelect: () => void;
};

function PaletteItem({ value, icon, label, shortcut, onSelect }: PaletteItemProps) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-700 outline-none data-[selected=true]:bg-zinc-100 data-[selected=true]:text-zinc-900 dark:text-zinc-300 dark:data-[selected=true]:bg-zinc-800 dark:data-[selected=true]:text-zinc-100"
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-zinc-500">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="flex shrink-0 gap-1">
          {shortcut.map((key) => (
            <kbd
              key={key}
              className="rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
            >
              {key}
            </kbd>
          ))}
        </span>
      )}
    </Command.Item>
  );
}
