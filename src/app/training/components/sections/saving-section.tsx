import { memo } from 'react';

import { Checkbox } from '@/app/shared/checkbox';
import { CollapsibleSection } from '@/app/shared/collapsible-section';
import { Dropdown, type DropdownItem } from '@/app/shared/dropdown';
import { Input } from '@/app/shared/input/input';
import { SegmentedControl } from '@/app/shared/segmented-control/segmented-control';

import type {
  FormState,
  SectionName,
} from '../training-config-form/use-training-config-form';
import { SectionResetButton } from './section-reset-button';

type SavingSectionProps = {
  outputName: string;
  saveEnabled: boolean;
  saveMode: 'epochs' | 'steps';
  saveEveryEpochs: number;
  saveEverySteps: number;
  saveFormat: 'fp16' | 'bf16' | 'fp32';
  visibleFields: Set<string>;
  hiddenChangesCount?: number;
  onFieldChange: <K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) => void;
  onOutputNameChange: (name: string) => void;
  onReset: (section: SectionName) => void;
};

const SAVE_FORMAT_ITEMS: DropdownItem<string>[] = [
  { value: 'fp16', label: 'float16 (most compatible)' },
  { value: 'bf16', label: 'bfloat16' },
  { value: 'fp32', label: 'float32 (largest)' },
];

const SavingSectionComponent = ({
  outputName,
  saveEnabled,
  saveMode,
  saveEveryEpochs,
  saveEverySteps,
  saveFormat,
  visibleFields,
  hiddenChangesCount,
  onFieldChange,
  onOutputNameChange,
  onReset,
}: SavingSectionProps) => {
  const hasVisibleFields =
    visibleFields.has('saveEveryEpochs') ||
    visibleFields.has('saveEverySteps') ||
    visibleFields.has('outputName') ||
    visibleFields.has('saveFormat');

  if (!hasVisibleFields) return null;

  const activeField =
    saveMode === 'epochs' ? 'saveEveryEpochs' : 'saveEverySteps';
  const activeValue = saveMode === 'epochs' ? saveEveryEpochs : saveEverySteps;

  return (
    <CollapsibleSection
      title="Saving"
      headerExtra={
        hiddenChangesCount ? (
          <span className="text-xs text-amber-500/70">
            {hiddenChangesCount} hidden{' '}
            {hiddenChangesCount === 1 ? 'setting' : 'settings'} customised
          </span>
        ) : undefined
      }
      headerActions={(expanded) =>
        saveEnabled && expanded ? (
          <SectionResetButton onClick={() => onReset('saving')} />
        ) : undefined
      }
    >
      <div className="space-y-3">
        {/* Output Name */}
        {visibleFields.has('outputName' satisfies keyof FormState) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              Output Name
            </label>
            <Input
              type="text"
              value={outputName}
              onChange={(e) => onOutputNameChange(e.target.value)}
              placeholder="my-lora"
              className="w-full"
            />
          </div>
        )}

        {/* Save Format */}
        {visibleFields.has('saveFormat' satisfies keyof FormState) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              Output Precision
            </label>
            <Dropdown
              items={SAVE_FORMAT_ITEMS}
              selectedValue={saveFormat}
              onChange={(val) =>
                onFieldChange('saveFormat', val as FormState['saveFormat'])
              }
              aria-label="Save format"
            />
            <p className="mt-1 text-xs text-slate-400">
              Precision of the saved .safetensors file
            </p>
          </div>
        )}

        {/* Save Checkpoints */}
        {(visibleFields.has('saveEveryEpochs' satisfies keyof FormState) ||
          visibleFields.has('saveEverySteps' satisfies keyof FormState)) && (
          <>
            <Checkbox
              isSelected={saveEnabled}
              onChange={() => onFieldChange('saveEnabled', !saveEnabled)}
              label="Save checkpoints during training"
              size="sm"
            />

            {saveEnabled && (
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <label className="text-xs font-medium text-(--foreground)/70">
                    Save Every
                  </label>
                  <SegmentedControl
                    options={[
                      { value: 'epochs', label: 'Epochs' },
                      { value: 'steps', label: 'Steps' },
                    ]}
                    value={saveMode}
                    onChange={(val) => onFieldChange('saveMode', val)}
                    size="sm"
                  />
                </div>

                <Input
                  type="number"
                  min={1}
                  value={activeValue}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (val > 0) onFieldChange(activeField, val);
                  }}
                  className="w-20"
                />
              </div>
            )}
          </>
        )}
      </div>
    </CollapsibleSection>
  );
};

export const SavingSection = memo(SavingSectionComponent);
