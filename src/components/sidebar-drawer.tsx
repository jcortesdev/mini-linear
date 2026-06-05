'use client';

import { Sidebar } from '@/components/sidebar';
import * as Dialog from '@radix-ui/react-dialog';
import { useReducedMotion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';

type SidebarDrawerContextValue = {
  open: boolean;
  setOpen: (next: boolean) => void;
};

const SidebarDrawerContext = createContext<SidebarDrawerContextValue | null>(null);

/**
 * Mobile sidebar wired as a Radix Dialog drawer. Below `lg` the static sidebar
 * is hidden (see Sidebar's responsive classes) and this dialog handles the
 * navigation surface. Above `lg` the dialog never mounts; its trigger button
 * is hidden too.
 *
 * Closing on route change keeps the drawer from sticking around after the
 * user navigates — Radix's autoClose-on-link-click pattern doesn't apply
 * because the nav items are Next `<Link>`s, not Dialog primitives.
 */
export function SidebarDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const pathname = usePathname();

  // Close on every navigation. Reading pathname to satisfy exhaustive-deps;
  // setOpen is stable, and firing `false` when already closed is a no-op.
  useEffect(() => {
    void pathname;
    setOpen(false);
  }, [pathname]);

  return (
    <SidebarDrawerContext.Provider value={{ open, setOpen }}>
      {children}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay
            className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden ${
              reducedMotion
                ? ''
                : 'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
            }`}
          />
          <Dialog.Content
            aria-label="Workspace navigation"
            className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[80vw] flex-col bg-zinc-50 shadow-xl outline-none dark:bg-zinc-950 lg:hidden ${
              reducedMotion
                ? ''
                : 'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left'
            }`}
          >
            <Dialog.Title className="sr-only">Workspace navigation</Dialog.Title>
            <div className="flex items-center justify-end px-2 py-2">
              <Dialog.Close
                aria-label="Close navigation"
                className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Dialog.Close>
            </div>
            <Sidebar variant="drawer" />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </SidebarDrawerContext.Provider>
  );
}

export function useSidebarDrawer(): SidebarDrawerContextValue {
  const ctx = useContext(SidebarDrawerContext);
  if (!ctx) throw new Error('useSidebarDrawer must be used inside SidebarDrawerProvider');
  return ctx;
}

/**
 * Hamburger trigger rendered in the topbar. Hidden at `lg` and above because
 * the static sidebar is visible there and there's nothing to drawer-open.
 */
export function SidebarDrawerTrigger() {
  const { setOpen } = useSidebarDrawer();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Open workspace navigation"
      className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-700 transition hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-300 dark:hover:bg-zinc-900 lg:hidden"
    >
      <Menu className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
