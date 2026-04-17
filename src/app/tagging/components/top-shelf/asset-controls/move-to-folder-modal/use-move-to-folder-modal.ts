import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  selectAllImages,
  selectAllSubfolders,
  selectIoState,
} from '@/app/store/assets';
import { moveAssetsToFolderThunk } from '@/app/store/assets/actions';
import { IoState } from '@/app/store/assets/types';
import {
  selectHasActiveFilters,
  selectHasActiveVisibility,
} from '@/app/store/filters';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { selectProjectInfo } from '@/app/store/project';
import {
  clearSelection,
  selectAssetsWithActiveFilters,
  selectAssetsWithActiveFiltersCount,
  selectSelectedAssets,
  selectSelectedAssetsCount,
} from '@/app/store/selection';
import { parseSubfolder } from '@/app/utils/subfolder-utils';

const DESTINATION_ROOT = '__root__';
const DESTINATION_NEW = '__new__';

// Regex for the label portion of a repeat folder name
const LABEL_PATTERN = /^[a-zA-Z0-9-]+$/;

type UseMoveToFolderModalParams = {
  isOpen: boolean;
  onClose: () => void;
};

export const useMoveToFolderModal = ({
  isOpen,
  onClose,
}: UseMoveToFolderModalParams) => {
  const dispatch = useAppDispatch();

  // Scoping state
  const [applyToSelectedAssets, setApplyToSelectedAssets] = useState(false);
  const [applyToAssetsWithActiveFilters, setApplyToAssetsWithActiveFilters] =
    useState(false);

  // Keep selection after move
  const [keepSelection, setKeepSelection] = useState(false);

  // Destination state
  const [selectedDestination, setSelectedDestination] = useState('');
  const [newRepeatCount, setNewRepeatCount] = useState(1);
  const [newLabel, setNewLabel] = useState('');

  // Progress and error state
  const [isMoving, setIsMoving] = useState(false);
  const [collisionError, setCollisionError] = useState<string[] | null>(null);
  const [moveErrors, setMoveErrors] = useState<string[] | null>(null);

  // Selectors
  const hasExplicitFilters = useAppSelector(selectHasActiveFilters);
  const hasActiveVisibility = useAppSelector(selectHasActiveVisibility);
  const hasActiveFilters = hasExplicitFilters || hasActiveVisibility;
  const selectedAssets = useAppSelector(selectSelectedAssets);
  const selectedAssetsCount = useAppSelector(selectSelectedAssetsCount);
  const assetsWithActiveFilters = useAppSelector(selectAssetsWithActiveFilters);
  const assetsWithActiveFiltersCount = useAppSelector(
    selectAssetsWithActiveFiltersCount,
  );
  const allImages = useAppSelector(selectAllImages);
  const allSubfolders = useAppSelector(selectAllSubfolders);
  const ioState = useAppSelector(selectIoState);
  const projectInfo = useAppSelector(selectProjectInfo);

  const hasSelectedAssets = selectedAssetsCount > 0;

  // Resolve effective asset IDs based on scoping (same pattern as add-tags-modal)
  const resolvedAssetIds = useMemo(() => {
    if (hasSelectedAssets && hasActiveFilters) {
      if (applyToSelectedAssets && applyToAssetsWithActiveFilters) {
        // Intersection
        const filteredIds = new Set(
          assetsWithActiveFilters.map((a) => a.fileId),
        );
        return selectedAssets.filter((id) => filteredIds.has(id));
      } else if (applyToSelectedAssets) {
        return [...selectedAssets];
      } else if (applyToAssetsWithActiveFilters) {
        return assetsWithActiveFilters.map((a) => a.fileId);
      }
      return [];
    } else if (hasSelectedAssets) {
      return [...selectedAssets];
    } else if (hasActiveFilters) {
      return assetsWithActiveFilters.map((a) => a.fileId);
    }
    return [];
  }, [
    hasSelectedAssets,
    hasActiveFilters,
    applyToSelectedAssets,
    applyToAssetsWithActiveFilters,
    selectedAssets,
    assetsWithActiveFilters,
  ]);

  // Compute source folder summary from resolved assets
  const sourceFolderSummary = useMemo(() => {
    const imageIndex = new Map(allImages.map((img) => [img.fileId, img]));
    const folderCounts: Record<string, number> = {};

    for (const id of resolvedAssetIds) {
      const asset = imageIndex.get(id);
      if (!asset) continue;
      const folder = asset.subfolder ?? DESTINATION_ROOT;
      folderCounts[folder] = (folderCounts[folder] || 0) + 1;
    }
    return folderCounts;
  }, [resolvedAssetIds, allImages]);

  const sourceFolderCount = Object.keys(sourceFolderSummary).length;

  // Count root assets for the folder list
  const rootAssetCount = useMemo(
    () => allImages.filter((img) => !img.subfolder).length,
    [allImages],
  );

  // Build folder options for the radio list
  const folderOptions = useMemo(() => {
    const options: Array<{
      value: string;
      label: string;
      count: number;
      isSource: boolean;
      disabled: boolean;
    }> = [];

    // Root option
    options.push({
      value: DESTINATION_ROOT,
      label: projectInfo.projectFolderName ?? 'Root',
      count: rootAssetCount,
      isSource: DESTINATION_ROOT in sourceFolderSummary,
      disabled:
        resolvedAssetIds.length > 0 &&
        resolvedAssetIds.every((id) => {
          const img = allImages.find((i) => i.fileId === id);
          return img && !img.subfolder;
        }),
    });

    // Existing subfolder options
    const sortedFolders = Object.entries(allSubfolders).sort(([a], [b]) => {
      const parsedA = parseSubfolder(a);
      const parsedB = parseSubfolder(b);
      if (!parsedA || !parsedB) return a.localeCompare(b);
      if (parsedA.repeatCount !== parsedB.repeatCount) {
        return parsedA.repeatCount - parsedB.repeatCount;
      }
      return parsedA.label.localeCompare(parsedB.label);
    });

    for (const [folder, count] of sortedFolders) {
      const parsed = parseSubfolder(folder);
      const displayLabel = parsed
        ? `${parsed.repeatCount}\u00d7 ${parsed.label}`
        : folder;

      options.push({
        value: folder,
        label: displayLabel,
        count,
        isSource: folder in sourceFolderSummary,
        disabled:
          resolvedAssetIds.length > 0 &&
          resolvedAssetIds.every((id) => {
            const img = allImages.find((i) => i.fileId === id);
            return img?.subfolder === folder;
          }),
      });
    }

    return options;
  }, [
    allSubfolders,
    rootAssetCount,
    sourceFolderSummary,
    resolvedAssetIds,
    allImages,
    projectInfo.projectFolderName,
  ]);

  // Resolved destination folder name (null = root)
  const resolvedDestination = useMemo((): string | null => {
    if (selectedDestination === DESTINATION_ROOT) return null;
    if (selectedDestination === DESTINATION_NEW) {
      if (!newLabel.trim() || newRepeatCount < 1) return null;
      return `${newRepeatCount}_${newLabel.trim()}`;
    }
    return selectedDestination || null;
  }, [selectedDestination, newRepeatCount, newLabel]);

  // Count assets that would actually move (not already in destination)
  const effectiveMoveCount = useMemo(() => {
    if (!resolvedDestination && selectedDestination === DESTINATION_ROOT) {
      // Moving to root
      return resolvedAssetIds.filter((id) => {
        const img = allImages.find((i) => i.fileId === id);
        return img?.subfolder; // only count those not already in root
      }).length;
    }
    if (!resolvedDestination) return 0;

    return resolvedAssetIds.filter((id) => {
      const img = allImages.find((i) => i.fileId === id);
      return img?.subfolder !== resolvedDestination;
    }).length;
  }, [resolvedAssetIds, resolvedDestination, selectedDestination, allImages]);

  // New folder validation
  const isNewFolderMode = selectedDestination === DESTINATION_NEW;
  const newFolderName = isNewFolderMode
    ? `${newRepeatCount}_${newLabel.trim()}`
    : '';
  const isNewLabelValid =
    !isNewFolderMode ||
    (newLabel.trim().length > 0 && LABEL_PATTERN.test(newLabel.trim()));
  const isNewRepeatCountValid = !isNewFolderMode || newRepeatCount >= 1;
  const newFolderAlreadyExists =
    isNewFolderMode && newFolderName in allSubfolders;

  // Check if current destination is disabled
  const isSelectedDestinationDisabled = useMemo(() => {
    if (!selectedDestination) return true;
    if (selectedDestination === DESTINATION_NEW) return false;
    const option = folderOptions.find((o) => o.value === selectedDestination);
    return option?.disabled ?? false;
  }, [selectedDestination, folderOptions]);

  // Scoping validation (same as add-tags-modal)
  const hasInvalidConstraints =
    hasSelectedAssets &&
    hasActiveFilters &&
    !applyToSelectedAssets &&
    !applyToAssetsWithActiveFilters;

  // Overall form validity
  const isFormValid =
    !hasInvalidConstraints &&
    resolvedAssetIds.length > 0 &&
    effectiveMoveCount > 0 &&
    selectedDestination !== '' &&
    !isSelectedDestinationDisabled &&
    (!isNewFolderMode || (isNewLabelValid && isNewRepeatCountValid)) &&
    !collisionError;

  // Is the IO state blocking?
  const isIoBlocked =
    ioState === IoState.SAVING ||
    ioState === IoState.LOADING ||
    ioState === IoState.COMPLETING;

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedDestination('');
      setNewRepeatCount(1);
      setNewLabel('');
      setCollisionError(null);
      setMoveErrors(null);
      setIsMoving(false);

      setApplyToSelectedAssets(hasSelectedAssets);
      setApplyToAssetsWithActiveFilters(hasActiveFilters);
    }
  }, [isOpen, hasSelectedAssets, hasActiveFilters]);

  // Clear collision error when destination changes
  useEffect(() => {
    setCollisionError(null);
    setMoveErrors(null);
  }, [selectedDestination, newRepeatCount, newLabel]);

  const handleSubmit = useCallback(async () => {
    if (!isFormValid || isMoving) return;

    setIsMoving(true);
    setCollisionError(null);
    setMoveErrors(null);

    try {
      const dest =
        selectedDestination === DESTINATION_ROOT
          ? null
          : selectedDestination === DESTINATION_NEW
            ? `${newRepeatCount}_${newLabel.trim()}`
            : selectedDestination;

      const result = await dispatch(
        moveAssetsToFolderThunk({
          assetIds: resolvedAssetIds,
          destination: dest,
          projectPath: projectInfo.projectPath,
        }),
      ).unwrap();

      if (result.collisions.length > 0) {
        setCollisionError(result.collisions);
      } else if (result.errors.length > 0) {
        // Partial failure — some moved, some didn't
        setMoveErrors(result.errors);
      } else if (result.moved.length > 0) {
        if (!keepSelection && hasSelectedAssets) {
          dispatch(clearSelection());
        }
        onClose();
      }
    } catch {
      // Thunk rejected — error toast already dispatched
    } finally {
      setIsMoving(false);
    }
  }, [
    isFormValid,
    isMoving,
    dispatch,
    selectedDestination,
    newRepeatCount,
    newLabel,
    resolvedAssetIds,
    projectInfo.projectPath,
    keepSelection,
    hasSelectedAssets,
    onClose,
  ]);

  // Summary message
  const getSummaryMessage = useCallback(() => {
    const count = resolvedAssetIds.length;
    if (count === 0) return '';

    const assetWord = count === 1 ? 'asset' : 'assets';
    const folderWord = sourceFolderCount === 1 ? 'folder' : 'folders';

    if (effectiveMoveCount < count && effectiveMoveCount > 0) {
      return `${effectiveMoveCount} of ${count} ${assetWord} will be moved (${count - effectiveMoveCount} already in destination).`;
    }
    if (effectiveMoveCount === 0) {
      return `All assets are already in the selected destination.`;
    }
    return `${count} ${assetWord} from ${sourceFolderCount} ${folderWord} will be moved. Empty folders will be deleted.`;
  }, [resolvedAssetIds.length, sourceFolderCount, effectiveMoveCount]);

  return {
    // Scoping
    hasActiveFilters,
    assetsWithActiveFiltersCount,
    selectedAssetsCount,
    hasSelectedAssets,
    applyToSelectedAssets,
    setApplyToSelectedAssets,
    applyToAssetsWithActiveFilters,
    setApplyToAssetsWithActiveFilters,
    hasInvalidConstraints,

    // Destination
    selectedDestination,
    setSelectedDestination,
    folderOptions,
    isNewFolderMode,
    newRepeatCount,
    setNewRepeatCount,
    newLabel,
    setNewLabel,
    newFolderName,
    newFolderAlreadyExists,
    isNewLabelValid,
    isNewRepeatCountValid,

    // Selection
    keepSelection,
    setKeepSelection,

    // State
    isMoving,
    isIoBlocked,
    collisionError,
    moveErrors,
    effectiveMoveCount,

    // Validation
    isFormValid,

    // Actions
    handleSubmit,
    getSummaryMessage,

    // Constants for destination values
    DESTINATION_ROOT,
    DESTINATION_NEW,
  };
};
