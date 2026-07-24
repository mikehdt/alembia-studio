import type { SampleImage } from '@/app/services/training/types';
import type { TrainingJob } from '@/app/store/jobs';

/** A prompt column in the samples grid. */
export type SampleColumn = {
  /** The prompt index this column maps to (the sample's `promptIndex`). */
  index: number;
  /** Truncated-in-CSS header text; full text lives on the title attr/lightbox. */
  label: string;
};

/** One sampling event (a row): every prompt sampled at the same step/epoch. */
export type SampleRow = {
  /** Stable key for the grouped sampling event. */
  key: string;
  /** Row stamp, e.g. "Step 500" or "Epoch 3". */
  label: string;
  /** True when the run samples on an epoch cadence (label reads "Epoch N"). */
  isEpoch: boolean;
  /** One cell per column; null where that prompt hasn't been sampled yet. */
  cells: (SampleImage | null)[];
};

export type SamplesGridModel = {
  columns: SampleColumn[];
  rows: SampleRow[];
};

/**
 * Build the samples grid from a job's live/archived progress. Columns are the
 * configured prompts (falling back to "Prompt N" where a sample's index runs
 * past the list); rows are sampling events grouped by epoch (epoch-cadence
 * runs, where step is 0) or step, newest first.
 */
export function buildSamplesGrid(job: TrainingJob | null): SamplesGridModel {
  const samples = job?.progress?.samples ?? [];
  const prompts = job?.config?.samplePrompts ?? [];

  if (samples.length === 0) return { columns: [], rows: [] };

  const maxPromptIndex = samples.reduce(
    (max, s) => Math.max(max, s.promptIndex),
    -1,
  );
  const columnCount = Math.max(prompts.length, maxPromptIndex + 1);

  const columns: SampleColumn[] = Array.from(
    { length: columnCount },
    (_, i) => ({
      index: i,
      label: prompts[i]?.trim() || `Prompt ${i + 1}`,
    }),
  );

  // Group by sampling event: epoch-cadence runs carry a non-null epoch (step is
  // 0), step-cadence runs carry a null epoch. Key + sort value follow whichever
  // unit the run actually samples on.
  const groups = new Map<
    string,
    { sortValue: number; row: SampleRow }
  >();

  for (const sample of samples) {
    const isEpoch = sample.epoch != null;
    const key = isEpoch ? `e${sample.epoch}` : `s${sample.step}`;
    const sortValue = isEpoch ? (sample.epoch as number) : sample.step;

    let group = groups.get(key);
    if (!group) {
      group = {
        sortValue,
        row: {
          key,
          label: isEpoch ? `Epoch ${sample.epoch}` : `Step ${sample.step}`,
          isEpoch,
          cells: Array.from({ length: columnCount }, () => null),
        },
      };
      groups.set(key, group);
    }

    if (sample.promptIndex >= 0 && sample.promptIndex < columnCount) {
      group.row.cells[sample.promptIndex] = sample;
    }
  }

  const rows = Array.from(groups.values())
    .sort((a, b) => b.sortValue - a.sortValue)
    .map((g) => g.row);

  return { columns, rows };
}

/**
 * URL for a sample served by `/api/training/samples/[...path]`. The stored path
 * is loras-root-relative with POSIX separators — encode each segment but keep
 * the separators so the route's `[...path]` splits it back correctly.
 */
export function sampleUrl(relativePath: string): string {
  const encoded = relativePath.split('/').map(encodeURIComponent).join('/');
  return `/api/training/samples/${encoded}`;
}
