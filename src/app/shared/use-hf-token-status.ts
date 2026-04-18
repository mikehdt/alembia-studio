/**
 * Client-side hook exposing whether a HuggingFace token is configured.
 *
 * Backed by a module-level cache so multiple consumers (the model manager
 * training tab, the model defaults modal's ModelPathField, etc.) share a
 * single fetch. `refreshHfTokenStatus` is exported for the Settings tab to
 * call after saving, so all live consumers update without remounting.
 */

'use client';

import { useEffect, useState } from 'react';

let cached: boolean | null = null;
let inFlight: Promise<boolean> | null = null;
const subscribers = new Set<(value: boolean | null) => void>();

function notify(value: boolean | null): void {
  for (const sub of subscribers) sub(value);
}

async function fetchStatus(): Promise<boolean> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error('config fetch failed');
      const data = (await res.json()) as { hasHfToken?: boolean };
      cached = !!data.hasHfToken;
    } catch {
      // Leave cached as-is; best-effort
      if (cached === null) cached = false;
    } finally {
      inFlight = null;
    }
    notify(cached);
    return cached ?? false;
  })();
  return inFlight;
}

/** Invalidate the cache and refetch. Subscribers are notified on completion. */
export function refreshHfTokenStatus(): void {
  cached = null;
  fetchStatus();
}

/** Read `hasHfToken`. Returns `null` while the first fetch is pending. */
export function useHfTokenStatus(): boolean | null {
  const [value, setValue] = useState<boolean | null>(cached);

  useEffect(() => {
    subscribers.add(setValue);
    if (cached === null) fetchStatus();
    return () => {
      subscribers.delete(setValue);
    };
  }, []);

  return value;
}
