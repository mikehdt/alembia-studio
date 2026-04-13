import {
  ArrowUpFromLineIcon,
  ChevronsDownIcon,
  CopyIcon,
  HighlighterIcon,
  SparklesIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { MenuButton, MenuItem } from '@/app/components/shared/menu-button';
import { isSupportedVideoExtension } from '@/app/constants';
import { gatherTags } from '@/app/store/assets';
import { selectFilteredAssets } from '@/app/store/assets';
import {
  selectHasReadyModel,
  selectIsInitialised,
  setModelsAndProviders,
} from '@/app/store/auto-tagger';
import { selectFilterTags } from '@/app/store/filters';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { selectActiveTaggingJob } from '@/app/store/jobs';
import { selectProjectFolderName } from '@/app/store/project';
import { selectSelectedAssetsCount } from '@/app/store/selection';
import {
  selectAssetsWithActiveFiltersCount,
  selectEffectiveScopeAssetIds,
  selectSelectedAssetsData,
} from '@/app/store/selection/combinedSelectors';
import { AutoTaggerModal } from '@/app/tagging/components/auto-tagger';

import { CopyTagsModal } from './copy-tags-modal';
import { TriggerPhrasesModal } from './trigger-phrases-button';

export const TagActionsMenu = () => {
  const dispatch = useAppDispatch();

  const projectFolderName = useAppSelector(selectProjectFolderName);
  const activeTaggingJob = useAppSelector(
    selectActiveTaggingJob(projectFolderName ?? ''),
  );

  const [isCopyTagsModalOpen, setIsCopyTagsModalOpen] = useState(false);
  // Auto-open on mount if there's an active tagging job (e.g. user returned to project)
  const [isTaggerModalOpen, setIsTaggerModalOpen] = useState(
    () => activeTaggingJob !== null,
  );
  const [isTriggersModalOpen, setIsTriggersModalOpen] = useState(false);

  const filterTags = useAppSelector(selectFilterTags);
  const selectedAssetsCount = useAppSelector(selectSelectedAssetsCount);
  const effectiveScopeAssetIds = useAppSelector(selectEffectiveScopeAssetIds);

  const openCopyTagsModal = useCallback(() => setIsCopyTagsModalOpen(true), []);
  const closeCopyTagsModal = useCallback(
    () => setIsCopyTagsModalOpen(false),
    [],
  );

  const selectedAssetsData = useAppSelector(selectSelectedAssetsData);
  const filteredAssets = useAppSelector(selectFilteredAssets);
  const filteredAssetsCount = useAppSelector(
    selectAssetsWithActiveFiltersCount,
  );
  const hasReadyModel = useAppSelector(selectHasReadyModel);
  const isAutoTaggerInitialised = useAppSelector(selectIsInitialised);

  // Fetch auto-tagger models on mount to determine if any are ready.
  // Retries with backoff to handle Turbopack cold-compilation races where
  // the API route may 404 for several seconds on a fresh dev server.
  useEffect(() => {
    if (isAutoTaggerInitialised) return;

    const retryDelaysMs = [1000, 3000, 6000];
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const fetchModels = (attempt: number) => {
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
          if (attempt < retryDelaysMs.length) {
            timeoutId = setTimeout(
              () => fetchModels(attempt + 1),
              retryDelaysMs[attempt],
            );
          } else {
            console.error('Failed to fetch auto-tagger models:', err);
          }
        });
    };
    fetchModels(0);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isAutoTaggerInitialised, dispatch]);

  // Whether there are any assets available for auto-tagging (cheap count check)
  const hasAssetsForTagger =
    selectedAssetsData.length > 0 || filteredAssetsCount > 0;

  // Prepare assets for auto-tagger: only compute the full mapped array when modal is open.
  // Videos are excluded — they can't be tagged by WD14 or VLM yet.
  const assetsForTagger = useMemo(() => {
    if (!isTaggerModalOpen) return [];
    const source =
      selectedAssetsData.length > 0 ? selectedAssetsData : filteredAssets;
    return source
      .filter((asset) => !isSupportedVideoExtension(`.${asset.fileExtension}`))
      .map((asset) => ({
        fileId: asset.fileId,
        fileExtension: asset.fileExtension,
      }));
  }, [isTaggerModalOpen, selectedAssetsData, filteredAssets]);

  const openTaggerModal = useCallback(() => setIsTaggerModalOpen(true), []);
  const closeTaggerModal = useCallback(() => setIsTaggerModalOpen(false), []);

  const handleGatherTags = useCallback(() => {
    if (filterTags.length >= 2) {
      dispatch(
        gatherTags({ tags: filterTags, assetIds: effectiveScopeAssetIds }),
      );
    }
  }, [dispatch, filterTags, effectiveScopeAssetIds]);

  const openTriggersModal = useCallback(() => setIsTriggersModalOpen(true), []);
  const closeTriggersModal = useCallback(
    () => setIsTriggersModalOpen(false),
    [],
  );

  const overflowMenuItems: MenuItem[] = [
    {
      label: 'Copy Tags',
      icon: <CopyIcon />,
      onClick: openCopyTagsModal,
      disabled: selectedAssetsCount < 2,
    },
    {
      label: 'Gather Tags',
      icon: <ArrowUpFromLineIcon />,
      onClick: handleGatherTags,
      disabled: filterTags.length < 2,
    },
    {
      label: 'Auto Tagger',
      icon: <SparklesIcon />,
      onClick: openTaggerModal,
      disabled: !hasReadyModel || !hasAssetsForTagger,
    },
    {
      label: 'Trigger Phrases',
      icon: <HighlighterIcon />,
      onClick: openTriggersModal,
    },
  ];

  return (
    <>
      <MenuButton
        icon={<ChevronsDownIcon />}
        items={overflowMenuItems}
        position="bottom-right"
        title="More tag actions"
      />

      <CopyTagsModal
        isOpen={isCopyTagsModalOpen}
        onClose={closeCopyTagsModal}
      />

      <AutoTaggerModal
        isOpen={isTaggerModalOpen}
        onClose={closeTaggerModal}
        selectedAssets={assetsForTagger}
      />

      <TriggerPhrasesModal
        isOpen={isTriggersModalOpen}
        onClose={closeTriggersModal}
      />
    </>
  );
};
