// Main slice definition
import { createSlice } from '@reduxjs/toolkit';

import { setupExtraReducers } from './extraReducers';
import { coreReducers } from './reducers';
import { ImageAssets, IoState, SortDirection, SortType } from './types';

const initialState: ImageAssets = {
  ioState: IoState.INITIAL,
  ioMessage: undefined,
  images: [],
  imageIndexById: {},
  tagCountsCache: null,
  sortType: SortType.NAME,
  sortDirection: SortDirection.ASC,
};

const assetsSlice = createSlice({
  name: 'assets',
  initialState,
  reducers: coreReducers,
  extraReducers: setupExtraReducers,
  // Simple property accessors defined inline, complex selectors still in selectors.ts
  // Note: These slice selectors are exported for external use, but complex selectors
  // in selectors.ts use local versions to avoid circular dependencies
  selectors: {
    selectIoState: (state) => state.ioState,
    selectIoMessage: (state) => state.ioMessage,
    selectAllImages: (state) => state.images,
    selectImageCount: (state) => state.images.length,
    selectSaveProgress: (state) => state.saveProgress,
    selectLoadProgress: (state) => state.loadProgress,
    selectSortType: (state) => state.sortType,
    selectSortDirection: (state) => state.sortDirection,
  },
});

// Main exports for slice
export const { reducer: assetsReducer } = assetsSlice;
export const {
  resetAssetsState,
  addTag,
  addMultipleTags,
  editTag,
  deleteTag,
  reorderTags,
  resetTags,
  resetAllModifiedTags,
  markFilterTagsToDelete,
  gatherTags,
  copyTagsToAssets,
  
  setCaptionText,
  setSortType,
  setSortDirection,
  toggleSortDirection,
} = assetsSlice.actions;

// Export the selectors from the slice
export const {
  selectIoState,
  selectIoMessage,
  selectAllImages,
  selectImageCount,
  selectSaveProgress,
  selectLoadProgress,
  selectSortType,
  selectSortDirection,
} = assetsSlice.selectors;

// Main exports for assets module
export * from './actions';
export * from './selectors';
export * from './types';
export * from './utils';
