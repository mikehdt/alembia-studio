import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';

import {
  getModelById,
  MODEL_DEFINITIONS,
  type ModelComponentType,
  type ModelDefinition,
  type TrainingDefaults,
} from '@/app/services/training/models';

// --- Types ---

export type DatasetSource = {
  /** Display name (title or folder name) */
  projectName: string;
  /** Disk folder name — unique identifier */
  folderName: string;
  /** Thumbnail path for display (e.g. "projectname.png") */
  thumbnail?: string;
  thumbnailVersion?: number;
  /** Image dimension histogram, e.g. { "1920x1080": 15 } */
  dimensionHistogram?: Record<string, number>;
  folders: DatasetFolder[];
};

/** Per-folder augmentation settings — shared by project folders and extras. */
export type FolderAugmentation = {
  captionShuffling: boolean;
  captionDropoutRate: number;
  keepTokens: number;
  flipAugment: boolean;
  flipVAugment: boolean;
};

export type DatasetFolder = {
  name: string;
  imageCount: number;
  detectedRepeats: number;
  overrideRepeats: number | null; // null = use detected
} & FolderAugmentation;

/** Loose folder added by path — no project/parent, no detected repeats. */
export type ExtraFolder = {
  path: string;
  imageCount?: number;
  /** null = disabled elsewhere isn't meaningful here; this is the effective repeat count (default 1). */
  overrideRepeats: number | null;
} & FolderAugmentation;

/** Augmentation keys callers can update per folder. */
export type FolderAugmentKey = keyof FolderAugmentation;

export type DurationMode = 'epochs' | 'steps';

export type ModelPaths = Partial<Record<ModelComponentType, string>>;

/** Model defaults keyed by model ID (e.g. 'sdxl', 'noob-ai-xl'). */
export type AppModelDefaults = Record<
  string,
  Partial<Record<ModelComponentType, string>>
>;

export type FormState = {
  // What to Train
  modelId: string;
  modelPaths: ModelPaths;
  outputName: string;

  // Dataset
  datasets: DatasetSource[];
  extraFolders: ExtraFolder[];

  // Learning
  durationMode: DurationMode;
  epochs: number;
  steps: number;
  learningRate: number;
  optimizer: string;
  scheduler: string;
  warmupSteps: number;
  numRestarts: number;
  weightDecay: number;
  maxGradNorm: number;

  // LoRA Shape
  networkType: 'lora' | 'lokr';
  networkDim: number;
  networkAlpha: number;
  networkDropout: number;

  // Performance
  batchSize: number;
  resolution: number[];
  mixedPrecision: 'bf16' | 'fp16' | 'fp8';
  gradientAccumulationSteps: number;
  gradientCheckpointing: boolean;
  cacheLatents: boolean;

  // Sampling
  samplingEnabled: boolean;
  samplePrompts: string[];
  sampleMode: 'epochs' | 'steps';
  sampleEveryEpochs: number;
  sampleEverySteps: number;
  sampleSteps: number;
  seed: number;
  guidanceScale: number;
  noiseScheduler: string;

  // Saving
  saveEnabled: boolean;
  saveMode: 'epochs' | 'steps';
  saveEveryEpochs: number;
  saveEverySteps: number;
  saveFormat: 'fp16' | 'bf16' | 'fp32';
  saveOnlyLast: boolean;
  saveState: boolean;
  resumeState: string;
};

type FormAction =
  | {
      type: 'SET_FIELD';
      field: keyof FormState;
      value: FormState[keyof FormState];
    }
  | { type: 'SET_MODEL'; modelId: string }
  | { type: 'SET_MODEL_PATH'; component: ModelComponentType; path: string }
  | { type: 'APPLY_APP_DEFAULTS'; paths: ModelPaths }
  | { type: 'RESET_SECTION'; section: SectionName }
  | { type: 'RESET_ALL' }
  | { type: 'ADD_SAMPLE_PROMPT' }
  | { type: 'REMOVE_SAMPLE_PROMPT'; index: number }
  | { type: 'SET_SAMPLE_PROMPT'; index: number; value: string }
  | {
      type: 'ADD_DATASET';
      folderName: string;
      displayName: string;
      thumbnail?: string;
      thumbnailVersion?: number;
      dimensionHistogram?: Record<string, number>;
      /**
       * Raw folder metadata from the project scan. Augmentation fields
       * are not supplied here — the reducer injects them from the
       * current model's defaults.
       */
      folders: Omit<DatasetFolder, keyof FolderAugmentation>[];
    }
  | { type: 'REMOVE_DATASET'; index: number }
  | {
      type: 'SET_FOLDER_REPEATS';
      datasetIndex: number | null; // null = extra folder
      folderName: string;
      repeats: number | null;
    }
  | {
      type: 'UPDATE_FOLDER_AUGMENT';
      datasetIndex: number | null; // null = extra folder
      folderName: string;
      updates: Partial<FolderAugmentation>;
    }
  | { type: 'ADD_EXTRA_FOLDER'; path: string }
  | { type: 'REMOVE_EXTRA_FOLDER'; index: number };

export type SectionName =
  | 'whatToTrain'
  | 'dataset'
  | 'learning'
  | 'loraShape'
  | 'performance'
  | 'sampling'
  | 'saving';

// --- Helpers ---

/** Build the per-folder augmentation defaults for a model. */
export function defaultFolderAugmentation(
  defaults: TrainingDefaults,
): FolderAugmentation {
  return {
    captionShuffling: defaults.captionShuffling,
    captionDropoutRate: defaults.captionDropoutRate,
    keepTokens: defaults.keepTokens,
    flipAugment: defaults.flipAugment,
    flipVAugment: defaults.flipVAugment,
  };
}

function defaultsToFormState(
  defaults: TrainingDefaults,
  modelId: string,
): FormState {
  return {
    modelId,
    modelPaths: {},
    outputName: '',
    datasets: [],
    extraFolders: [],
    durationMode: 'epochs',
    epochs: defaults.epochs,
    steps: defaults.steps,
    learningRate: defaults.learningRate,
    optimizer: defaults.optimizer,
    scheduler: defaults.scheduler,
    warmupSteps: defaults.warmupSteps,
    numRestarts: defaults.numRestarts,
    weightDecay: defaults.weightDecay,
    maxGradNorm: defaults.maxGradNorm,
    networkType: 'lora',
    networkDim: defaults.networkDim,
    networkAlpha: defaults.networkAlpha,
    networkDropout: defaults.networkDropout,
    batchSize: defaults.batchSize,
    resolution: defaults.resolution,
    mixedPrecision: defaults.mixedPrecision,
    gradientAccumulationSteps: defaults.gradientAccumulationSteps,
    gradientCheckpointing: defaults.gradientCheckpointing,
    cacheLatents: defaults.cacheLatents,
    samplingEnabled: false,
    samplePrompts: [''],
    sampleMode: 'steps',
    sampleEveryEpochs: 1,
    sampleEverySteps: defaults.sampleEvery,
    sampleSteps: defaults.sampleSteps,
    seed: defaults.seed,
    guidanceScale: defaults.guidanceScale,
    noiseScheduler: defaults.noiseScheduler,
    saveEnabled: false,
    saveMode: 'epochs',
    saveEveryEpochs: defaults.saveEvery,
    saveEverySteps: 250,
    saveFormat: defaults.saveFormat,
    saveOnlyLast: defaults.saveOnlyLast,
    saveState: false,
    resumeState: '',
  };
}

function getDefaults(modelId: string): TrainingDefaults {
  const model = getModelById(modelId);
  return model?.defaults ?? MODEL_DEFINITIONS[0].defaults;
}

// --- Reducer ---

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };

    case 'SET_MODEL': {
      const defaults = getDefaults(action.modelId);
      return {
        ...defaultsToFormState(defaults, action.modelId),
        // Preserve user's dataset and output choices
        outputName: state.outputName,
        datasets: state.datasets,
        extraFolders: state.extraFolders,
        samplePrompts: state.samplePrompts,
      };
    }

    case 'SET_MODEL_PATH':
      return {
        ...state,
        modelPaths: { ...state.modelPaths, [action.component]: action.path },
      };

    case 'APPLY_APP_DEFAULTS': {
      // Fill in paths that are empty, preserving user edits
      const merged = { ...state.modelPaths };
      for (const [key, value] of Object.entries(action.paths)) {
        if (value && !merged[key as ModelComponentType]) {
          merged[key as ModelComponentType] = value;
        }
      }
      return { ...state, modelPaths: merged };
    }

    case 'RESET_SECTION': {
      const defaults = getDefaults(state.modelId);
      switch (action.section) {
        case 'whatToTrain':
          return { ...state, modelPaths: {} };
        case 'dataset': {
          // Reset each folder's per-folder augmentation to the model
          // defaults while preserving folder identity (name, images, repeats).
          const baseAugment = defaultFolderAugmentation(defaults);
          return {
            ...state,
            datasets: state.datasets.map((ds) => ({
              ...ds,
              folders: ds.folders.map((f) => ({ ...f, ...baseAugment })),
            })),
            extraFolders: state.extraFolders.map((ef) => ({
              ...ef,
              ...baseAugment,
            })),
          };
        }
        case 'learning':
          return {
            ...state,
            durationMode: 'epochs',
            epochs: defaults.epochs,
            steps: defaults.steps,
            batchSize: defaults.batchSize,
            learningRate: defaults.learningRate,
            optimizer: defaults.optimizer,
            scheduler: defaults.scheduler,
            warmupSteps: defaults.warmupSteps,
            numRestarts: defaults.numRestarts,
            weightDecay: defaults.weightDecay,
            maxGradNorm: defaults.maxGradNorm,
          };
        case 'loraShape':
          return {
            ...state,
            networkType: 'lora',
            networkDim: defaults.networkDim,
            networkAlpha: defaults.networkAlpha,
            networkDropout: defaults.networkDropout,
          };
        case 'performance':
          return {
            ...state,
            resolution: defaults.resolution,
            mixedPrecision: defaults.mixedPrecision,
            gradientAccumulationSteps: defaults.gradientAccumulationSteps,
            gradientCheckpointing: defaults.gradientCheckpointing,
            cacheLatents: defaults.cacheLatents,
          };
        case 'sampling':
          return {
            ...state,
            samplingEnabled: false,
            samplePrompts: [''],
            sampleMode: 'steps' as const,
            sampleEveryEpochs: 1,
            sampleEverySteps: defaults.sampleEvery,
            sampleSteps: defaults.sampleSteps,
            seed: defaults.seed,
            guidanceScale: defaults.guidanceScale,
            noiseScheduler: defaults.noiseScheduler,
          };
        case 'saving':
          return {
            ...state,
            saveEnabled: false,
            saveMode: 'epochs' as const,
            saveEveryEpochs: defaults.saveEvery,
            saveEverySteps: 250,
            saveFormat: defaults.saveFormat,
            saveOnlyLast: defaults.saveOnlyLast,
            saveState: false,
            resumeState: '',
          };
        default:
          return state;
      }
    }

    case 'RESET_ALL': {
      const defaults = getDefaults(state.modelId);
      return defaultsToFormState(defaults, state.modelId);
    }

    case 'ADD_SAMPLE_PROMPT':
      return {
        ...state,
        samplePrompts: [...state.samplePrompts, ''],
      };

    case 'REMOVE_SAMPLE_PROMPT': {
      const prompts = state.samplePrompts.filter((_, i) => i !== action.index);
      return {
        ...state,
        samplePrompts: prompts.length === 0 ? [''] : prompts,
      };
    }

    case 'SET_SAMPLE_PROMPT': {
      const prompts = [...state.samplePrompts];
      prompts[action.index] = action.value;
      return { ...state, samplePrompts: prompts };
    }

    case 'ADD_DATASET': {
      const baseAugment = defaultFolderAugmentation(
        getDefaults(state.modelId),
      );
      return {
        ...state,
        datasets: [
          ...state.datasets,
          {
            projectName: action.displayName,
            folderName: action.folderName,
            thumbnail: action.thumbnail,
            thumbnailVersion: action.thumbnailVersion,
            dimensionHistogram: action.dimensionHistogram,
            folders: action.folders.map((f) => ({ ...f, ...baseAugment })),
          },
        ],
      };
    }

    case 'REMOVE_DATASET':
      return {
        ...state,
        datasets: state.datasets.filter((_, i) => i !== action.index),
      };

    case 'SET_FOLDER_REPEATS': {
      if (action.datasetIndex === null) {
        return {
          ...state,
          extraFolders: state.extraFolders.map((ef) =>
            ef.path === action.folderName
              ? { ...ef, overrideRepeats: action.repeats }
              : ef,
          ),
        };
      }
      const newDatasets = [...state.datasets];
      const ds = newDatasets[action.datasetIndex];
      if (ds) {
        newDatasets[action.datasetIndex] = {
          ...ds,
          folders: ds.folders.map((f) =>
            f.name === action.folderName
              ? { ...f, overrideRepeats: action.repeats }
              : f,
          ),
        };
      }
      return { ...state, datasets: newDatasets };
    }

    case 'UPDATE_FOLDER_AUGMENT': {
      if (action.datasetIndex === null) {
        return {
          ...state,
          extraFolders: state.extraFolders.map((ef) =>
            ef.path === action.folderName ? { ...ef, ...action.updates } : ef,
          ),
        };
      }
      const newDatasets = [...state.datasets];
      const ds = newDatasets[action.datasetIndex];
      if (ds) {
        newDatasets[action.datasetIndex] = {
          ...ds,
          folders: ds.folders.map((f) =>
            f.name === action.folderName ? { ...f, ...action.updates } : f,
          ),
        };
      }
      return { ...state, datasets: newDatasets };
    }

    case 'ADD_EXTRA_FOLDER': {
      if (state.extraFolders.some((ef) => ef.path === action.path)) {
        return state;
      }
      const baseAugment = defaultFolderAugmentation(
        getDefaults(state.modelId),
      );
      return {
        ...state,
        extraFolders: [
          ...state.extraFolders,
          { path: action.path, overrideRepeats: null, ...baseAugment },
        ],
      };
    }

    case 'REMOVE_EXTRA_FOLDER':
      return {
        ...state,
        extraFolders: state.extraFolders.filter((_, i) => i !== action.index),
      };

    default:
      return state;
  }
}

// --- Hook ---

export function useTrainingConfigForm() {
  const initialModel = MODEL_DEFINITIONS[0];
  const [state, dispatch] = useReducer(
    formReducer,
    defaultsToFormState(initialModel.defaults, initialModel.id),
  );

  const currentModel = useMemo(
    () => getModelById(state.modelId),
    [state.modelId],
  );

  const defaults = useMemo(() => getDefaults(state.modelId), [state.modelId]);

  // App-level model defaults (paths per architecture)
  const [appModelDefaults, setAppModelDefaults] = useState<AppModelDefaults>(
    {},
  );

  useEffect(() => {
    fetch('/api/config/model-defaults')
      .then((r) => r.json())
      .then(setAppModelDefaults)
      .catch(() => {});
  }, []);

  // Apply app defaults when model changes or defaults are first loaded
  useEffect(() => {
    if (!currentModel) return;
    const modelDefaults = appModelDefaults[state.modelId];
    if (modelDefaults && Object.keys(modelDefaults).length > 0) {
      dispatch({ type: 'APPLY_APP_DEFAULTS', paths: modelDefaults });
    }
  }, [state.modelId, appModelDefaults, currentModel]);

  // Calculate effective dataset stats (folders with 0 repeats are excluded)
  const datasetStats = useMemo(() => {
    let totalImages = 0;
    let totalEffective = 0;
    for (const ds of state.datasets) {
      for (const folder of ds.folders) {
        const repeats = folder.overrideRepeats ?? folder.detectedRepeats;
        if (repeats === 0) continue;
        totalImages += folder.imageCount;
        totalEffective += folder.imageCount * repeats;
      }
    }
    return { totalImages, totalEffective };
  }, [state.datasets]);

  // Calculate steps from epochs or vice versa
  const calculatedSteps = useMemo(() => {
    if (datasetStats.totalEffective === 0) return 0;
    if (state.durationMode === 'epochs') {
      return Math.ceil(
        (datasetStats.totalEffective * state.epochs) / state.batchSize,
      );
    }
    return state.steps;
  }, [
    state.durationMode,
    state.epochs,
    state.steps,
    state.batchSize,
    datasetStats.totalEffective,
  ]);

  const calculatedEpochs = useMemo(() => {
    if (datasetStats.totalEffective === 0) return 0;
    if (state.durationMode === 'steps') {
      return Math.floor(
        (state.steps * state.batchSize) / datasetStats.totalEffective,
      );
    }
    return state.epochs;
  }, [
    state.durationMode,
    state.epochs,
    state.steps,
    state.batchSize,
    datasetStats.totalEffective,
  ]);

  // Check which sections have been modified from defaults
  const sectionHasChanges = useMemo(() => {
    // A folder counts as customised when any augmentation field drifts
    // from the current model's defaults.
    const baseAugment = defaultFolderAugmentation(defaults);
    const folderCustomised = (f: FolderAugmentation): boolean =>
      f.captionShuffling !== baseAugment.captionShuffling ||
      f.captionDropoutRate !== baseAugment.captionDropoutRate ||
      f.keepTokens !== baseAugment.keepTokens ||
      f.flipAugment !== baseAugment.flipAugment ||
      f.flipVAugment !== baseAugment.flipVAugment;
    const anyFolderCustomised =
      state.datasets.some((ds) => ds.folders.some(folderCustomised)) ||
      state.extraFolders.some(folderCustomised);

    return {
      whatToTrain: false, // Model/dataset selection is always intentional
      dataset: anyFolderCustomised,
      learning:
        state.learningRate !== defaults.learningRate ||
        state.optimizer !== defaults.optimizer ||
        state.scheduler !== defaults.scheduler ||
        state.epochs !== defaults.epochs ||
        state.batchSize !== defaults.batchSize ||
        state.warmupSteps !== defaults.warmupSteps ||
        state.numRestarts !== defaults.numRestarts ||
        state.weightDecay !== defaults.weightDecay ||
        state.maxGradNorm !== defaults.maxGradNorm,
      loraShape:
        state.networkDim !== defaults.networkDim ||
        state.networkAlpha !== defaults.networkAlpha ||
        state.networkType !== 'lora' ||
        state.networkDropout !== defaults.networkDropout,
      performance:
        state.mixedPrecision !== defaults.mixedPrecision ||
        state.gradientAccumulationSteps !==
          defaults.gradientAccumulationSteps ||
        state.gradientCheckpointing !== defaults.gradientCheckpointing ||
        state.cacheLatents !== defaults.cacheLatents,
      sampling: false, // Sampling is opt-in, not compared to defaults
      saving: false, // Saving is opt-in, not compared to defaults
    };
  }, [state, defaults]);

  // Actions
  const setField = useCallback(
    <K extends keyof FormState>(field: K, value: FormState[K]) => {
      dispatch({ type: 'SET_FIELD', field, value });
    },
    [],
  );

  const setModel = useCallback((modelId: string) => {
    dispatch({ type: 'SET_MODEL', modelId });
  }, []);

  const setModelPath = useCallback(
    (component: ModelComponentType, path: string) => {
      dispatch({ type: 'SET_MODEL_PATH', component, path });
    },
    [],
  );

  const resetSection = useCallback((section: SectionName) => {
    dispatch({ type: 'RESET_SECTION', section });
  }, []);

  const resetAll = useCallback(() => {
    dispatch({ type: 'RESET_ALL' });
  }, []);

  const addDataset = useCallback(
    (
      folderName: string,
      displayName: string,
      folders: Omit<DatasetFolder, keyof FolderAugmentation>[],
      thumbnail?: string,
      thumbnailVersion?: number,
      dimensionHistogram?: Record<string, number>,
    ) => {
      dispatch({
        type: 'ADD_DATASET',
        folderName,
        displayName,
        folders,
        thumbnail,
        thumbnailVersion,
        dimensionHistogram,
      });
    },
    [],
  );

  const removeDataset = useCallback((index: number) => {
    dispatch({ type: 'REMOVE_DATASET', index });
  }, []);

  const setFolderRepeats = useCallback(
    (
      datasetIndex: number | null,
      folderName: string,
      repeats: number | null,
    ) => {
      dispatch({
        type: 'SET_FOLDER_REPEATS',
        datasetIndex,
        folderName,
        repeats,
      });
    },
    [],
  );

  const addExtraFolder = useCallback((path: string) => {
    dispatch({ type: 'ADD_EXTRA_FOLDER', path });
  }, []);

  const removeExtraFolder = useCallback((index: number) => {
    dispatch({ type: 'REMOVE_EXTRA_FOLDER', index });
  }, []);

  const updateFolderAugment = useCallback(
    (
      datasetIndex: number | null,
      folderName: string,
      updates: Partial<FolderAugmentation>,
    ) => {
      dispatch({
        type: 'UPDATE_FOLDER_AUGMENT',
        datasetIndex,
        folderName,
        updates,
      });
    },
    [],
  );

  const addSamplePrompt = useCallback(() => {
    dispatch({ type: 'ADD_SAMPLE_PROMPT' });
  }, []);

  const removeSamplePrompt = useCallback((index: number) => {
    dispatch({ type: 'REMOVE_SAMPLE_PROMPT', index });
  }, []);

  const setSamplePrompt = useCallback((index: number, value: string) => {
    dispatch({ type: 'SET_SAMPLE_PROMPT', index, value });
  }, []);

  return {
    state,
    currentModel: currentModel as ModelDefinition,
    defaults,
    appModelDefaults,
    datasetStats,
    calculatedSteps,
    calculatedEpochs,
    sectionHasChanges,
    setField,
    setModel,
    setModelPath,
    resetSection,
    resetAll,
    addDataset,
    removeDataset,
    setFolderRepeats,
    updateFolderAugment,
    addExtraFolder,
    removeExtraFolder,
    addSamplePrompt,
    removeSamplePrompt,
    setSamplePrompt,
    setAppModelDefaults,
  };
}
