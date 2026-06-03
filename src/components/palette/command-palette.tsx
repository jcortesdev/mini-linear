'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { usePalette } from './palette-provider';

export function CommandPalette() {
  const { open, setOpen } = usePalette();

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
      </Command.List>
    </Command.Dialog>
  );
}
