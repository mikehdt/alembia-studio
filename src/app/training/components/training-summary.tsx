import {
  CheckCircle2Icon,
  CircleDashedIcon,
  CircleDotIcon,
} from 'lucide-react';
import { memo, useMemo } from 'react';

import {
  type ModelComponentType,
  type ModelDefinition,
  OPTIMIZER_OPTIONS,
  SCHEDULER_OPTIONS,
} from '@/app/services/training/models';

type TrainingSummaryProps = {
  outputName: string;
  currentModel: ModelDefinition;
  modelPaths: Partial<Record<ModelComponentType, string>>;
  totalImages: number;
  totalEffective: number;
  durationMode: 'epochs' | 'steps';
  epochs: number;
  steps: number;
  calculatedSteps: number;
  calculatedEpochs: number;
  batchSize: number;
  learningRate: number;
  optimizer: string;
  scheduler: string;
  networkType: string;
  networkDim: number;
  networkAlpha: number;
  resolution: number[];
  saveEnabled: boolean;
  saveMode: 'epochs' | 'steps';
  saveEveryEpochs: number;
  saveEverySteps: number;
  saveFormat: string;
};

const ReadinessItem = ({
  label,
  isReady,
  detail,
  isSummary,
}: {
  label: string;
  isReady: boolean;
  detail?: string;
  isSummary?: boolean;
}) => {
  const NotReadyIcon = isSummary ? CircleDotIcon : CircleDashedIcon;
  const notReadyColour = isSummary ? 'text-amber-500' : 'text-slate-400';

  return (
    <div className="flex items-center gap-1.5">
      {isReady ? (
        <CheckCircle2Icon className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-500" />
      ) : (
        <NotReadyIcon
          className={`mt-px h-3.5 w-3.5 shrink-0 ${notReadyColour}`}
        />
      )}
      <div className="min-w-0">
        <span
          className={`text-xs ${isSummary ? 'font-medium' : ''} ${isReady ? 'text-(--foreground)/70' : isSummary ? 'text-(--foreground)/70' : 'text-slate-400'}`}
        >
          {label}
        </span>
        {detail && (
          <span className="ml-1 text-xs text-slate-400">{detail}</span>
        )}
      </div>
    </div>
  );
};

const SummaryRow = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-baseline justify-between gap-2">
    <span className="shrink-0 text-xs text-slate-400">{label}</span>
    <span className="min-w-0 truncate text-right text-xs font-medium text-(--foreground)/70">
      {children}
    </span>
  </div>
);

const TrainingSummaryComponent = ({
  outputName,
  currentModel,
  modelPaths,
  totalImages,
  totalEffective,
  durationMode,
  epochs,
  steps,
  calculatedSteps,
  calculatedEpochs,
  batchSize,
  learningRate,
  optimizer,
  scheduler,
  networkType,
  networkDim,
  networkAlpha,
  resolution,
  saveEnabled,
  saveMode,
  saveEveryEpochs,
  saveEverySteps,
  saveFormat,
}: TrainingSummaryProps) => {
  const hasOutputName = outputName.trim() !== '';
  const hasDataset = totalImages > 0;

  const requiredComponents = currentModel.components.filter((c) => c.required);
  const missingComponents = requiredComponents.filter(
    (c) => !modelPaths[c.type]?.trim(),
  );
  const hasAllComponents = missingComponents.length === 0;

  const effectiveSteps = durationMode === 'epochs' ? calculatedSteps : steps;
  const effectiveEpochs = durationMode === 'steps' ? calculatedEpochs : epochs;

  const checkpointCount = useMemo(() => {
    if (!saveEnabled || !hasDataset) return 0;
    if (saveMode === 'epochs') {
      return saveEveryEpochs > 0
        ? Math.floor(effectiveEpochs / saveEveryEpochs)
        : 0;
    }
    return saveEverySteps > 0 ? Math.floor(effectiveSteps / saveEverySteps) : 0;
  }, [
    saveEnabled,
    hasDataset,
    saveMode,
    saveEveryEpochs,
    saveEverySteps,
    effectiveEpochs,
    effectiveSteps,
  ]);

  const optimizerLabel = useMemo(() => {
    for (const group of OPTIMIZER_OPTIONS) {
      const match = group.items.find((o) => o.value === optimizer);
      if (match) return match.label;
    }
    return optimizer;
  }, [optimizer]);

  const schedulerLabel = useMemo(() => {
    return (
      SCHEDULER_OPTIONS.find((s) => s.value === scheduler)?.label ?? scheduler
    );
  }, [scheduler]);

  return (
    <div className="flex flex-col gap-y-4">
      {/* Training overview */}
      <div className="rounded-lg border border-slate-200 bg-(--surface)/30 p-3 dark:border-slate-700">
        <span className="mb-2 block text-xs font-medium text-(--foreground)/70">
          Overview
        </span>
        <div className="space-y-1">
          <SummaryRow label="Model">{currentModel.name}</SummaryRow>
          <SummaryRow label="Resolution">{resolution.join(', ')}</SummaryRow>
          {hasDataset && (
            <>
              <SummaryRow label="Images">
                {totalImages.toLocaleString()}
                {totalEffective !== totalImages &&
                  ` (${totalEffective.toLocaleString()} eff.)`}
              </SummaryRow>
              <SummaryRow label="Duration">
                {effectiveEpochs > 0
                  ? `${effectiveEpochs} epoch${effectiveEpochs !== 1 ? 's' : ''}`
                  : '—'}
                {' / '}
                {effectiveSteps > 0
                  ? `${effectiveSteps.toLocaleString()} steps`
                  : '—'}
              </SummaryRow>
            </>
          )}
          <SummaryRow label="Batch size">{batchSize}</SummaryRow>
          {saveEnabled && checkpointCount > 0 && (
            <SummaryRow label="Checkpoints">~{checkpointCount}</SummaryRow>
          )}
        </div>
      </div>

      {/* LoRA & optimiser */}
      <div className="rounded-lg border border-slate-200 bg-(--surface)/30 p-3 dark:border-slate-700">
        <span className="mb-2 block text-xs font-medium text-(--foreground)/70">
          Network & Optimiser
        </span>
        <div className="space-y-1">
          <SummaryRow label="Type">{networkType.toUpperCase()}</SummaryRow>
          <SummaryRow label="Rank / Alpha">
            {networkDim} / {networkAlpha}
          </SummaryRow>
          <SummaryRow label="LR">{learningRate}</SummaryRow>
          <SummaryRow label="Optimiser">{optimizerLabel}</SummaryRow>
          <SummaryRow label="Scheduler">{schedulerLabel}</SummaryRow>
          <SummaryRow label="Save format">{saveFormat}</SummaryRow>
        </div>
      </div>

      {/* Readiness */}
      <div className="rounded-lg border border-slate-200 bg-(--surface)/30 p-3 dark:border-slate-700">
        <div className="space-y-1">
          {requiredComponents.length > 1 && (
            <ReadinessItem
              label="Model components"
              isReady={hasAllComponents}
              detail={
                hasAllComponents
                  ? undefined
                  : missingComponents.map((c) => c.label).join(', ')
              }
            />
          )}

          <ReadinessItem
            label="Dataset"
            isReady={hasDataset}
            detail={
              hasDataset
                ? `${totalImages} image${totalImages !== 1 ? 's' : ''}`
                : undefined
            }
          />

          <ReadinessItem
            label="Output name"
            isReady={hasOutputName}
            detail={hasOutputName ? outputName : undefined}
          />

          <hr className="my-3 text-slate-300 dark:text-slate-600" />

          <ReadinessItem
            label={
              hasOutputName && hasDataset && hasAllComponents
                ? 'Ready to train'
                : 'Not ready'
            }
            isReady={hasOutputName && hasDataset && hasAllComponents}
            isSummary
          />
        </div>
      </div>
    </div>
  );
};

export const TrainingSummary = memo(TrainingSummaryComponent);
