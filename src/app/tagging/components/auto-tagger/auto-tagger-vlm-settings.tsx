import { OctagonAlertIcon, RotateCcwIcon } from 'lucide-react';

import { Button } from '@/app/components/shared/button';
import { Checkbox } from '@/app/components/shared/checkbox';
import { Dropdown, DropdownItem } from '@/app/components/shared/dropdown';
import { FormTitle } from '@/app/components/shared/form-title/form-title';
import { Input } from '@/app/components/shared/input/input';
import { RadioGroup } from '@/app/components/shared/radio-group';
import type {
  TriggerPhraseInsertMode,
  VlmOptions,
} from '@/app/services/auto-tagger';
import { DEFAULT_VLM_OPTIONS } from '@/app/services/auto-tagger';

type AutoTaggerVlmSettingsProps = {
  vlmOptions: VlmOptions;
  unselectOnComplete: boolean;
  selectedModelId: string | null;
  modelItems: DropdownItem<string>[];
  triggerPhraseInsertModeOptions: {
    value: TriggerPhraseInsertMode;
    label: string;
  }[];
  selectedAssetsCount: number;
  error: string | null;
  triggerPhrases: string[];
  onModelChange: (modelId: string) => void;
  onVlmOptionChange: <K extends keyof VlmOptions>(
    key: K,
    value: VlmOptions[K],
  ) => void;
  onUnselectOnCompleteChange: () => void;
  onClose: () => void;
  onStartTagging: () => void;
};

export function AutoTaggerVlmSettings({
  vlmOptions,
  unselectOnComplete,
  selectedModelId,
  modelItems,
  triggerPhraseInsertModeOptions,
  selectedAssetsCount,
  error,
  triggerPhrases,
  onModelChange,
  onVlmOptionChange,
  onUnselectOnCompleteChange,
  onClose,
  onStartTagging,
}: AutoTaggerVlmSettingsProps) {
  const hasTriggerPhrases = triggerPhrases.length > 0;
  return (
    <>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Generate natural-language captions for {selectedAssetsCount} selected
        image
        {selectedAssetsCount !== 1 ? 's' : ''}.
      </p>

      {error && (
        <div className="flex rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">
          <OctagonAlertIcon className="mr-2 h-5 w-5 shrink-0" /> {error}
        </div>
      )}

      {/* Model selection */}
      <div className="flex flex-col gap-2">
        <FormTitle as="span">Model</FormTitle>
        <Dropdown
          items={modelItems}
          selectedValue={selectedModelId || ''}
          onChange={onModelChange}
        />
      </div>

      {/* Prompt */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <FormTitle as="span">Prompt</FormTitle>
          {vlmOptions.prompt !== DEFAULT_VLM_OPTIONS.prompt && (
            <Button
              onClick={() =>
                onVlmOptionChange('prompt', DEFAULT_VLM_OPTIONS.prompt)
              }
              color="slate"
              variant="ghost"
              size="xs"
              width="sm"
            >
              <RotateCcwIcon />
              Reset
            </Button>
          )}
        </div>
        <textarea
          value={vlmOptions.prompt}
          onChange={(e) => onVlmOptionChange('prompt', e.target.value)}
          rows={6}
          className="resize-y rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-(--foreground) placeholder:text-slate-400 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
          placeholder="Describe this image in detail for AI training purposes."
        />
        <p className="text-xs text-slate-500">
          This prompt is sent with each image to guide the model&apos;s
          response. Example-based priming tends to work better than
          negative-only instructions with these models.
        </p>
      </div>

      {/* Generation params */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-400">
            Max Tokens
          </label>
          <Input
            type="number"
            min={32}
            max={4096}
            step={32}
            value={vlmOptions.maxTokens}
            onChange={(e) =>
              onVlmOptionChange(
                'maxTokens',
                Math.max(
                  32,
                  Math.min(4096, parseInt(e.target.value, 10) || 32),
                ),
              )
            }
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-400">
            Temperature: {vlmOptions.temperature.toFixed(2)}
          </label>
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.05"
            value={vlmOptions.temperature}
            onChange={(e) =>
              onVlmOptionChange('temperature', parseFloat(e.target.value))
            }
            className="w-full"
          />
        </div>
      </div>

      {/* Trigger phrase injection — only offered when the project actually
          defines trigger phrases, otherwise the toggle does nothing. */}
      {hasTriggerPhrases && (
        <div className="flex flex-col gap-1">
          <Checkbox
            isSelected={vlmOptions.injectTriggerPhrases}
            onChange={() =>
              onVlmOptionChange(
                'injectTriggerPhrases',
                !vlmOptions.injectTriggerPhrases,
              )
            }
            label={`Require project trigger phrases (${triggerPhrases.length})`}
          />
          <p className="ml-7 text-xs text-slate-500">
            Appends an instruction telling the model to reproduce each trigger
            phrase verbatim in the caption. Useful for LoRA training where every
            caption needs the activation token.
          </p>
          {vlmOptions.injectTriggerPhrases && (
            <div className="mt-2 ml-7 flex flex-col gap-2">
              <FormTitle as="span">Phrase position</FormTitle>
              <RadioGroup
                name="triggerPhraseInsertMode"
                options={triggerPhraseInsertModeOptions}
                value={vlmOptions.triggerPhraseInsertMode}
                onChange={(mode) =>
                  onVlmOptionChange('triggerPhraseInsertMode', mode)
                }
              />
            </div>
          )}
        </div>
      )}

      {/* Post-captioning options */}
      <div className="mt-2">
        <Checkbox
          isSelected={unselectOnComplete}
          onChange={onUnselectOnCompleteChange}
          label="Deselect captioned assets once complete"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onClose} color="slate" size="md">
          Cancel
        </Button>
        <Button
          onClick={onStartTagging}
          color="indigo"
          size="md"
          disabled={!selectedModelId || selectedAssetsCount === 0}
        >
          Start Captioning
        </Button>
      </div>
    </>
  );
}
