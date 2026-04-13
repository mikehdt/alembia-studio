/**
 * Centralised field registry for the training configuration form.
 * Maps every form field to its expertise tier, conceptual group,
 * and corresponding TrainingDefaults key (for change detection).
 */

import type { TrainingDefaults } from './models';
import { getModelById } from './models';

export type ExpertiseTier = 'simple' | 'intermediate' | 'advanced' | 'expert';

type ConceptualGroup =
  | 'whatToTrain'
  | 'dataset'
  | 'learning'
  | 'loraShape'
  | 'performance'
  | 'sampling'
  | 'saving';

type FieldMeta = {
  tier: ExpertiseTier;
  group: ConceptualGroup;
  /** Key on TrainingDefaults to compare against (null for fields with no model default) */
  defaultKey: keyof TrainingDefaults | null;
};

/**
 * Every form field mapped to its tier, group, and default key.
 *
 * Simple tier: enough to start a training run with good defaults.
 * Intermediate tier: tune behaviour, interactive controls.
 * Advanced tier: full control for experienced users.
 * Expert tier: future (block weights etc).
 *
 * Note: optimizer and scheduler are Simple tier but render as read-only info
 * in Simple mode, becoming interactive dropdowns in Intermediate+. This is
 * handled by the section components, not the registry.
 */
export const FIELD_REGISTRY: Record<string, FieldMeta> = {
  // What to Train
  modelId: { tier: 'simple', group: 'whatToTrain', defaultKey: null },
  modelPaths: { tier: 'simple', group: 'whatToTrain', defaultKey: null },
  outputName: { tier: 'simple', group: 'saving', defaultKey: null },
  datasets: { tier: 'simple', group: 'dataset', defaultKey: null },
  extraFolders: { tier: 'intermediate', group: 'dataset', defaultKey: null },

  // Learning
  durationMode: { tier: 'simple', group: 'learning', defaultKey: null },
  epochs: { tier: 'simple', group: 'learning', defaultKey: 'epochs' },
  steps: { tier: 'simple', group: 'learning', defaultKey: 'steps' },
  learningRate: {
    tier: 'simple',
    group: 'learning',
    defaultKey: 'learningRate',
  },
  // Shown as read-only info in Simple, interactive in Intermediate+
  optimizer: {
    tier: 'simple',
    group: 'learning',
    defaultKey: 'optimizer',
  },
  scheduler: {
    tier: 'simple',
    group: 'learning',
    defaultKey: 'scheduler',
  },
  warmupSteps: {
    tier: 'intermediate',
    group: 'learning',
    defaultKey: 'warmupSteps',
  },
  numRestarts: {
    tier: 'intermediate',
    group: 'learning',
    defaultKey: 'numRestarts',
  },
  weightDecay: {
    tier: 'advanced',
    group: 'learning',
    defaultKey: 'weightDecay',
  },

  // LoRA Shape
  networkDim: {
    tier: 'intermediate',
    group: 'loraShape',
    defaultKey: 'networkDim',
  },
  networkAlpha: {
    tier: 'intermediate',
    group: 'loraShape',
    defaultKey: 'networkAlpha',
  },
  networkType: {
    tier: 'intermediate',
    group: 'loraShape',
    defaultKey: null,
  },

  // Performance
  batchSize: {
    tier: 'simple',
    group: 'learning',
    defaultKey: 'batchSize',
  },
  mixedPrecision: {
    tier: 'simple',
    group: 'performance',
    defaultKey: 'mixedPrecision',
  },
  cacheLatents: {
    tier: 'simple',
    group: 'performance',
    defaultKey: 'cacheLatents',
  },
  resolution: {
    tier: 'intermediate',
    group: 'performance',
    defaultKey: 'resolution',
  },
  gradientAccumulationSteps: {
    tier: 'advanced',
    group: 'performance',
    defaultKey: 'gradientAccumulationSteps',
  },
  gradientCheckpointing: {
    tier: 'advanced',
    group: 'performance',
    defaultKey: 'gradientCheckpointing',
  },
  captionDropoutRate: {
    tier: 'advanced',
    group: 'dataset',
    defaultKey: 'captionDropoutRate',
  },
  captionShuffling: {
    tier: 'intermediate',
    group: 'dataset',
    defaultKey: 'captionShuffling',
  },
  flipAugment: {
    tier: 'intermediate',
    group: 'dataset',
    defaultKey: 'flipAugment',
  },
  flipVAugment: {
    tier: 'advanced',
    group: 'dataset',
    defaultKey: 'flipVAugment',
  },

  // Sampling
  samplingEnabled: {
    tier: 'intermediate',
    group: 'sampling',
    defaultKey: null,
  },
  samplePrompts: {
    tier: 'intermediate',
    group: 'sampling',
    defaultKey: null,
  },
  sampleMode: { tier: 'intermediate', group: 'sampling', defaultKey: null },
  sampleEveryEpochs: {
    tier: 'intermediate',
    group: 'sampling',
    defaultKey: null,
  },
  sampleEverySteps: {
    tier: 'intermediate',
    group: 'sampling',
    defaultKey: null,
  },
  sampleSteps: {
    tier: 'intermediate',
    group: 'sampling',
    defaultKey: 'sampleSteps',
  },
  seed: { tier: 'simple', group: 'sampling', defaultKey: null },
  guidanceScale: {
    tier: 'advanced',
    group: 'sampling',
    defaultKey: 'guidanceScale',
  },
  noiseScheduler: {
    tier: 'advanced',
    group: 'sampling',
    defaultKey: 'noiseScheduler',
  },

  // Saving
  saveFormat: {
    tier: 'simple',
    group: 'saving',
    defaultKey: 'saveFormat',
  },
  saveEnabled: { tier: 'simple', group: 'saving', defaultKey: null },
  saveMode: { tier: 'simple', group: 'saving', defaultKey: null },
  saveEveryEpochs: { tier: 'simple', group: 'saving', defaultKey: null },
  saveEverySteps: { tier: 'simple', group: 'saving', defaultKey: null },
};

const GROUP_META: Record<
  ConceptualGroup,
  { label: string; order: number }
> = {
  whatToTrain: { label: 'What to Train', order: 0 },
  dataset: { label: 'Dataset', order: 1 },
  learning: { label: 'Learning', order: 2 },
  loraShape: { label: 'LoRA Shape', order: 3 },
  performance: { label: 'Performance', order: 4 },
  sampling: { label: 'Sampling', order: 5 },
  saving: { label: 'Saving', order: 6 },
};

const TIER_ORDER: ExpertiseTier[] = [
  'simple',
  'intermediate',
  'advanced',
  'expert',
];

/** Check if `current` tier is at least as high as `required`. */
export function isTierAtLeast(
  current: ExpertiseTier,
  required: ExpertiseTier,
): boolean {
  return TIER_ORDER.indexOf(current) >= TIER_ORDER.indexOf(required);
}

/** Get the set of visible field names for a given tier and model. */
export function getVisibleFields(
  tier: ExpertiseTier,
  modelId: string,
): Set<string> {
  const model = getModelById(modelId);
  const hiddenByModel = new Set(model?.hiddenFields ?? []);

  const visible = new Set<string>();
  for (const [field, meta] of Object.entries(FIELD_REGISTRY)) {
    if (!isTierAtLeast(tier, meta.tier)) continue;
    if (meta.defaultKey && hiddenByModel.has(meta.defaultKey)) continue;
    visible.add(field);
  }
  return visible;
}

/** Get all field names belonging to a conceptual group. */
function getFieldsForGroup(group: ConceptualGroup): string[] {
  return Object.entries(FIELD_REGISTRY)
    .filter(([, meta]) => meta.group === group)
    .map(([field]) => field);
}
