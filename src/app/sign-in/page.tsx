'use client';

import { useAuthActions } from '@convex-dev/auth/react';
import { useMutation } from 'convex/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '../../../convex/_generated/api';
import { GitHubIcon, GoogleIcon, LinkedInIcon, MailIcon, SparklesIcon } from './provider-icons';

type OAuthProvider = 'github' | 'google' | 'linkedin';

const OAUTH_PROVIDERS: { id: OAuthProvider; label: string; icon: React.ReactNode }[] = [
  { id: 'github', label: 'Continue with GitHub', icon: <GitHubIcon /> },
  { id: 'google', label: 'Continue with Google', icon: <GoogleIcon /> },
  { id: 'linkedin', label: 'Continue with LinkedIn', icon: <LinkedInIcon /> },
];

export default function SignInPage() {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const joinDemo = useMutation(api.demo.joinDemoWorkspace);
  const [email, setEmail] = useState('');
  const [emailState, setEmailState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [pendingProvider, setPendingProvider] = useState<OAuthProvider | null>(null);
  const [demoState, setDemoState] = useState<'idle' | 'joining' | 'error'>('idle');

  async function handleOAuth(provider: OAuthProvider) {
    setPendingProvider(provider);
    try {
      await signIn(provider, { redirectTo: '/issues' });
    } catch {
      setPendingProvider(null);
    }
  }

  async function handleMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email) return;
    setEmailState('sending');
    try {
      await signIn('resend', { email, redirectTo: '/issues' });
      setEmailState('sent');
    } catch {
      setEmailState('error');
    }
  }

  async function handleTryDemo() {
    setDemoState('joining');
    try {
      await signIn('anonymous');
      await joinDemo();
      router.push('/issues');
    } catch {
      setDemoState('error');
    }
  }

  const anyPending =
    pendingProvider !== null || emailState === 'sending' || demoState === 'joining';

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to Mini-Linear</h1>
          <p className="text-sm text-zinc-500">
            Use any provider below, or get a magic link by email.
          </p>
        </header>

        <button
          type="button"
          onClick={handleTryDemo}
          disabled={anyPending}
          className="flex w-full items-center justify-center gap-2.5 rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-50 dark:hover:bg-zinc-900"
        >
          <SparklesIcon />
          <span>
            {demoState === 'joining' ? 'Setting up your demo…' : 'Try the demo without an account'}
          </span>
        </button>
        {demoState === 'error' && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Couldn’t start the demo. Please try again.
          </p>
        )}

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          <span className="text-xs uppercase tracking-wider text-zinc-500">or sign in</span>
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>

        <div className="space-y-2">
          {OAUTH_PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              type="button"
              onClick={() => handleOAuth(provider.id)}
              disabled={anyPending}
              className="flex w-full items-center justify-center gap-2.5 rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
            >
              <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center">
                {provider.icon}
              </span>
              <span>{pendingProvider === provider.id ? 'Redirecting…' : provider.label}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleMagicLink} className="space-y-3">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:ring-zinc-100"
          />
          <button
            type="submit"
            disabled={anyPending || emailState === 'sent'}
            className="flex w-full items-center justify-center gap-2.5 rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <MailIcon />
            <span>
              {emailState === 'sending'
                ? 'Sending…'
                : emailState === 'sent'
                  ? 'Check your inbox'
                  : 'Send magic link'}
            </span>
          </button>
          {emailState === 'error' && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              Something went wrong sending the magic link. Please try again.
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
