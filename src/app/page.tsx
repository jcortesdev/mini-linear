import { isAuthenticatedNextjs } from '@convex-dev/auth/nextjs/server';
import { redirect } from 'next/navigation';

export default async function Home() {
  const authenticated = await isAuthenticatedNextjs();
  redirect(authenticated ? '/issues' : '/sign-in');
}
