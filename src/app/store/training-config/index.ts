/**
 * Training config slice.
 *
 * Holds the training form state (what the user is currently editing),
 * the loaded saved-project metadata (if any), and the baseline snapshot
 * used to compute the dirty flag.
 */

import {
  createSelector,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';

import {
  getModelById,
  type ModelComponentType,
} from '@/app/services/training/models';
import type { TrainingProvider } from '@/app/services/training/types';

import type { RootState } from '../index';
import {
  defaultFolderAugmentation,
  defaultsToFormState,
  getDefaults,
  initialFormState,
} from './defaults';
import type {
  AppModelDefaults,
  DatasetFolder,
  FolderAugmentation,
  FormState,
  LoadedProject,
  ModelPaths,
  SectionName,
  TrainingConfigState,
} from './types';

const initialState: TrainingConfigState = {
  form: initialFormState(),
  appModelDefaults: {},
  loadedProject: null,
  baselineSnapshot: null,
};

const trainingConfigSlice = createSlice({
  name: 'trainingConfig',
  initialState,
  reducers: {
    setField: <K extends keyof FormState>(
      state: TrainingConfigState,
      action: PayloadAction<{ field: K; value: FormState[K] }>,
    ) => {
      // Cast through unknown — the generic narrowing isn't preserved when
      // RTK infers action types, but the runtime assignment is safe.
      (state.form as Record<string, unknown>)[action.payload.field as string] =
        action.payload.value as unknown;
    },

    setModel: (state, action: PayloadAction<string>) => {
      const modelId = action.payload;
      const defaults = getDefaults(modelId);
      const nextModel = getModelById(modelId);
      const preserveMock =
        state.form.selectedProvider === 'mock' &&
        nextModel?.providers.includes('mock');

      // Preserve user's dataset and output choices across model switches.
      const preserved = {
        outputName: state.form.outputName,
        datasets: state.form.datasets,
        extraFolders: state.form.extraFolders,
        samplePrompts: state.form.samplePrompts,
      };

      state.form = {
        ...defaultsToFormState(defaults, modelId),
        selectedProvider: preserveMock
          ? 'mock'
          : (nextModel?.providers[0] ?? 'ai-toolkit'),
        ...preserved,
      };
    },

    setProvider: (state, action: PayloadAction<TrainingProvider>) => {
      state.form.selectedProvider = action.payload;
    },

    setModelPath: (
      state,
      action: PayloadAction<{ component: ModelComponentType; path: string }>,
    ) => {
      state.form.modelPaths[action.payload.component] = action.payload.path;
    },

    applyAppDefaults: (state, action: PayloadAction<ModelPaths>) => {
      // Fill in paths that are empty, preserving user edits.
      for (const [key, value] of Object.entries(action.payload)) {
        const component = key as ModelComponentType;
        if (value && !state.form.modelPaths[component]) {
          state.form.modelPaths[component] = value;
        }
      }
    },

    resetSection: (state, action: PayloadAction<SectionName>) => {
      const defaults = getDefaults(state.form.modelId);
      const { form } = state;

      switch (action.payload) {
        case 'whatToTrain':
          form.modelPaths = {};
          break;

        case 'dataset': {
          const baseAugment = defaultFolderAugmentation(defaults);
          for (const ds of form.datasets) {
            for (const f of ds.folders) {
              Object.assign(f, baseAugment);
            }
          }
          for (const ef of form.extraFolders) {
            Object.assign(ef, baseAugment);
          }
          break;
        }

        case 'learning':
          form.durationMode = 'epochs';
          form.epochs = defaults.epochs;
          form.steps = defaults.steps;
          form.batchSize = defaults.batchSize;
          form.learningRate = defaults.learningRate;
          form.optimizer = defaults.optimizer;
          form.scheduler = defaults.scheduler;
          form.warmupSteps = defaults.warmupSteps;
          form.numRestarts = defaults.numRestarts;
          form.weightDecay = defaults.weightDecay;
          form.maxGradNorm = defaults.maxGradNorm;
          form.trainTextEncoder = defaults.trainTextEncoder;
          form.backboneLR = defaults.backboneLR;
          form.textEncoderLR = defaults.textEncoderLR;
          form.ema = defaults.ema;
          form.lossType = defaults.lossType;
          form.timestepType = defaults.timestepType;
          form.timestepBias = defaults.timestepBias;
          break;

        case 'loraShape':
          form.networkType = 'lora';
          form.networkDim = defaults.networkDim;
          form.networkAlpha = defaults.networkAlpha;
          form.networkDimAlphaLinked =
            defaults.networkDim === defaults.networkAlpha;
          form.networkDropout = defaults.networkDropout;
          break;

        case 'performance':
          form.resolution = defaults.resolution;
          form.mixedPrecision = defaults.mixedPrecision;
          form.transformerQuantization = defaults.transformerQuantization;
          form.textEncoderQuantization = defaults.textEncoderQuantization;
          form.cacheTextEmbeddings = defaults.cacheTextEmbeddings;
          form.unloadTextEncoder = defaults.unloadTextEncoder;
          form.gradientAccumulationSteps = defaults.gradientAccumulationSteps;
          form.gradientCheckpointing = defaults.gradientCheckpointing;
          form.cacheLatents = defaults.cacheLatents;
          break;

        case 'sampling':
          form.samplingEnabled = false;
          form.samplePrompts = [''];
          form.sampleMode = 'steps';
          form.sampleEveryEpochs = 1;
          form.sampleEverySteps = defaults.sampleEvery;
          form.sampleSteps = defaults.sampleSteps;
          form.seed = defaults.seed;
          form.guidanceScale = defaults.guidanceScale;
          form.noiseScheduler = defaults.noiseScheduler;
          break;

        case 'saving':
          form.saveEnabled = false;
          form.saveMode = 'epochs';
          form.saveEveryEpochs = defaults.saveEvery;
          form.saveEverySteps = 250;
          form.saveFormat = defaults.saveFormat;
          form.maxSavesToKeep = defaults.maxSavesToKeep;
          form.saveState = false;
          form.resumeState = '';
          break;
      }
    },

    resetAll: (state) => {
      state.form = defaultsToFormState(
        getDefaults(state.form.modelId),
        state.form.modelId,
      );
    },

    /** Revert the form to suggested defaults AND drop any loaded project. */
    resetToSuggestedDefaults: (state) => {
      state.form = defaultsToFormState(
        getDefaults(state.form.modelId),
        state.form.modelId,
      );
      state.loadedProject = null;
      state.baselineSnapshot = null;
    },

    /** Revert the form to the currently loaded version's baseline. */
    revertToBaseline: (state) => {
      if (state.baselineSnapshot) {
        state.form = state.baselineSnapshot;
      }
    },

    addSamplePrompt: (state) => {
      state.form.samplePrompts.push('');
    },

    removeSamplePrompt: (state, action: PayloadAction<number>) => {
      const next = state.form.samplePrompts.filter(
        (_, i) => i !== action.payload,
      );
      state.form.samplePrompts = next.length === 0 ? [''] : next;
    },

    setSamplePrompt: (
      state,
      action: PayloadAction<{ index: number; value: string }>,
    ) => {
      state.form.samplePrompts[action.payload.index] = action.payload.value;
    },

    addDataset: (
      state,
      action: PayloadAction<{
        folderName: string;
        displayName: string;
        thumbnail?: string;
        thumbnailVersion?: number;
        dimensionHistogram?: Record<string, number>;
        folders: Omit<DatasetFolder, keyof FolderAugmentation>[];
      }>,
    ) => {
      const baseAugment = defaultFolderAugmentation(
        getDefaults(state.form.modelId),
      );
      state.form.datasets.push({
        projectName: action.payload.displayName,
        folderName: action.payload.folderName,
        thumbnail: action.payload.thumbnail,
        thumbnailVersion: action.payload.thumbnailVersion,
        dimensionHistogram: action.payload.dimensionHistogram,
        folders: action.payload.folders.map((f) => ({ ...f, ...baseAugment })),
      });
    },

    removeDataset: (state, action: PayloadAction<number>) => {
      state.form.datasets.splice(action.payload, 1);
    },

    setFolderRepeats: (
      state,
      action: PayloadAction<{
        datasetIndex: number | null;
        folderName: string;
        repeats: number | null;
      }>,
    ) => {
      const { datasetIndex, folderName, repeats } = action.payload;
      if (datasetIndex === null) {
        const ef = state.form.extraFolders.find((e) => e.path === folderName);
        if (ef) ef.overrideRepeats = repeats;
        return;
      }
      const folder = state.form.datasets[datasetIndex]?.folders.find(
        (f) => f.name === folderName,
      );
      if (folder) folder.overrideRepeats = repeats;
    },

    updateFolderAugment: (
      state,
      action: PayloadAction<{
        datasetIndex: number | null;
        folderName: string;
        updates: Partial<FolderAugmentation>;
      }>,
    ) => {
      const { datasetIndex, folderName, updates } = action.payload;
      if (datasetIndex === null) {
        const ef = state.form.extraFolders.find((e) => e.path === folderName);
        if (ef) Object.assign(ef, updates);
        return;
      }
      const folder = state.form.datasets[datasetIndex]?.folders.find(
        (f) => f.name === folderName,
      );
      if (folder) Object.assign(folder, updates);
    },

    addExtraFolder: (state, action: PayloadAction<string>) => {
      if (state.form.extraFolders.some((ef) => ef.path === action.payload)) {
        return;
      }
      const baseAugment = defaultFolderAugmentation(
        getDefaults(state.form.modelId),
      );
      state.form.extraFolders.push({
        path: action.payload,
        overrideRepeats: null,
        ...baseAugment,
      });
    },

    removeExtraFolder: (state, action: PayloadAction<number>) => {
      state.form.extraFolders.splice(action.payload, 1);
    },

    setAppModelDefaults: (state, action: PayloadAction<AppModelDefaults>) => {
      state.appModelDefaults = action.payload;
    },

    /**
     * Load a saved project version into the form.
     * Replaces current form, records the loaded project metadata,
     * and stamps the baseline so the dirty flag starts clean.
     */
    hydrateFromProject: (
      state,
      action: PayloadAction<{ form: FormState; loadedProject: LoadedProject }>,
    ) => {
      state.form = action.payload.form;
      state.loadedProject = action.payload.loadedProject;
      state.baselineSnapshot = action.payload.form;
    },

    /**
     * After a successful save, update the loaded-project pointer and
     * re-stamp the baseline to the current form (dirty → clean).
     */
    stampSaved: (state, action: PayloadAction<LoadedProject>) => {
      state.loadedProject = action.payload;
      state.baselineSnapshot = state.form;
    },

    /** Drop the loaded-project pointer. Form is left untouched. */
    clearLoadedProject: (state) => {
      state.loadedProject = null;
      state.baselineSnapshot = null;
    },
  },
});

export const {
  setField,
  setModel,
  setProvider,
  setModelPath,
  applyAppDefaults,
  resetSection,
  resetAll,
  resetToSuggestedDefaults,
  revertToBaseline,
  addSamplePrompt,
  removeSamplePrompt,
  setSamplePrompt,
  addDataset,
  removeDataset,
  setFolderRepeats,
  updateFolderAugment,
  addExtraFolder,
  removeExtraFolder,
  setAppModelDefaults,
  hydrateFromProject,
  stampSaved,
  clearLoadedProject,
} = trainingConfigSlice.actions;

export const trainingConfigReducer = trainingConfigSlice.reducer;

// --- Selectors ---

const selectSlice = (state: RootState) => state.trainingConfig;

export const selectForm = (state: RootState) => state.trainingConfig.form;

export const selectLoadedProject = (state: RootState) =>
  state.trainingConfig.loadedProject;

export const selectAppModelDefaults = (state: RootState) =>
  state.trainingConfig.appModelDefaults;

export const selectCurrentModel = createSelector(selectForm, (form) =>
  getModelById(form.modelId),
);

export const selectModelDefaults = createSelector(selectForm, (form) =>
  getDefaults(form.modelId),
);

export const selectDatasetStats = createSelector(selectForm, (form) => {
  let totalImages = 0;
  let totalEffective = 0;
  for (const ds of form.datasets) {
    for (const folder of ds.folders) {
      const repeats = folder.overrideRepeats ?? folder.detectedRepeats;
      if (repeats === 0) continue;
      totalImages += folder.imageCount;
      totalEffective += folder.imageCount * repeats;
    }
  }
  return { totalImages, totalEffective };
});

export const selectCalculatedSteps = createSelector(
  selectForm,
  selectDatasetStats,
  (form, stats) => {
    if (stats.totalEffective === 0) return 0;
    if (form.durationMode === 'epochs') {
      return Math.ceil((stats.totalEffective * form.epochs) / form.batchSize);
    }
    return form.steps;
  },
);

export const selectCalculatedEpochs = createSelector(
  selectForm,
  selectDatasetStats,
  (form, stats) => {
    if (stats.totalEffective === 0) return 0;
    if (form.durationMode === 'steps') {
      return Math.floor((form.steps * form.batchSize) / stats.totalEffective);
    }
    return form.epochs;
  },
);

export const selectSectionHasChanges = createSelector(
  selectForm,
  selectModelDefaults,
  (form, defaults) => {
    const baseAugment = defaultFolderAugmentation(defaults);
    const folderCustomised = (f: FolderAugmentation): boolean =>
      f.captionShuffling !== baseAugment.captionShuffling ||
      f.captionDropoutRate !== baseAugment.captionDropoutRate ||
      f.keepTokens !== baseAugment.keepTokens ||
      f.flipAugment !== baseAugment.flipAugment ||
      f.flipVAugment !== baseAugment.flipVAugment ||
      f.loraWeight !== baseAugment.loraWeight ||
      f.isRegularization !== baseAugment.isRegularization;
    const anyFolderCustomised =
      form.datasets.some((ds) => ds.folders.some(folderCustomised)) ||
      form.extraFolders.some(folderCustomised);

    return {
      whatToTrain: false,
      dataset: anyFolderCustomised,
      learning:
        form.learningRate !== defaults.learningRate ||
        form.optimizer !== defaults.optimizer ||
        form.scheduler !== defaults.scheduler ||
        form.epochs !== defaults.epochs ||
        form.batchSize !== defaults.batchSize ||
        form.warmupSteps !== defaults.warmupSteps ||
        form.numRestarts !== defaults.numRestarts ||
        form.weightDecay !== defaults.weightDecay ||
        form.maxGradNorm !== defaults.maxGradNorm ||
        form.trainTextEncoder !== defaults.trainTextEncoder ||
        form.backboneLR !== defaults.backboneLR ||
        form.textEncoderLR !== defaults.textEncoderLR ||
        form.ema !== defaults.ema ||
        form.lossType !== defaults.lossType ||
        form.timestepType !== defaults.timestepType ||
        form.timestepBias !== defaults.timestepBias,
      loraShape:
        form.networkDim !== defaults.networkDim ||
        form.networkAlpha !== defaults.networkAlpha ||
        form.networkType !== 'lora' ||
        form.networkDropout !== defaults.networkDropout,
      performance:
        form.mixedPrecision !== defaults.mixedPrecision ||
        form.transformerQuantization !== defaults.transformerQuantization ||
        form.textEncoderQuantization !== defaults.textEncoderQuantization ||
        form.cacheTextEmbeddings !== defaults.cacheTextEmbeddings ||
        form.unloadTextEncoder !== defaults.unloadTextEncoder ||
        form.gradientAccumulationSteps !== defaults.gradientAccumulationSteps ||
        form.gradientCheckpointing !== defaults.gradientCheckpointing ||
        form.cacheLatents !== defaults.cacheLatents,
      sampling: false,
      saving: false,
    };
  },
);

/**
 * Dirty when a saved project is loaded and the form differs from the
 * snapshot captured at load/save time. Ephemeral configs are never "dirty"
 * because there's no baseline to compare against.
 */
export const selectIsDirty = createSelector(
  selectSlice,
  ({ form, baselineSnapshot }) => {
    if (!baselineSnapshot) return false;
    return !formsEqual(form, baselineSnapshot);
  },
);

// --- Helpers ---

function formsEqual(a: FormState, b: FormState): boolean {
  // Cheap pre-check: same reference = clean.
  if (a === b) return true;
  // Deep equality via JSON serialisation. FormState contains no functions,
  // dates, or circular refs, so this is safe and ~free for a form this size.
  return JSON.stringify(a) === JSON.stringify(b);
}
