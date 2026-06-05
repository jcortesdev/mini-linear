import { PaletteProvider } from '@/components/palette/palette-provider';
import { Sidebar } from '@/components/sidebar';
import { SidebarDrawerProvider } from '@/components/sidebar-drawer';
import { Topbar } from '@/components/topbar';
import type { ReactNode } from 'react';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarDrawerProvider>
      <PaletteProvider>
        <div className="flex h-screen w-full overflow-hidden">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <Topbar />
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </div>
      </PaletteProvider>
    </SidebarDrawerProvider>
  );
}
