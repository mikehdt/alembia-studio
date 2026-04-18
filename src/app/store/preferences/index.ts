import { createSlice } from '@reduxjs/toolkit';

import { loadPreferences, savePreferences } from './local-storage';
import { coreReducers } from './reducers';
import type { PreferencesState } from './types';

const initialState: PreferencesState = loadPreferences();

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: coreReducers,
  selectors: {
    selectTheme: (state) => state.theme,
    selectTagEditMode: (state) => state.tagEditMode,
    selectTrainingViewMode: (state) => state.trainingViewMode,
    selectKeepTaggerModelInMemory: (state) => state.keepTaggerModelInMemory,
  },
});

export const { reducer: preferencesReducer } = preferencesSlice;
export const {
  setTheme,
  setTagEditMode,
  setTrainingViewMode,
  setKeepTaggerModelInMemory,
} = preferencesSlice.actions;
export const {
  selectTheme,
  selectTagEditMode,
  selectTrainingViewMode,
  selectKeepTaggerModelInMemory,
} = preferencesSlice.selectors;

/**
 * Subscribe to store changes and persist preferences to localStorage.
 * Call once after store creation.
 */
export const subscribePreferencesPersistence = (store: {
  getState: () => { preferences: PreferencesState };
  subscribe: (listener: () => void) => () => void;
}) => {
  let prev = store.getState().preferences;
  return store.subscribe(() => {
    const next = store.getState().preferences;
    if (next !== prev) {
      prev = next;
      savePreferences(next);
    }
  });
};

export type { ThemeMode, TrainingViewMode } from './types';
export { TagEditMode } from './types';
