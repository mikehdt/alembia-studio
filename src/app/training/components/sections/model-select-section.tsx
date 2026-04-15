import { memo, useCallback, useMemo } from 'react';

import {
  type ExpertiseTier,
  isTierAtLeast,
} from '@/app/services/training/field-registry';
import {
  getModelsByArchitecture,
  type ModelComponentType,
  type ModelDefinition,
} from '@/app/services/training/models';
import { CollapsibleSection } from '@/app/shared/collapsible-section';
import { Dropdown, type DropdownItem } from '@/app/shared/dropdown';

import { ModelPathField } from '../model-path-field/model-path-field';
import { useEnsureModelStatuses } from '../model-path-field/use-ensure-model-statuses';
import type {
  AppModelDefaults,
  FormState,
  ModelPaths,
} from '../training-config-form/use-training-config-form';

type ModelSelectSectionProps = {
  modelId: string;
  modelPaths: ModelPaths;
  appModelDefaults: AppModelDefaults;
  onModelChange: (modelId: string) => void;
  onModelPathChange: (component: ModelComponentType, path: string) => void;
  currentModel: ModelDefinition;
  visibleFields: Set<string>;
  viewMode: ExpertiseTier;
  hiddenChangesCount?: number;
};

const ModelSelectSectionComponent = ({
  modelId,
  modelPaths,
  appModelDefaults,
  onModelChange,
  onModelPathChange,
  currentModel,
  visibleFields,
  viewMode,
  hiddenChangesCount,
}: ModelSelectSectionProps) => {
  useEnsureModelStatuses();

  const modelGroups = useMemo(() => {
    return getModelsByArchitecture().map((group) => ({
      groupLabel: group.label,
      items: group.models.map(
        (m) =>
          ({
            value: m.id,
            label: (
              <div className="flex flex-col">
                <span>{m.name}</span>
              </div>
            ),
          }) satisfies DropdownItem<string>,
      ),
    }));
  }, []);

  const modelDefaults = appModelDefaults[currentModel.id];

  // Component tier logic:
  //   checkpoint → always simple (user commonly changes this)
  //   other required → simple if no app default, intermediate if pre-filled
  //   optional → always intermediate
  const visibleComponents = useMemo(
    () =>
      currentModel.components.filter((c) => {
        if (c.type === 'checkpoint') return true;
        if (!c.required) return isTierAtLeast(viewMode, 'intermediate');
        const hasAppDefault = !!modelDefaults?.[c.type];
        return isTierAtLeast(
          viewMode,
          hasAppDefault ? 'intermediate' : 'simple',
        );
      }),
    [currentModel.components, viewMode, modelDefaults],
  );

  const handlePathChange = useCallback(
    (component: ModelComponentType) => (path: string) => {
      onModelPathChange(component, path);
    },
    [onModelPathChange],
  );

  return (
    <CollapsibleSection
      title="Model"
      headerExtra={
        hiddenChangesCount ? (
          <span className="text-xs text-amber-500/70">
            {hiddenChangesCount} hidden{' '}
            {hiddenChangesCount === 1 ? 'setting' : 'settings'} customised
          </span>
        ) : undefined
      }
    >
      <div className="space-y-3">
        {visibleFields.has('modelId' satisfies keyof FormState) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)">
              Base Model
            </label>

            <div className="flex">
              <div className="w-1/2">
                <Dropdown
                  items={modelGroups}
                  selectedValue={modelId}
                  onChange={onModelChange}
                  selectedValueRenderer={() => (
                    <span className="text-sm">{currentModel.name}</span>
                  )}
                  aria-label="Select base model"
                />

                <p className="mt-2 text-xs text-slate-400">
                  {currentModel.description}
                </p>
              </div>

              {currentModel.tips && currentModel.tips.length > 0 && (
                <ul className="w-1/2 list-disc space-y-1">
                  {currentModel.tips.map((tip) => (
                    <li key={tip} className="text-xs text-slate-400/80">
                      {tip}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Model component paths */}
        {visibleFields.has('modelPaths' satisfies keyof FormState) &&
          visibleComponents.map((component) => (
            <div key={component.type}>
              <label className="mb-1 flex items-baseline gap-1.5 text-xs font-medium">
                {component.label}
                {!component.required && (
                  <span className="font-normal text-slate-400">(optional)</span>
                )}
              </label>
              <ModelPathField
                value={modelPaths[component.type] ?? ''}
                onChange={handlePathChange(component.type)}
                browseTitle={component.label}
                downloadId={component.downloadId}
                resetTo={modelDefaults?.[component.type]}
              />

              {component.hint && (
                <p className="mt-0.5 text-xs text-slate-400">
                  {component.hint}
                </p>
              )}
            </div>
          ))}

        {/* Backend — single-item Dropdown renders as static label */}
        <div>
          <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
            Backend
          </label>
          <Dropdown
            items={[
              {
                value: currentModel.provider,
                label:
                  currentModel.provider === 'kohya'
                    ? 'Kohya (sd-scripts)'
                    : 'ai-toolkit',
              },
            ]}
            selectedValue={currentModel.provider}
            onChange={() => {}}
            aria-label="Training backend"
          />
        </div>
      </div>
    </CollapsibleSection>
  );
};

export const ModelSelectSection = memo(ModelSelectSectionComponent);
