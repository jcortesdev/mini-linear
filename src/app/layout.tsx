import { THEME_INIT_SCRIPT, ThemeProvider } from '@/components/theme-provider';
import { ConvexClientProvider } from '@/lib/convex-provider';
import { ConvexAuthNextjsServerProvider } from '@convex-dev/auth/nextjs/server';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Mini-Linear',
  description: 'A focused clone of Linear — issues, kanban, command palette, realtime collab.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html
        lang="en"
        // `data-theme` is set synchronously by THEME_INIT_SCRIPT below before
        // hydration; we leave it absent on the server render so SSR HTML
        // doesn't lock the page into the wrong theme.
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <head>
          {/* Anti-flash: read localStorage + prefers-color-scheme and set
              data-theme on <html> before the first paint. Keeps the user's
              chosen theme stable on hard reload without a dark→light flash. */}
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: trusted, build-time-known content. */}
          <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        </head>
        <body className="min-h-full flex flex-col">
          <ThemeProvider>
            <ConvexClientProvider>{children}</ConvexClientProvider>
          </ThemeProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
