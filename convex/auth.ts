import GitHub from '@auth/core/providers/github';
import Google from '@auth/core/providers/google';
import LinkedIn from '@auth/core/providers/linkedin';
import Resend from '@auth/core/providers/resend';
import { Anonymous } from '@convex-dev/auth/providers/Anonymous';
import { convexAuth } from '@convex-dev/auth/server';
import { ensureDemoMembership } from './demo';

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
  callbacks: {
    // Runs server-side after the user row exists. For brand-new users we add a
    // membership in the demo workspace (creating + seeding it on first call) so
    // every new sign-in — anonymous or OAuth — lands on populated data.
    async afterUserCreatedOrUpdated(ctx, { userId, existingUserId }) {
      if (existingUserId) return;
      await ensureDemoMembership(ctx, userId);
    },
  },
});
