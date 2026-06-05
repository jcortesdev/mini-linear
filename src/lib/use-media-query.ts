'use client';

import { useEffect, useState } from 'react';

/**
 * Subscribes to a media query and re-renders when its match state changes.
 * Returns `false` on the first server-side / pre-hydration render to keep SSR
 * deterministic; the actual match resolves in the layout effect on mount.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
