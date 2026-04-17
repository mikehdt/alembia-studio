/**
 * Middleware for the jobs slice:
 * - Persists download jobs to localStorage on every change
 * - Auto-opens the activity panel when a new job is added
 * - Mirrors model-manager status changes into the auto-tagger slice so
 *   both surfaces stay in sync (the Model Manager modal owns the
 *   model-manager slice; the tagging UI reads the auto-tagger slice).
 */

import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';

import { updateModelStatus as updateAutoTaggerModelStatus } from '../auto-tagger';
import type { RootState } from '../index';
import { addJob, openPanel } from '../jobs';
import {
  persistDownloadJobs,
  persistTrainingJobs,
} from '../jobs/persistence';
import { setModelStatus } from '../model-manager';

export const jobPersistenceMiddleware = createListenerMiddleware();

// Persist download + terminal training jobs to localStorage on any jobs/ action
jobPersistenceMiddleware.startListening({
  predicate: (action) =>
    typeof action.type === 'string' && action.type.startsWith('jobs/'),
  effect: (_action, listenerApi) => {
    const state = listenerApi.getState() as RootState;
    persistDownloadJobs(state.jobs.jobs);
    persistTrainingJobs(state.jobs.jobs);
  },
});

// Auto-open the activity panel when a new job is added
jobPersistenceMiddleware.startListening({
  matcher: isAnyOf(addJob),
  effect: (_action, listenerApi) => {
    listenerApi.dispatch(openPanel());
  },
});

// Mirror model-manager status changes into the auto-tagger slice.
// The auto-tagger reducer's updateModelStatus is a no-op when the model
// isn't in its list, so this is safe to dispatch unconditionally.
jobPersistenceMiddleware.startListening({
  actionCreator: setModelStatus,
  effect: (action, listenerApi) => {
    const { modelId, status } = action.payload;
    listenerApi.dispatch(updateAutoTaggerModelStatus({ modelId, status }));
  },
});
