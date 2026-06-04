'use client';

import { useState } from 'react';

type Size = 'sm' | 'md';

type Props = {
  /** Falls back to "?" inside `getInitials` if the source string is empty. */
  initials?: string;
  /** OAuth provider image URL. Falls through to `initials` if the request fails. */
  image?: string | null;
  /** Renders a hollow dashed circle — used for the "unassigned" state. */
  dashed?: boolean;
  size?: Size;
  className?: string;
};

const SIZE_CLASS: Record<Size, string> = {
  sm: 'h-5 w-5 text-[9px]',
  md: 'h-6 w-6 text-[10px]',
};

/**
 * Shared avatar primitive. Used by the assignee picker, the issue creator chip,
 * and the M5 presence list. Always `aria-hidden` because the surrounding
 * interactive (or labelled) element owns the accessible name.
 */
export function Avatar({ initials, image, dashed = false, size = 'md', className = '' }: Props) {
  const sizeClass = SIZE_CLASS[size];
  const [imageBroken, setImageBroken] = useState(false);
  const showImage = !dashed && image && !imageBroken;

  if (dashed) {
    return (
      <span
        aria-hidden="true"
        className={`flex ${sizeClass} items-center justify-center rounded-full border border-dashed border-zinc-400 text-zinc-500 dark:border-zinc-700 dark:text-zinc-500 ${className}`}
      >
        ·
      </span>
    );
  }

  if (showImage) {
    // External OAuth avatars are tiny (≤ 24px); Next.js Image's remotePatterns
    // config isn't worth the friction at this size.
    return (
      <img
        src={image ?? undefined}
        alt=""
        aria-hidden="true"
        onError={() => setImageBroken(true)}
        className={`${sizeClass} shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full bg-zinc-900 font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900 ${className}`}
    >
      {initials}
    </span>
  );
}
