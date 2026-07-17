import { SparklesIcon, SwatchBookIcon } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/app/shared/button';
import { ResponsiveToolbarGroup } from '@/app/shared/responsive-toolbar-group';
import { ToolbarDivider } from '@/app/shared/toolbar-divider';
import { selectFilteredAssets } from '@/app/store/assets';
import {
  selectHasReadyModel,
  selectIsInitialised,
  setModelsAndProviders,
} from '@/app/store/auto-tagger';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { selectSelectedAssetsCount } from '@/app/store/selection';
import {
  selectAssetsWithActiveFiltersCount,
  selectSelectedAssetsData,
} from '@/app/store/selection/combinedSelectors';
import { AutoTaggerModal } from '@/app/tagging/components/auto-tagger';

import { TriggerPhrasesButton } from './trigger-phrases-modal';

/** Auto Tagger button — first-class in caption mode */
const AutoTaggerButton = () => {
  const dispatch = useAppDispatch();

  // Never auto-opens: a batch running for this project (one the user started
  // elsewhere, or one reattached to on return) shows in the activity panel,
  // which is where its progress lives now.
  const [isTaggerModalOpen, setIsTaggerModalOpen] = useState(false);

  const selectedAssetsData = useAppSelector(selectSelectedAssetsData);
  const filteredAssets = useAppSelector(selectFilteredAssets);
  const filteredAssetsCount = useAppSelector(
    selectAssetsWithActiveFiltersCount,
  );
  const selectedAssetsCount = useAppSelector(selectSelectedAssetsCount);
  const hasReadyModel = useAppSelector(selectHasReadyModel);
  const isAutoTaggerInitialised = useAppSelector(selectIsInitialised);

  // Initialise auto-tagger models (same logic as TagActionsMenu)
  useEffect(() => {
    if (isAutoTaggerInitialised) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const fetchModels = (isRetry: boolean) => {
      fetch('/api/auto-tagger/models')
        .then((res) => {
          if (!res.ok) throw new Error(`${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (!cancelled) dispatch(setModelsAndProviders(data));
        })
        .catch((err) => {
          if (cancelled) return;
          if (!isRetry) {
            retryTimer = setTimeout(() => fetchModels(true), 3000);
          } else {
            console.error('Failed to fetch auto-tagger models:', err);
          }
        });
    };
    fetchModels(false);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [isAutoTaggerInitialised, dispatch]);

  const hasAssetsForTagger =
    selectedAssetsData.length > 0 || filteredAssetsCount > 0;

  const assetsForTagger = useMemo(() => {
    if (!isTaggerModalOpen) return [];
    const source =
      selectedAssetsData.length > 0 ? selectedAssetsData : filteredAssets;
    return source.map((asset) => ({
      fileId: asset.fileId,
      fileExtension: asset.fileExtension,
    }));
  }, [isTaggerModalOpen, selectedAssetsData, filteredAssets]);

  const openTaggerModal = useCallback(() => setIsTaggerModalOpen(true), []);
  const closeTaggerModal = useCallback(() => setIsTaggerModalOpen(false), []);

  return (
    <>
      <Button
        variant="ghost"
        size="toolbar"
        onClick={openTaggerModal}
        disabled={!hasReadyModel || !hasAssetsForTagger}
        title={
          !hasReadyModel
            ? 'No tagger model ready'
            : selectedAssetsCount > 0
              ? `Auto-tag ${selectedAssetsCount} selected`
              : `Auto-tag ${filteredAssetsCount} filtered`
        }
      >
        <SparklesIcon />
        <span className="max-lg:hidden">Auto Tag</span>
      </Button>

      <AutoTaggerModal
        isOpen={isTaggerModalOpen}
        onClose={closeTaggerModal}
        selectedAssets={assetsForTagger}
      />
    </>
  );
};

const CaptionActionsComponent = () => {
  return (
    <ResponsiveToolbarGroup
      icon={<SwatchBookIcon className="h-4 w-4" />}
      title="Captions"
      position="right"
    >
      <TriggerPhrasesButton />

      <ToolbarDivider />

      <AutoTaggerButton />
    </ResponsiveToolbarGroup>
  );
};

export const CaptionActions = memo(CaptionActionsComponent);
