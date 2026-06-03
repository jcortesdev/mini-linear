'use client';

import { ToastProvider } from '@/components/toast-provider';
import { ConvexAuthNextjsProvider } from '@convex-dev/auth/nextjs';
import { ConvexReactClient } from 'convex/react';
import { type ReactNode, useEffect } from 'react';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error(
    'NEXT_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` to provision a deployment.'
  );
}

const convex = new ConvexReactClient(convexUrl);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  // Expose the authenticated Convex client to the global scope only in dev so
  // Playwright can clean up after itself via `api.issues.purgeByTitlePrefix`.
  // Stripped from production bundles by the NODE_ENV check below.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      (window as unknown as { __convex?: ConvexReactClient }).__convex = convex;
    }
  }, []);

  return (
    <ConvexAuthNextjsProvider client={convex}>
      <ToastProvider>{children}</ToastProvider>
    </ConvexAuthNextjsProvider>
  );
}
