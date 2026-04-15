import { memo } from 'react';

import { CollapsibleSection } from '@/app/shared/collapsible-section';
import { Dropdown, type DropdownItem } from '@/app/shared/dropdown';
import { Input } from '@/app/shared/input/input';

import type {
  FormState,
  SectionName,
} from '../training-config-form/use-training-config-form';
import { SectionResetButton } from './section-reset-button';

type LoraShapeSectionProps = {
  networkType: 'lora' | 'lokr';
  networkDim: number;
  networkAlpha: number;
  networkDropout: number;
  hasChanges: boolean;
  visibleFields: Set<string>;
  hiddenChangesCount?: number;
  onFieldChange: <K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) => void;
  onReset: (section: SectionName) => void;
};

const NETWORK_TYPE_ITEMS: DropdownItem<string>[] = [
  { value: 'lora', label: 'LoRA' },
  { value: 'lokr', label: 'LoKr' },
];

const LoraShapeSectionComponent = ({
  networkType,
  networkDim,
  networkAlpha,
  networkDropout,
  hasChanges,
  visibleFields,
  hiddenChangesCount,
  onFieldChange,
  onReset,
}: LoraShapeSectionProps) => {
  const hasVisibleFields =
    visibleFields.has('networkDim') ||
    visibleFields.has('networkAlpha') ||
    visibleFields.has('networkType') ||
    visibleFields.has('networkDropout');

  if (!hasVisibleFields) return null;

  return (
    <CollapsibleSection
      title="LoRA Shape"
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
          <SectionResetButton onClick={() => onReset('loraShape')} />
        ) : undefined
      }
    >
      <div className="space-y-3">
        {visibleFields.has('networkType' satisfies keyof FormState) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              Type
            </label>
            <Dropdown
              items={NETWORK_TYPE_ITEMS}
              selectedValue={networkType}
              onChange={(val) =>
                onFieldChange('networkType', val as FormState['networkType'])
              }
              aria-label="Network type"
            />
          </div>
        )}

        <div className="flex gap-4">
          {visibleFields.has('networkDim' satisfies keyof FormState) && (
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
                Rank (dim)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={128}
                  step={1}
                  value={networkDim}
                  onChange={(e) =>
                    onFieldChange('networkDim', parseInt(e.target.value, 10))
                  }
                  className="flex-1"
                />
                <Input
                  type="number"
                  min={1}
                  max={128}
                  value={networkDim}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (val > 0 && val <= 128) onFieldChange('networkDim', val);
                  }}
                  className="w-16 text-center"
                />
              </div>
            </div>
          )}

          {visibleFields.has('networkAlpha' satisfies keyof FormState) && (
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
                Alpha
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={128}
                  step={1}
                  value={networkAlpha}
                  onChange={(e) =>
                    onFieldChange('networkAlpha', parseInt(e.target.value, 10))
                  }
                  className="flex-1"
                />
                <Input
                  type="number"
                  min={1}
                  max={128}
                  value={networkAlpha}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (val > 0 && val <= 128)
                      onFieldChange('networkAlpha', val);
                  }}
                  className="w-16 text-center"
                />
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400">
          Higher rank = more expressive, but uses more VRAM and can overfit
        </p>

        {visibleFields.has('networkDropout' satisfies keyof FormState) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              Network Dropout
            </label>
            <Input
              type="text"
              value={networkDropout}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val >= 0 && val <= 1) {
                  onFieldChange('networkDropout', val);
                }
              }}
              placeholder="0"
              className="w-20 tabular-nums"
            />
            <p className="mt-1 text-xs text-slate-400">
              Randomly drop LoRA activations during training (0 = disabled, 0.1–0.3 typical)
            </p>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};

export const LoraShapeSection = memo(LoraShapeSectionComponent);
