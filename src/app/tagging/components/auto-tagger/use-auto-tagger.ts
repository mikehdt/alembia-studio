import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import type { DropdownItem } from '@/app/components/shared/dropdown';
import type {
  AutoTaggerSettings,
  TaggerOptions,
  TagInsertMode,
  TriggerPhraseInsertMode,
  VlmOptions,
} from '@/app/services/auto-tagger';
import {
  DEFAULT_TAGGER_OPTIONS,
  DEFAULT_VLM_OPTIONS,
  getProviderTypeForModel,
} from '@/app/services/auto-tagger';
import {
  appendPendingTagResult,
  clearPendingTagResults,
  summarisePendingResults,
} from '@/app/services/auto-tagger/pending-tag-results';
import {
  abortTagging,
  registerTaggingController,
  removeTaggingController,
} from '@/app/services/auto-tagger/tagging-controllers';
import type { AppDispatch, RootState } from '@/app/store';
import { flushPendingTagResults } from '@/app/store/assets/flush-pending-tags';
import {
  selectHasReadyModel,
  selectModels,
  selectReadyModels,
  selectSelectedModelId,
  setModelsAndProviders,
  setSelectedModel,
} from '@/app/store/auto-tagger';
import {
  addJob,
  cancelTagging,
  completeTagging,
  failTagging,
  selectActiveTaggingJob,
  updateJobStatus,
  updateTaggingProgress,
} from '@/app/store/jobs';
import { selectKeepTaggerModelInMemory } from '@/app/store/preferences';
import {
  selectCaptionMode,
  selectProjectInfo,
  selectTriggerPhrases,
} from '@/app/store/project';
import { setAssetsSelectionState } from '@/app/store/selection';
import {
  getAutoTaggerSettings,
  saveAutoTaggerSettings,
} from '@/app/utils/project-actions';

type UseAutoTaggerParams = {
  isOpen: boolean;
  onClose: () => void;
  selectedAssets: { fileId: string; fileExtension: string }[];
};

const INSERT_MODE_OPTIONS: { value: TagInsertMode; label: string }[] = [
  { value: 'prepend', label: 'Prepend to start' },
  { value: 'append', label: 'Append to end' },
];

// Trigger phrase positioning has an extra 'integrate' option that asks the
// model to weave phrases into the prose where they fit. Ordered spatially
// (start → middle → end) so the radio reads as a position picker.
const TRIGGER_PHRASE_INSERT_MODE_OPTIONS: {
  value: TriggerPhraseInsertMode;
  label: string;
}[] = [
  { value: 'prepend', label: 'Prepend to start' },
  { value: 'integrate', label: 'Attempt to integrate' },
  { value: 'append', label: 'Append to end' },
];

export function useAutoTagger({
  isOpen,
  onClose,
  selectedAssets,
}: UseAutoTaggerParams) {
  const dispatch = useDispatch<AppDispatch>();

  // Redux state
  const models = useSelector(selectModels);
  const readyModels = useSelector(selectReadyModels);
  const hasReadyModel = useSelector(selectHasReadyModel);
  const selectedModelId = useSelector(selectSelectedModelId);
  const captionMode = useSelector(selectCaptionMode);
  const triggerPhrases = useSelector(selectTriggerPhrases);
  const keepModelInMemory = useSelector(selectKeepTaggerModelInMemory);
  const projectInfo = useSelector((state: RootState) =>
    selectProjectInfo(state),
  );

  // Only show models compatible with the project's current mode:
  // - caption mode → VLM models (natural-language captioners)
  // - tag mode → ONNX models (booru-style taggers)
  // Mixing the two creates a footgun where captions land on invisible
  // fields or tags overwrite captions on save, so we gate at selection.
  const modeFilteredReadyModels = useMemo(() => {
    const targetProviderType: 'onnx' | 'vlm' =
      captionMode === 'caption' ? 'vlm' : 'onnx';
    return readyModels.filter(
      (m) => getProviderTypeForModel(m.id) === targetProviderType,
    );
  }, [readyModels, captionMode]);

  // Active tagging job for this project (from the jobs slice)
  const activeTaggingJob = useSelector(
    selectActiveTaggingJob(projectInfo.projectFolderName ?? ''),
  );

  // Derived state from the job
  const isTagging = activeTaggingJob !== null;
  const progress = activeTaggingJob?.progress ?? null;
  const jobStatus = activeTaggingJob?.status ?? null;

  // Local settings state (not part of the job)
  const [options, setOptions] = useState<TaggerOptions>({
    ...DEFAULT_TAGGER_OPTIONS,
  });
  const [vlmOptions, setVlmOptions] = useState<VlmOptions>({
    ...DEFAULT_VLM_OPTIONS,
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [unselectOnComplete, setUnselectOnComplete] = useState(true);

  // Derive the provider type of the currently-selected model
  const selectedProviderType = selectedModelId
    ? getProviderTypeForModel(selectedModelId)
    : undefined;

  // Summary and error are set locally after the job completes,
  // since they drive the modal's summary view
  const [summary, setSummary] = useState<{
    imagesProcessed: number;
    imagesWithNewTags: number;
    totalTagsFound: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Per-image errors collected during the batch run, shown in the summary
  const [imageErrors, setImageErrors] = useState<
    { fileId: string; error: string }[]
  >([]);
  // Use a ref so we can accumulate errors inside the SSE loop without re-rendering
  const imageErrorsRef = useRef<{ fileId: string; error: string }[]>([]);
  const [wasCancelled, setWasCancelled] = useState(false);

  // Track the current job ID so we can cancel it
  const currentJobIdRef = useRef<string | null>(null);

  // Fetch models callback
  const fetchModels = useCallback(async () => {
    try {
      const response = await fetch('/api/auto-tagger/models');
      if (!response.ok) throw new Error('Failed to fetch models');
      const data = await response.json();
      dispatch(setModelsAndProviders(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load models');
    }
  }, [dispatch]);

  // Fetch models if not already loaded
  useEffect(() => {
    if (isOpen && models.length === 0) {
      fetchModels();
    }
  }, [isOpen, models.length, fetchModels]);

  // Load saved settings when modal opens (after models are available)
  useEffect(() => {
    if (
      isOpen &&
      projectInfo.projectFolderName &&
      !settingsLoaded &&
      models.length > 0
    ) {
      getAutoTaggerSettings(projectInfo.projectFolderName).then(
        (savedSettings) => {
          if (savedSettings) {
            setOptions((prev) => ({
              ...prev,
              generalThreshold:
                savedSettings.generalThreshold ?? prev.generalThreshold,
              characterThreshold:
                savedSettings.characterThreshold ?? prev.characterThreshold,
              removeUnderscore:
                savedSettings.removeUnderscore ?? prev.removeUnderscore,
              includeCharacterTags:
                savedSettings.includeCharacterTags ?? prev.includeCharacterTags,
              includeRatingTags:
                savedSettings.includeRatingTags ?? prev.includeRatingTags,
              excludeTags: savedSettings.excludeTags ?? prev.excludeTags,
              tagInsertMode:
                savedSettings.tagInsertMode === 'prepend' ||
                savedSettings.tagInsertMode === 'append'
                  ? savedSettings.tagInsertMode
                  : prev.tagInsertMode,
            }));

            setVlmOptions((prev) => ({
              ...prev,
              prompt: savedSettings.prompt ?? prev.prompt,
              maxTokens: savedSettings.maxTokens ?? prev.maxTokens,
              temperature: savedSettings.temperature ?? prev.temperature,
              injectTriggerPhrases:
                savedSettings.injectTriggerPhrases ?? prev.injectTriggerPhrases,
              triggerPhraseInsertMode:
                savedSettings.triggerPhraseInsertMode === 'prepend' ||
                savedSettings.triggerPhraseInsertMode === 'integrate' ||
                savedSettings.triggerPhraseInsertMode === 'append'
                  ? savedSettings.triggerPhraseInsertMode
                  : prev.triggerPhraseInsertMode,
            }));

            if (
              savedSettings.defaultModelId &&
              readyModels.some((m) => m.id === savedSettings.defaultModelId)
            ) {
              dispatch(setSelectedModel(savedSettings.defaultModelId));
            }
          }
          setSettingsLoaded(true);
        },
      );
    }
  }, [
    isOpen,
    projectInfo.projectFolderName,
    settingsLoaded,
    models,
    readyModels,
    dispatch,
  ]);

  // Model dropdown items — mode-restricted so only compatible models appear.
  const modelItems: DropdownItem<string>[] = useMemo(
    () =>
      modeFilteredReadyModels.map((model) => ({
        value: model.id,
        label: model.name,
      })),
    [modeFilteredReadyModels],
  );

  // Whether there's *any* ready model that fits the current project mode.
  // Drives the "No models installed" warning in the modal.
  const hasModelForMode = modeFilteredReadyModels.length > 0;

  // If the persisted default model doesn't match the current mode (e.g. user
  // was in tag mode and picked Qwen3-VL, then switched to caption mode), fall
  // back to the first compatible model so the dropdown isn't empty-selected.
  useEffect(() => {
    if (!isOpen || modeFilteredReadyModels.length === 0) return;
    const current = selectedModelId
      ? modeFilteredReadyModels.find((m) => m.id === selectedModelId)
      : undefined;
    if (!current) {
      dispatch(setSelectedModel(modeFilteredReadyModels[0].id));
    }
  }, [isOpen, modeFilteredReadyModels, selectedModelId, dispatch]);

  const handleModelChange = useCallback(
    (modelId: string) => {
      dispatch(setSelectedModel(modelId));
    },
    [dispatch],
  );

  const handleOptionChange = useCallback(
    <K extends keyof TaggerOptions>(key: K, value: TaggerOptions[K]) => {
      setOptions((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleVlmOptionChange = useCallback(
    <K extends keyof VlmOptions>(key: K, value: VlmOptions[K]) => {
      setVlmOptions((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleClose = useCallback(() => {
    if (!isTagging) {
      onClose();
      setSummary(null);
      setError(null);
      setWasCancelled(false);
      setSettingsLoaded(false);
    }
  }, [isTagging, onClose]);

  const handleCancel = useCallback(() => {
    // Use the local ref if this instance started the job, otherwise
    // fall back to the active job from Redux (e.g. modal auto-opened on return)
    const jobId = currentJobIdRef.current ?? activeTaggingJob?.id;
    if (jobId) {
      abortTagging(jobId);
      dispatch(cancelTagging(jobId));
    }
  }, [activeTaggingJob?.id, dispatch]);

  /**
   * Flush pending results from localStorage → Redux, then deselect tagged assets.
   * This is the single mechanism for applying tags, whether tagging just
   * completed or the user returned to a project with pending results.
   */
  const flushAndFinalise = useCallback(
    (projectFolderName: string, jobId: string, cancelled: boolean) => {
      // Compute summary from localStorage before flushing clears it.
      // Enrich with errorCount + providerType so the activity-panel card can
      // distinguish "partial success" from "fully successful" and choose
      // captioning vs tagging wording.
      const baseSummary = summarisePendingResults(projectFolderName);
      const summaryData = {
        ...baseSummary,
        errorCount: imageErrorsRef.current.length,
        providerType: selectedProviderType,
      };
      setSummary(summaryData);
      // Publish the errors we've accumulated for the summary view
      setImageErrors([...imageErrorsRef.current]);

      // Flush: read from localStorage → dispatch addMultipleTags → clear
      dispatch(flushPendingTagResults(projectFolderName));

      // Update the job in the queue
      if (cancelled) {
        // cancelTagging already dispatched by the abort handler
      } else {
        dispatch(completeTagging({ id: jobId, summary: summaryData }));
      }

      // Deselect assets that received tags
      if (unselectOnComplete && summaryData.imagesWithNewTags > 0) {
        // Re-read isn't needed — we know which assets were tagged from the summary
        // But we need the fileIds. Read from localStorage before flush clears them...
        // Actually, flush already cleared them. For deselection, we can use the
        // selectedAssets that were passed to the hook.
        dispatch(
          setAssetsSelectionState({
            assetIds: selectedAssets.map((a) => a.fileId),
            selected: false,
          }),
        );
      }
    },
    [dispatch, unselectOnComplete, selectedAssets, selectedProviderType],
  );

  const handleStartTagging = useCallback(async () => {
    if (
      !selectedModelId ||
      !projectInfo.projectPath ||
      !projectInfo.projectFolderName
    )
      return;

    const projectFolderName = projectInfo.projectFolderName;

    // Clear any stale pending results for this project before starting
    clearPendingTagResults(projectFolderName);

    // Create a job in the queue
    const jobId = `tagging-${Date.now()}`;
    const modelName =
      readyModels.find((m) => m.id === selectedModelId)?.name ??
      selectedModelId;

    const position: 'start' | 'end' =
      options.tagInsertMode === 'prepend' ? 'start' : 'end';

    dispatch(
      addJob({
        id: jobId,
        type: 'tagging',
        status: 'preparing',
        createdAt: Date.now(),
        startedAt: Date.now(),
        completedAt: null,
        error: null,
        projectFolderName,
        projectName: projectInfo.projectName || projectFolderName,
        modelName,
        progress: {
          current: 0,
          total: selectedAssets.length,
          currentFileId: selectedAssets[0]?.fileId,
        },
        summary: null,
      }),
    );

    currentJobIdRef.current = jobId;
    const abortController = registerTaggingController(jobId);

    setSummary(null);
    setError(null);
    setWasCancelled(false);
    setImageErrors([]);
    imageErrorsRef.current = [];

    try {
      const response = await fetch('/api/auto-tagger/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: selectedModelId,
          projectPath: projectInfo.projectPath,
          assets: selectedAssets,
          options,
          vlmOptions,
          triggerPhrases,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        // Try to surface the server-side error message (e.g. "Model is not installed")
        let message = `Failed to start tagging (${response.status})`;
        try {
          const body = await response.json();
          if (body?.error) message = body.error;
        } catch {
          // Non-JSON response — fall back to generic message
        }
        throw new Error(message);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let receivedComplete = false;
      // Flip from `preparing` → `running` once the backend emits its first
      // signal of any kind. Until then the progress UI shows a "Starting..."
      // indeterminate state instead of "Tagging image 1 of N" with an empty
      // bar, which was misleading: nothing is actually being tagged yet, the
      // model is still spinning up. One-shot flag so we don't dispatch on
      // every event after the first.
      let promotedToRunning = false;
      const promoteToRunning = () => {
        if (promotedToRunning) return;
        promotedToRunning = true;
        dispatch(updateJobStatus({ id: jobId, status: 'running' }));
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));

              if (event.type === 'loading') {
                promoteToRunning();
                // Model-loading sub-state — show a spinner with the shard
                // progress while the sidecar reads weights into GPU/RAM.
                dispatch(
                  updateTaggingProgress({
                    id: jobId,
                    progress: {
                      current: 0,
                      total: selectedAssets.length,
                      loading: {
                        message: event.message ?? 'Loading model',
                        current: event.current ?? 0,
                        total: event.total ?? 0,
                      },
                    },
                  }),
                );
              } else if (event.type === 'progress') {
                promoteToRunning();
                dispatch(
                  updateTaggingProgress({
                    id: jobId,
                    progress: {
                      current: event.current,
                      total: event.total,
                      currentFileId: event.fileId,
                      // `loading` intentionally omitted — the first real
                      // progress event clears the loading overlay.
                    },
                  }),
                );
              } else if (event.type === 'result') {
                // Persist to localStorage — the single source of truth.
                // Event may carry either tags (ONNX) or caption (VLM).
                appendPendingTagResult(projectFolderName, {
                  fileId: event.fileId,
                  tags: event.tags,
                  caption: event.caption,
                  position,
                });
              } else if (event.type === 'error' && event.fileId) {
                // Per-image error — collect for the summary
                console.warn(`Error tagging ${event.fileId}:`, event.error);
                imageErrorsRef.current.push({
                  fileId: event.fileId,
                  error: event.error,
                });
              } else if (event.type === 'error') {
                throw new Error(event.error);
              } else if (event.type === 'complete') {
                receivedComplete = true;
                flushAndFinalise(projectFolderName, jobId, false);

                // Save settings as defaults for this project
                const settingsToSave: AutoTaggerSettings = {
                  defaultModelId: selectedModelId,
                  generalThreshold: options.generalThreshold,
                  characterThreshold: options.characterThreshold,
                  removeUnderscore: options.removeUnderscore,
                  includeCharacterTags: options.includeCharacterTags,
                  includeRatingTags: options.includeRatingTags,
                  excludeTags: options.excludeTags,
                  tagInsertMode: options.tagInsertMode,
                  prompt: vlmOptions.prompt,
                  maxTokens: vlmOptions.maxTokens,
                  temperature: vlmOptions.temperature,
                  injectTriggerPhrases: vlmOptions.injectTriggerPhrases,
                  triggerPhraseInsertMode: vlmOptions.triggerPhraseInsertMode,
                };
                saveAutoTaggerSettings(projectFolderName, settingsToSave).catch(
                  console.error,
                );
              }
            } catch (parseErr) {
              console.warn('Failed to parse SSE event:', line, parseErr);
            }
          }
        }
      }

      // Process any remaining data in buffer
      if (buffer.startsWith('data: ')) {
        try {
          const event = JSON.parse(buffer.slice(6));
          if (event.type === 'result') {
            appendPendingTagResult(projectFolderName, {
              fileId: event.fileId,
              tags: event.tags,
              caption: event.caption,
              position,
            });
          } else if (event.type === 'complete') {
            receivedComplete = true;
          }
        } catch (parseErr) {
          console.warn('Failed to parse final SSE event:', buffer, parseErr);
        }
      }

      if (!receivedComplete) {
        // Stream ended without a complete event — flush whatever we have
        if (summarisePendingResults(projectFolderName).imagesProcessed > 0) {
          flushAndFinalise(projectFolderName, jobId, false);
        } else {
          throw new Error(
            'No results received from tagger. Check server logs for errors.',
          );
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setWasCancelled(true);
        // Flush any partial results that made it to localStorage
        flushAndFinalise(projectFolderName, jobId, true);
      } else {
        const message = err instanceof Error ? err.message : 'Tagging failed';
        setError(message);
        dispatch(failTagging({ id: jobId, error: message }));
        clearPendingTagResults(projectFolderName);
      }
    } finally {
      removeTaggingController(jobId);
      currentJobIdRef.current = null;

      // Auto-release the model from GPU/CPU memory if the preference says to.
      // Best-effort fire-and-forget — an unload failure shouldn't surface as
      // a user-visible error, and the next batch reloads automatically.
      if (!keepModelInMemory) {
        fetch('/api/auto-tagger/unload', { method: 'POST' }).catch(() => {
          /* best-effort */
        });
      }
    }
  }, [
    selectedModelId,
    projectInfo.projectPath,
    projectInfo.projectFolderName,
    projectInfo.projectName,
    selectedAssets,
    readyModels,
    options,
    vlmOptions,
    triggerPhrases,
    flushAndFinalise,
    keepModelInMemory,
    dispatch,
  ]);

  return {
    // State
    options,
    vlmOptions,
    unselectOnComplete,
    isTagging,
    progress,
    jobStatus,
    summary,
    error,
    imageErrors,
    wasCancelled,
    // True when any model at all is installed — kept for the outer modal gate.
    hasReadyModel,
    // True when at least one *compatible* model exists for the current project
    // mode. Drives the "No models installed" warning inside the modal.
    hasModelForMode,
    modelItems,
    selectedModelId,
    selectedProviderType,
    insertModeOptions: INSERT_MODE_OPTIONS,
    triggerPhraseInsertModeOptions: TRIGGER_PHRASE_INSERT_MODE_OPTIONS,
    triggerPhrases,
    // Actions
    handleModelChange,
    handleOptionChange,
    handleVlmOptionChange,
    setUnselectOnComplete,
    handleClose,
    handleCancel,
    handleStartTagging,
  };
}
