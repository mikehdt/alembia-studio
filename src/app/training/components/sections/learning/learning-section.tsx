import { memo, useCallback, useMemo } from 'react';

import {
  OPTIMIZER_OPTIONS,
  SCHEDULER_OPTIONS,
  type TrainingDefaults,
} from '@/app/services/training/models';
import { Checkbox } from '@/app/shared/checkbox';
import { CollapsibleSection } from '@/app/shared/collapsible-section';
import { Dropdown, type DropdownItem } from '@/app/shared/dropdown';
import { Input } from '@/app/shared/input/input';
import { SegmentedControl } from '@/app/shared/segmented-control/segmented-control';
import { Slider } from '@/app/shared/slider/slider';
import type { TrainingViewMode } from '@/app/store/preferences';

import { SchedulerSparkline } from '../../scheduler-sparkline';
import type {
  DurationMode,
  FormState,
  SectionName,
} from '../../training-config-form/use-training-config-form';
import { SectionResetButton } from '../section-reset-button';
import { getLrLabel, lrToSlider, sliderToLr } from './lr-slider-utils';

type LearningSectionProps = {
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
  trainTextEncoder: boolean;
  backboneLR: number;
  textEncoderLR: number;
  ema: boolean;
  lossType: 'mse' | 'huber' | 'smooth_l1';
  timestepType: string;
  timestepBias: 'balanced' | 'earlier' | 'later';
  calculatedSteps: number;
  calculatedEpochs: number;
  totalEffective: number;
  batchSize: number;
  hasChanges: boolean;
  defaults: TrainingDefaults;
  visibleFields: Set<string>;
  hiddenChangesCount?: number;
  viewMode: TrainingViewMode;
  onFieldChange: <K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) => void;
  onReset: (section: SectionName) => void;
};

const LOSS_TYPE_ITEMS: DropdownItem<string>[] = [
  { value: 'mse', label: 'Mean Squared Error (default)' },
  { value: 'huber', label: 'Huber (outlier-robust)' },
  { value: 'smooth_l1', label: 'Smooth L1' },
];

const TIMESTEP_TYPE_ITEMS: DropdownItem<string>[] = [
  { value: 'sigmoid', label: 'Sigmoid' },
  { value: 'linear', label: 'Linear' },
  { value: 'shift', label: 'Shift' },
  { value: 'weighted', label: 'Weighted' },
];

const TIMESTEP_BIAS_ITEMS: DropdownItem<string>[] = [
  { value: 'balanced', label: 'Balanced' },
  { value: 'earlier', label: 'Earlier (coarse structure)' },
  { value: 'later', label: 'Later (fine details)' },
];

const LearningSectionComponent = ({
  durationMode,
  epochs,
  steps,
  learningRate,
  optimizer,
  scheduler,
  warmupSteps,
  numRestarts,
  weightDecay,
  maxGradNorm,
  trainTextEncoder,
  backboneLR,
  textEncoderLR,
  ema,
  lossType,
  timestepType,
  timestepBias,
  calculatedSteps,
  calculatedEpochs,
  totalEffective,
  batchSize,
  hasChanges,
  defaults,
  visibleFields,
  hiddenChangesCount,
  viewMode,
  onFieldChange,
  onReset,
}: LearningSectionProps) => {
  const isSimple = viewMode === 'simple';

  const optimizerItems = useMemo(() => {
    return OPTIMIZER_OPTIONS.map((group) => ({
      groupLabel: group.group,
      items: group.items.map(
        (opt) =>
          ({
            value: opt.value,
            label: (
              <div className="flex flex-col">
                <span>{opt.label}</span>
                <span className="text-xs text-slate-400">{opt.hint}</span>
              </div>
            ),
          }) satisfies DropdownItem<string>,
      ),
    }));
  }, []);

  const selectedOptimizer = OPTIMIZER_OPTIONS.flatMap((g) => g.items).find(
    (o) => o.value === optimizer,
  );

  const selectedScheduler = SCHEDULER_OPTIONS.find(
    (s) => s.value === scheduler,
  );

  const schedulerItems = useMemo(() => {
    return SCHEDULER_OPTIONS.map(
      (sched) =>
        ({
          value: sched.value,
          label: (
            <div className="flex items-center gap-2">
              <SchedulerSparkline
                curve={sched.curve}
                className="text-sky-500"
              />
              <div className="flex flex-col">
                <span>{sched.label}</span>
                <span className="text-xs text-slate-400">{sched.hint}</span>
              </div>
            </div>
          ),
        }) satisfies DropdownItem<string>,
    );
  }, []);

  const showDuration =
    visibleFields.has('durationMode' satisfies keyof FormState) ||
    visibleFields.has('epochs' satisfies keyof FormState) ||
    visibleFields.has('steps' satisfies keyof FormState);

  const sliderPosition = lrToSlider(learningRate);
  const lrLabel = getLrLabel(learningRate);

  const handleLrSlider = useCallback(
    (pos: number) => {
      onFieldChange('learningRate', sliderToLr(pos));
    },
    [onFieldChange],
  );

  const handleLrTextChange = useCallback(
    (raw: string) => {
      const parsed = parseFloat(raw);
      if (!Number.isFinite(parsed) || parsed <= 0) return;
      onFieldChange('learningRate', parsed);
    },
    [onFieldChange],
  );

  return (
    <CollapsibleSection
      title="Learning"
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
          <SectionResetButton onClick={() => onReset('learning')} />
        ) : undefined
      }
    >
      <div className="space-y-3">
        {/* Duration */}
        {showDuration && (
          <div>
            <div className="mb-1 flex items-center gap-2">
              <label className="text-xs font-medium text-(--foreground)/70">
                Duration
              </label>
              <SegmentedControl
                options={[
                  { value: 'epochs', label: 'Epochs' },
                  { value: 'steps', label: 'Steps' },
                ]}
                value={durationMode}
                onChange={(val) => onFieldChange('durationMode', val)}
                size="sm"
              />
            </div>

            <Input
              type="number"
              min={1}
              value={durationMode === 'epochs' ? epochs : steps}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val > 0) {
                  onFieldChange(
                    durationMode === 'epochs' ? 'epochs' : 'steps',
                    val,
                  );
                }
              }}
              className="w-32"
            />

            {totalEffective > 0 && (
              <p className="mt-1 text-xs text-slate-400 tabular-nums">
                {totalEffective} images/epoch &times;{' '}
                {durationMode === 'epochs' ? epochs : calculatedEpochs} epochs
                &divide; {batchSize} batch ={' '}
                <span className="font-medium text-slate-500">
                  {durationMode === 'epochs'
                    ? calculatedSteps.toLocaleString()
                    : steps.toLocaleString()}{' '}
                  steps
                </span>
              </p>
            )}
          </div>
        )}

        {/* Batch Size */}
        {visibleFields.has('batchSize' satisfies keyof FormState) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              Batch Size
            </label>
            <Input
              type="number"
              min={1}
              max={8}
              value={batchSize}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val > 0) onFieldChange('batchSize', val);
              }}
              className="w-20"
            />
            {batchSize > 1 && (
              <p className="mt-1 text-xs text-amber-500">
                Higher batch sizes use significantly more VRAM
              </p>
            )}
          </div>
        )}

        {/* Learning Rate */}
        {visibleFields.has('learningRate' satisfies keyof FormState) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              Learning Rate
            </label>
            {isSimple ? (
              <Slider
                min={0}
                max={100}
                step={1}
                value={Math.round(sliderPosition)}
                onChange={handleLrSlider}
                showTrackFill
                startLabel="Slower"
                midLabel={lrLabel}
                endLabel="Faster"
                valueDisplay={learningRate}
                numberInputSize="md"
                onValueDisplayChange={handleLrTextChange}
                ariaLabel="Learning rate"
              />
            ) : (
              /* Intermediate+: direct number input */
              <Input
                type="text"
                value={learningRate}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0) {
                    onFieldChange('learningRate', val);
                  }
                }}
                placeholder={String(defaults.learningRate)}
                className="w-32 tabular-nums"
              />
            )}
          </div>
        )}

        {/* Optimizer — read-only in Simple, interactive in Intermediate+ */}
        {visibleFields.has('optimizer' satisfies keyof FormState) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              Optimiser
            </label>
            {isSimple ? (
              <p className="text-sm text-(--foreground)/80">
                {selectedOptimizer?.label ?? optimizer}
                {selectedOptimizer && (
                  <span className="ml-1 text-xs text-slate-400">
                    — {selectedOptimizer.hint}
                  </span>
                )}
              </p>
            ) : (
              <>
                <Dropdown
                  items={optimizerItems}
                  selectedValue={optimizer}
                  onChange={(val) => onFieldChange('optimizer', val)}
                  selectedValueRenderer={() => (
                    <span className="text-sm">
                      {selectedOptimizer?.label ?? optimizer}
                    </span>
                  )}
                  aria-label="Select optimizer"
                />
                {selectedOptimizer && (
                  <p className="mt-1 text-xs text-slate-400">
                    {selectedOptimizer.hint}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Scheduler — read-only in Simple, interactive in Intermediate+ */}
        {visibleFields.has('scheduler' satisfies keyof FormState) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              LR Scheduler
            </label>
            {isSimple ? (
              <div className="flex items-center gap-2 text-sm text-(--foreground)/80">
                {selectedScheduler && (
                  <SchedulerSparkline
                    curve={selectedScheduler.curve}
                    className="text-sky-500"
                  />
                )}
                <span>{selectedScheduler?.label ?? scheduler}</span>
                {selectedScheduler && (
                  <span className="text-xs text-slate-400">
                    — {selectedScheduler.hint}
                  </span>
                )}
              </div>
            ) : (
              <>
                <Dropdown
                  items={schedulerItems}
                  selectedValue={scheduler}
                  onChange={(val) => onFieldChange('scheduler', val)}
                  selectedValueRenderer={() => (
                    <div className="flex items-center gap-2">
                      {selectedScheduler && (
                        <SchedulerSparkline
                          curve={selectedScheduler.curve}
                          className="text-sky-500"
                        />
                      )}
                      <span className="text-sm">
                        {selectedScheduler?.label ?? scheduler}
                      </span>
                    </div>
                  )}
                  aria-label="LR scheduler"
                />
                {selectedScheduler && (
                  <p className="mt-1 text-xs text-slate-400">
                    {selectedScheduler.hint}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Warmup */}
        {visibleFields.has('warmupSteps' satisfies keyof FormState) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              Warmup Steps
            </label>
            <Input
              type="number"
              min={0}
              value={warmupSteps}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val >= 0) onFieldChange('warmupSteps', val);
              }}
              placeholder={String(defaults.warmupSteps)}
              className="w-32"
            />
          </div>
        )}

        {/* Restarts (cosine_with_restarts only) */}
        {visibleFields.has('numRestarts' satisfies keyof FormState) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              Restarts
            </label>
            <Input
              type="number"
              min={1}
              value={numRestarts}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val >= 1) onFieldChange('numRestarts', val);
              }}
              placeholder={String(defaults.numRestarts)}
              className="w-32"
            />
            <p className="mt-1 text-xs text-slate-400">
              Number of cosine cycles during training
            </p>
          </div>
        )}

        {/* Weight Decay */}
        {visibleFields.has('weightDecay' satisfies keyof FormState) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              Weight Decay
            </label>
            <Input
              type="text"
              value={weightDecay}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val >= 0) onFieldChange('weightDecay', val);
              }}
              placeholder={String(defaults.weightDecay)}
              className="w-32 tabular-nums"
            />
            <p className="mt-1 text-xs text-slate-400">
              L2 regularisation to prevent overfitting (0 = disabled)
            </p>
          </div>
        )}

        {/* Max Gradient Norm */}
        {visibleFields.has('maxGradNorm' satisfies keyof FormState) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              Max Gradient Norm
            </label>
            <Input
              type="text"
              value={maxGradNorm}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val >= 0) onFieldChange('maxGradNorm', val);
              }}
              placeholder={String(defaults.maxGradNorm)}
              className="w-32 tabular-nums"
            />
            <p className="mt-1 text-xs text-slate-400">
              Clip gradients to keep training stable (0 = disabled, 1.0 is
              standard)
            </p>
          </div>
        )}

        {/* Train Text Encoder */}
        {visibleFields.has('trainTextEncoder' satisfies keyof FormState) && (
          <div className="flex items-center gap-2">
            <Checkbox
              isSelected={trainTextEncoder}
              onChange={() =>
                onFieldChange('trainTextEncoder', !trainTextEncoder)
              }
              label="Train Text Encoder"
              size="sm"
            />
            <span className="text-xs text-slate-400">
              Also train the text encoder alongside the backbone
            </span>
          </div>
        )}

        {/* Backbone Learning Rate */}
        {visibleFields.has('backboneLR' satisfies keyof FormState) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              Backbone Learning Rate
            </label>
            <Input
              type="text"
              value={backboneLR}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val >= 0) onFieldChange('backboneLR', val);
              }}
              placeholder={String(defaults.backboneLR)}
              className="w-32 tabular-nums"
            />
            <p className="mt-1 text-xs text-slate-400">
              Override the main LR for the backbone (0 = use main LR)
            </p>
          </div>
        )}

        {/* Text Encoder Learning Rate — only visible when trainTextEncoder is on */}
        {visibleFields.has('textEncoderLR' satisfies keyof FormState) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              Text Encoder Learning Rate
            </label>
            <Input
              type="text"
              value={textEncoderLR}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val >= 0)
                  onFieldChange('textEncoderLR', val);
              }}
              placeholder={String(defaults.textEncoderLR)}
              className="w-32 tabular-nums"
            />
            <p className="mt-1 text-xs text-slate-400">
              Override the main LR for the text encoder (0 = use main LR)
            </p>
          </div>
        )}

        {/* EMA */}
        {visibleFields.has('ema' satisfies keyof FormState) && (
          <div className="flex items-center gap-2">
            <Checkbox
              isSelected={ema}
              onChange={() => onFieldChange('ema', !ema)}
              label="Use EMA"
              size="sm"
            />
            <span className="text-xs text-slate-400">
              Exponential moving average of weights — can improve stability
            </span>
          </div>
        )}

        {/* Loss Type */}
        {visibleFields.has('lossType' satisfies keyof FormState) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              Loss Type
            </label>
            <Dropdown
              items={LOSS_TYPE_ITEMS}
              selectedValue={lossType}
              onChange={(val) =>
                onFieldChange('lossType', val as FormState['lossType'])
              }
              aria-label="Loss type"
            />
          </div>
        )}

        {/* Timestep Type (flow-matching models) */}
        {visibleFields.has('timestepType' satisfies keyof FormState) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              Timestep Type
            </label>
            <Dropdown
              items={TIMESTEP_TYPE_ITEMS}
              selectedValue={timestepType}
              onChange={(val) => onFieldChange('timestepType', val)}
              aria-label="Timestep type"
            />
            <p className="mt-1 text-xs text-slate-400">
              Sampling distribution for training timesteps (flow-matching)
            </p>
          </div>
        )}

        {/* Timestep Bias */}
        {visibleFields.has('timestepBias' satisfies keyof FormState) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              Timestep Bias
            </label>
            <Dropdown
              items={TIMESTEP_BIAS_ITEMS}
              selectedValue={timestepBias}
              onChange={(val) =>
                onFieldChange('timestepBias', val as FormState['timestepBias'])
              }
              aria-label="Timestep bias"
            />
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};

export const LearningSection = memo(LearningSectionComponent);
