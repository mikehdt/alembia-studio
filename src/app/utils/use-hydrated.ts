import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

/**
 * True once this component has hydrated on the client; false during SSR and
 * the hydration render itself.
 *
 * Use this to pin props derived from the jobs slice (or any store state that
 * layout-level effects mutate) to their SSR values during hydration. Under
 * streamed/selective hydration the layout shell hydrates and runs its effects
 * (persisted-job load, active-run hydration, WebSocket progress) before page
 * chunks hydrate — so a page component can hydrate against a store that no
 * longer matches what the server rendered, even though both sides started
 * from identical initial state. Preference-derived state does NOT need this:
 * it is cookie-seeded server-side and never flips during hydration.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
