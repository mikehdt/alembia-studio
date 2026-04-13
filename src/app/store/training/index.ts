/**
 * Training infrastructure slice.
 *
 * Manages sidecar process lifecycle and WebSocket connection state.
 * Job tracking (active job, progress, panel) has moved to store/jobs.
 */

import {
  createSelector,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';

import type { SidecarStatus } from '@/app/services/training/types';

import type { RootState } from '../index';
import type { TrainingState } from './types';

const initialState: TrainingState = {
  sidecarStatus: 'stopped',
  sidecarError: null,
  wsConnected: false,
};

const trainingSlice = createSlice({
  name: 'training',
  initialState,
  reducers: {
    setSidecarStatus: (
      state,
      action: PayloadAction<{
        status: SidecarStatus;
        error?: string | null;
      }>,
    ) => {
      state.sidecarStatus = action.payload.status;
      state.sidecarError = action.payload.error ?? null;
    },

    setWsConnected: (state, action: PayloadAction<boolean>) => {
      state.wsConnected = action.payload;
    },
  },
});

export const {   } = trainingSlice.actions;

export const trainingReducer = trainingSlice.reducer;

// --- Selectors ---

const selectTraining = (state: RootState) => state.training;

const selectSidecarStatus = createSelector(
  selectTraining,
  (t) => t.sidecarStatus,
);

const selectWsConnected = createSelector(
  selectTraining,
  (t) => t.wsConnected,
);
