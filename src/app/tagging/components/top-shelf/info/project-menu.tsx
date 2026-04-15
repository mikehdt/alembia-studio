import {
  ArrowLeftCircleIcon,
  BoxIcon,
  CalculatorIcon,
  ChevronDownIcon,
  RefreshCwIcon,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { memo, useCallback, useId, useRef, useState } from 'react';

import { MenuEditModeSwitcher } from '@/app/shared/menu-edit-mode-switcher';
import { MenuThemeSwitcher } from '@/app/shared/menu-theme-switcher';
import { Popup, usePopup } from '@/app/shared/popup';
import { IoState, loadAllAssets, selectIoState } from '@/app/store/assets';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import {
  selectTagEditMode,
  selectTheme,
  setTagEditMode,
  setTheme,
  TagEditMode,
  type ThemeMode,
} from '@/app/store/preferences';
import {
  type CaptionMode,
  selectCaptionMode,
  selectProjectFolderName,
  selectProjectName,
  selectProjectThumbnail,
  setCaptionMode,
} from '@/app/store/project';
import { updateProject } from '@/app/utils/project-actions';

import { BucketCropModal } from '../asset-controls/bucket-crop-modal';
import { MenuCaptionModeSwitcher } from './menu-caption-mode-switcher';

type MenuItemProps = {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

const MenuItem = ({ icon, label, onClick, disabled }: MenuItemProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
      disabled
        ? 'cursor-not-allowed text-slate-300 dark:text-slate-500'
        : 'cursor-pointer text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
    }`}
  >
    <span className="h-5 w-5">{icon}</span>
    {label}
  </button>
);

const ProjectMenuComponent = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { openPopup, closePopup, getPopupState } = usePopup();
  const popupId = useId();

  const projectName = useAppSelector(selectProjectName);
  const projectFolderName = useAppSelector(selectProjectFolderName);
  const projectThumbnail = useAppSelector(selectProjectThumbnail);
  const ioState = useAppSelector(selectIoState);

  const theme = useAppSelector(selectTheme);
  const tagEditMode = useAppSelector(selectTagEditMode);
  const captionMode = useAppSelector(selectCaptionMode);

  const [isBucketModalOpen, setIsBucketModalOpen] = useState(false);

  // Build thumbnail src
  const thumbnailSrc = projectThumbnail
    ? `/tagging-projects/${encodeURIComponent(projectThumbnail)}`
    : null;

  const isOpen = getPopupState(popupId).isOpen;
  const ioInProgress =
    ioState === IoState.LOADING ||
    ioState === IoState.SAVING ||
    ioState === IoState.COMPLETING;

  const handleToggle = useCallback(() => {
    if (isOpen) {
      closePopup(popupId);
    } else {
      openPopup(popupId, {
        position: 'bottom-left',
        triggerRef: buttonRef,
      });
    }
  }, [isOpen, closePopup, openPopup, popupId]);

  const handleBackToProjects = useCallback(() => {
    closePopup(popupId);
    router.push('/');
  }, [closePopup, popupId, router]);

  const handleRefresh = useCallback(() => {
    closePopup(popupId);
    if (projectFolderName) {
      dispatch(
        loadAllAssets({
          maintainIoState: false,
          projectPath: projectFolderName,
        }),
      );
    }
  }, [closePopup, popupId, dispatch, projectFolderName]);

  const handleOpenBucketModal = useCallback(() => {
    closePopup(popupId);
    setIsBucketModalOpen(true);
  }, [closePopup, popupId]);

  const handleCloseBucketModal = useCallback(() => {
    setIsBucketModalOpen(false);
  }, []);

  const handleSetTheme = useCallback(
    (mode: ThemeMode) => {
      dispatch(setTheme(mode));
    },
    [dispatch],
  );

  const handleSetTagEditMode = useCallback(
    (mode: TagEditMode) => {
      dispatch(setTagEditMode(mode));
    },
    [dispatch],
  );

  const handleSetCaptionMode = useCallback(
    (mode: CaptionMode) => {
      dispatch(setCaptionMode(mode));
      if (projectFolderName) {
        updateProject(projectFolderName, { captionMode: mode });
      }
    },
    [dispatch, projectFolderName],
  );

  if (!projectName) {
    return null;
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={`flex cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 transition-colors ${
          isOpen ? 'bg-(--surface)' : 'hover:bg-(--surface)/50'
        }`}
      >
        {thumbnailSrc ? (
          <Image
            src={thumbnailSrc}
            alt={`${projectName} thumbnail`}
            width={20}
            height={20}
            priority
            className="h-6 w-6 rounded-full object-cover"
          />
        ) : (
          <BoxIcon className="h-6 w-6 rounded-full bg-(--surface) p-1 text-(--unselected-text)" />
        )}
        <span className="font-medium text-(--foreground)">{projectName}</span>
        <ChevronDownIcon
          className={`h-3 w-3 text-(--unselected-text) transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <Popup
        id={popupId}
        position="bottom-left"
        triggerRef={buttonRef}
        className="min-w-48 rounded-md border border-slate-200 bg-white shadow-lg shadow-slate-600/50 dark:border-slate-600 dark:bg-slate-800 dark:shadow-slate-950/50"
      >
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          <MenuItem
            icon={<RefreshCwIcon className="h-5 w-5" />}
            label="Refresh Assets"
            onClick={handleRefresh}
            disabled={ioInProgress}
          />
          <MenuItem
            icon={<CalculatorIcon className="h-5 w-5" />}
            label="Bucket Visualisation Tool"
            onClick={handleOpenBucketModal}
          />

          <MenuCaptionModeSwitcher
            captionMode={captionMode}
            setCaptionMode={handleSetCaptionMode}
          />

          <MenuEditModeSwitcher
            editMode={tagEditMode}
            setEditMode={handleSetTagEditMode}
          />

          <MenuThemeSwitcher theme={theme} setTheme={handleSetTheme} />

          <MenuItem
            icon={<ArrowLeftCircleIcon className="h-5 w-5" />}
            label="Back to Projects"
            onClick={handleBackToProjects}
            disabled={ioInProgress}
          />
        </div>
      </Popup>

      <BucketCropModal
        isOpen={isBucketModalOpen}
        onClose={handleCloseBucketModal}
      />
    </div>
  );
};

export const ProjectMenu = memo(ProjectMenuComponent);
