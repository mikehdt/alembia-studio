/**
 * Model manager Redux slice.
 *
 * Tracks model inventory (what's installed, where) separately from
 * active download operations (which live in the jobs slice).
 */

import {
  createSelector,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';

import type { ModelStatus } from '@/app/services/model-manager/types';

import type { RootState } from '../index';
import type { ModelEntry, ModelManagerState } from './types';

const initialState: ModelManagerState = {
  models: {},
  modelsFolder: null,
  isScanning: false,
  isModalOpen: false,
  modalInitialTab: undefined,
};

const modelManagerSlice = createSlice({
  name: 'modelManager',
  initialState,
  reducers: {
    // --- Model status ---

    /** Set the status and optional path for a single model. */
    setModelStatus: (
      state,
      action: PayloadAction<{
        modelId: string;
        status: ModelStatus;
        localPath?: string | null;
        sizeBytes?: number;
      }>,
    ) => {
      const { modelId, status, localPath, sizeBytes } = action.payload;
      const existing = state.models[modelId];
      state.models[modelId] = {
        modelId,
        status,
        localPath: localPath ?? existing?.localPath ?? null,
        sizeBytes: sizeBytes ?? existing?.sizeBytes ?? 0,
      };
    },

    /** Bulk-update model statuses (e.g. after scanning disk). */
    setModelStatuses: (state, action: PayloadAction<ModelEntry[]>) => {
      for (const entry of action.payload) {
        state.models[entry.modelId] = entry;
      }
    },

    // --- Storage config ---

    setModelsFolder: (state, action: PayloadAction<string>) => {
      state.modelsFolder = action.payload;
    },

    setIsScanning: (state, action: PayloadAction<boolean>) => {
      state.isScanning = action.payload;
    },

    // --- Modal UI ---

    openModelManagerModal: (
      state,
      action: PayloadAction<
        'auto-tagger' | 'training' | 'settings' | undefined
      >,
    ) => {
      state.isModalOpen = true;
      state.modalInitialTab = action.payload;
    },

    closeModelManagerModal: (state) => {
      state.isModalOpen = false;
    },
  },
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const modelManagerReducer = modelManagerSlice.reducer;

export const {
  setModelStatus,
  
  
  setIsScanning,
  openModelManagerModal,
  closeModelManagerModal,
} = modelManagerSlice.actions;

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

const selectModelManager = (state: RootState) => state.modelManager;

const selectModelsFolder = createSelector(
  selectModelManager,
  (s) => s.modelsFolder,
);

export const selectIsModelManagerModalOpen = createSelector(
  selectModelManager,
  (s) => s.isModalOpen,
);

export const selectModelManagerInitialTab = createSelector(
  selectModelManager,
  (s) => s.modalInitialTab,
);

export const selectIsScanningModels = createSelector(
  selectModelManager,
  (s) => s.isScanning,
);

/** All model entries as a status map (modelId → { status, localPath }). */
export const selectAllModelStatuses = createSelector(
  selectModelManager,
  (s) => s.models,
);

/** Get the status entry for a specific model. */
const selectModelEntry = (modelId: string) =>
  createSelector(selectModelManager, (s) => s.models[modelId] ?? null);

/** Check if a shared component is ready (by sharedId → modelId mapping). */
const selectModelStatusById = (modelId: string) =>
  createSelector(
    selectModelManager,
    (s) => s.models[modelId]?.status ?? ('not_installed' as ModelStatus),
  );

// Re-export types
;
