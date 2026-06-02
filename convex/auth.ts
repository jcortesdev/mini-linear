import GitHub from '@auth/core/providers/github';
import Google from '@auth/core/providers/google';
import LinkedIn from '@auth/core/providers/linkedin';
import Resend from '@auth/core/providers/resend';
import { Anonymous } from '@convex-dev/auth/providers/Anonymous';
import { convexAuth } from '@convex-dev/auth/server';

// Provider credentials live in Convex env vars (set with `npx convex env set ...`),
// not in .env.local. Each provider auto-reads AUTH_<NAME>_ID / AUTH_<NAME>_SECRET.
// Anonymous powers the "Try the demo" button — no credentials needed.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    GitHub,
    Google,
    LinkedIn,
    Resend({
      from: process.env.AUTH_EMAIL_FROM ?? 'onboarding@resend.dev',
    }),
    Anonymous,
  ],
});
