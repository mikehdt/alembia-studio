import { useEffect } from 'react';

import type { ModelStatus } from '@/app/services/model-manager/types';
import { useAppDispatch } from '@/app/store/hooks';
import { setModelStatus } from '@/app/store/model-manager';

/**
 * Fetches model manager statuses and writes them into Redux.
 *
 * Called wherever the UI needs to know whether a downloadable model is
 * installed locally — primarily the training config form and the model
 * defaults modal. Re-runs whenever `enabled` flips to true, so it's safe
 * to gate on modal open state.
 */
export function useEnsureModelStatuses(enabled: boolean = true): void {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    fetch('/api/model-manager/status')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        for (const [modelId, raw] of Object.entries(data.statuses ?? {})) {
          const entry = raw as {
            status: ModelStatus;
            localPath: string | null;
          };
          dispatch(
            setModelStatus({
              modelId,
              status: entry.status,
              localPath: entry.localPath,
            }),
          );
        }
      })
      .catch(() => {
        // Status check failed; UI falls back to last known state
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, dispatch]);
}
