import { memo } from 'react';

import type { TrainingProvider } from '@/app/services/training/types';
import { Checkbox } from '@/app/shared/checkbox';
import { CollapsibleSection } from '@/app/shared/collapsible-section';
import { Dropdown, type DropdownItem } from '@/app/shared/dropdown';
import { Input } from '@/app/shared/input/input';

import type {
  FormState,
  SectionName,
} from '../training-config-form/use-training-config-form';
import { SectionResetButton } from './section-reset-button';

type PerformanceSectionProps = {
  /** Read-only, for effective batch size display in gradient accumulation */
  batchSize: number;
  resolution: number[];
  availableResolutions: number[];
  provider: TrainingProvider;
  mixedPrecision: 'bf16' | 'fp16';
  transformerQuantization: 'none' | 'float8';
  textEncoderQuantization: 'none' | 'float8';
  cacheTextEmbeddings: boolean;
  unloadTextEncoder: boolean;
  gradientAccumulationSteps: number;
  gradientCheckpointing: boolean;
  cacheLatents: boolean;
  hasChanges: boolean;
  visibleFields: Set<string>;
  hiddenChangesCount?: number;
  onFieldChange: <K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) => void;
  onReset: (section: SectionName) => void;
};

const PRECISION_ITEMS: DropdownItem<string>[] = [
  { value: 'bf16', label: 'bfloat16' },
  { value: 'fp16', label: 'float16' },
];

const QUANTIZATION_ITEMS: DropdownItem<string>[] = [
  { value: 'none', label: 'None (full precision)' },
  { value: 'float8', label: 'float8 (lower VRAM)' },
];

const PerformanceSectionComponent = ({
  batchSize,
  resolution,
  availableResolutions,
  provider,
  mixedPrecision,
  transformerQuantization,
  textEncoderQuantization,
  cacheTextEmbeddings,
  unloadTextEncoder,
  gradientAccumulationSteps,
  gradientCheckpointing,
  cacheLatents,
  hasChanges,
  visibleFields,
  hiddenChangesCount,
  onFieldChange,
  onReset,
}: PerformanceSectionProps) => {
  const isKohya = provider === 'kohya';

  const hasVisibleFields =
    visibleFields.has('resolution') ||
    visibleFields.has('mixedPrecision') ||
    visibleFields.has('transformerQuantization') ||
    visibleFields.has('textEncoderQuantization') ||
    visibleFields.has('cacheTextEmbeddings') ||
    visibleFields.has('unloadTextEncoder') ||
    visibleFields.has('gradientAccumulationSteps') ||
    visibleFields.has('gradientCheckpointing') ||
    visibleFields.has('cacheLatents');

  if (!hasVisibleFields) return null;

  const handleToggleResolution = (res: number) => {
    if (isKohya) {
      // Kohya: single-select — replace the entire array
      onFieldChange('resolution', [res]);
      return;
    }
    // ai-toolkit: multi-select toggle
    if (resolution.includes(res)) {
      if (resolution.length > 1) {
        onFieldChange(
          'resolution',
          resolution.filter((r) => r !== res),
        );
      }
    } else {
      onFieldChange(
        'resolution',
        [...resolution, res].sort((a, b) => a - b),
      );
    }
  };

  return (
    <CollapsibleSection
      title="Performance"
      headerExtra={
        <>
          {hasChanges && (
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
          )}
          {hiddenChangesCount ? (
            <span className="text-xs text-amber-500/70">
              {hiddenChangesCount} hidden{' '}
              {hiddenChangesCount === 1 ? 'setting' : 'settings'} customised
            </span>
          ) : undefined}
        </>
      }
      headerActions={(expanded) =>
        hasChanges && expanded ? (
          <SectionResetButton onClick={() => onReset('performance')} />
        ) : undefined
      }
    >
      <div className="space-y-3">
        {/* Mixed Precision */}
        {visibleFields.has('mixedPrecision' satisfies keyof FormState) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              Training Precision
            </label>
            <Dropdown
              items={PRECISION_ITEMS}
              selectedValue={mixedPrecision}
              onChange={(val) =>
                onFieldChange(
                  'mixedPrecision',
                  val as FormState['mixedPrecision'],
                )
              }
              aria-label="Training precision"
            />
            <p className="mt-1 text-xs text-slate-400">
              Compute dtype. BF16 is more stable on modern GPUs (RTX 3000+)
            </p>
          </div>
        )}

        {/* Transformer Quantization */}
        {visibleFields.has(
          'transformerQuantization' satisfies keyof FormState,
        ) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              Transformer Quantization
            </label>
            <Dropdown
              items={QUANTIZATION_ITEMS}
              selectedValue={transformerQuantization}
              onChange={(val) =>
                onFieldChange(
                  'transformerQuantization',
                  val as FormState['transformerQuantization'],
                )
              }
              aria-label="Transformer quantization"
            />
            <p className="mt-1 text-xs text-slate-400">
              Quantise base-model weights to fit larger models in VRAM
            </p>
          </div>
        )}

        {/* Text Encoder Quantization */}
        {visibleFields.has(
          'textEncoderQuantization' satisfies keyof FormState,
        ) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              Text Encoder Quantization
            </label>
            <Dropdown
              items={QUANTIZATION_ITEMS}
              selectedValue={textEncoderQuantization}
              onChange={(val) =>
                onFieldChange(
                  'textEncoderQuantization',
                  val as FormState['textEncoderQuantization'],
                )
              }
              aria-label="Text encoder quantization"
            />
            <p className="mt-1 text-xs text-slate-400">
              Applies to T5, CLIP or Qwen text encoders as relevant
            </p>
          </div>
        )}

        {/* Cache Text Embeddings */}
        {visibleFields.has(
          'cacheTextEmbeddings' satisfies keyof FormState,
        ) && (
          <div className="flex items-center gap-2">
            <Checkbox
              isSelected={cacheTextEmbeddings}
              onChange={() =>
                onFieldChange('cacheTextEmbeddings', !cacheTextEmbeddings)
              }
              label="Cache Text Embeddings"
              size="sm"
            />
            <span className="text-xs text-slate-400">
              Pre-compute caption embeddings once, reuse every epoch
            </span>
          </div>
        )}

        {/* Unload Text Encoder */}
        {visibleFields.has(
          'unloadTextEncoder' satisfies keyof FormState,
        ) && (
          <div className="flex items-center gap-2">
            <Checkbox
              isSelected={unloadTextEncoder}
              onChange={() =>
                onFieldChange('unloadTextEncoder', !unloadTextEncoder)
              }
              label="Unload Text Encoder"
              size="sm"
            />
            <span className="text-xs text-slate-400">
              Drop TE from VRAM after caching embeddings (requires caching)
            </span>
          </div>
        )}

        {/* Resolution */}
        {visibleFields.has('resolution' satisfies keyof FormState) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              {isKohya ? 'Base Resolution' : 'Training Resolutions'}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {availableResolutions.map((res) => {
                const isActive = resolution.includes(res);
                return (
                  <button
                    key={res}
                    type="button"
                    onClick={() => handleToggleResolution(res)}
                    className={`cursor-pointer rounded-sm border px-3 py-1 text-xs font-medium tabular-nums transition-colors ${
                      isActive
                        ? 'border-sky-400 bg-sky-100 text-sky-700 dark:border-sky-600 dark:bg-sky-900/40 dark:text-sky-300'
                        : 'border-(--border-subtle) text-slate-400 hover:border-slate-400 hover:text-slate-600 dark:hover:border-slate-500 dark:hover:text-slate-300'
                    }`}
                  >
                    {res}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Gradient Accumulation */}
        {visibleFields.has(
          'gradientAccumulationSteps' satisfies keyof FormState,
        ) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              Gradient Accumulation Steps
            </label>
            <Input
              type="number"
              min={1}
              max={16}
              value={gradientAccumulationSteps}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val > 0) onFieldChange('gradientAccumulationSteps', val);
              }}
              className="w-20"
            />
            {gradientAccumulationSteps > 1 && (
              <p className="mt-1 text-xs text-slate-400">
                Effective batch size:{' '}
                <span className="font-medium">
                  {batchSize * gradientAccumulationSteps}
                </span>{' '}
                ({batchSize} &times; {gradientAccumulationSteps})
              </p>
            )}
          </div>
        )}

        {/* Gradient Checkpointing */}
        {visibleFields.has(
          'gradientCheckpointing' satisfies keyof FormState,
        ) && (
          <div className="flex items-center gap-2">
            <Checkbox
              isSelected={gradientCheckpointing}
              onChange={() =>
                onFieldChange('gradientCheckpointing', !gradientCheckpointing)
              }
              label="Gradient Checkpointing"
              size="sm"
            />
            <span className="text-xs text-slate-400">
              Reduces VRAM at cost of speed
            </span>
          </div>
        )}

        {/* Cache Latents */}
        {visibleFields.has('cacheLatents' satisfies keyof FormState) && (
          <div className="flex items-center gap-2">
            <Checkbox
              isSelected={cacheLatents}
              onChange={() => onFieldChange('cacheLatents', !cacheLatents)}
              label="Cache Latents"
              size="sm"
            />
            <span className="text-xs text-slate-400">
              Caches VAE outputs for faster training
            </span>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};

/** Informational preview of Kohya bucketing for a given base resolution. */
export const PerformanceSection = memo(PerformanceSectionComponent);
