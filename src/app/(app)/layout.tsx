import { PaletteProvider } from '@/components/palette/palette-provider';
import { Sidebar } from '@/components/sidebar';
import { SidebarDrawerProvider } from '@/components/sidebar-drawer';
import { Topbar } from '@/components/topbar';
import type { ReactNode } from 'react';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarDrawerProvider>
      <PaletteProvider>
        {/* Keyboard-only skip link. Becomes visible (not just sr-only) when
            focused so a tab user can land here as the first stop and jump
            past the sidebar + topbar straight into the page content. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[200] focus:rounded-md focus:bg-zinc-900 focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:bg-zinc-100 dark:focus:text-zinc-900"
        >
          Skip to main content
        </a>
        <div className="flex h-screen w-full overflow-hidden">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <Topbar />
            <main id="main" tabIndex={-1} className="flex-1 overflow-auto">
              {children}
            </main>
          </div>
        </div>
      </PaletteProvider>
    </SidebarDrawerProvider>
  );
}
