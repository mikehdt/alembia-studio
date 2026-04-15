'use client';

import {
  ArrowLeftCircleIcon,
  ChevronDownIcon,
  FolderCogIcon,
  GraduationCapIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { memo, useCallback, useId, useRef } from 'react';

import {
  ShelfInfoRow,
  ShelfToolbarRow,
  TopShelfFrame,
} from '@/app/shared/shelf';
import { MenuThemeSwitcher } from '@/app/shared/menu-theme-switcher';
import { Popup, usePopup } from '@/app/shared/popup';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { selectTheme, setTheme } from '@/app/store/preferences';
import { type ThemeMode } from '@/app/utils/use-theme';

import { useModelDefaultsModal } from './model-defaults-modal/use-model-defaults-modal';
import { TrainingToolbar } from './training-toolbar';

const TrainingMenuComponent = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { openPopup, closePopup, getPopupState } = usePopup();
  const popupId = useId();

  const theme = useAppSelector(selectTheme);
  const { openModal: openModelDefaults } = useModelDefaultsModal();
  const isOpen = getPopupState(popupId).isOpen;

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

  const handleOpenModelDefaults = useCallback(() => {
    closePopup(popupId);
    openModelDefaults();
  }, [closePopup, popupId, openModelDefaults]);

  const handleBackToProjects = useCallback(() => {
    closePopup(popupId);
    router.push('/');
  }, [closePopup, popupId, router]);

  const handleSetTheme = useCallback(
    (mode: ThemeMode) => {
      dispatch(setTheme(mode));
    },
    [dispatch],
  );

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
        <GraduationCapIcon className="h-5 w-5 text-(--unselected-text)" />
        <span className="font-medium text-(--foreground)">Training</span>
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
          <button
            type="button"
            onClick={handleOpenModelDefaults}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <span className="h-5 w-5">
              <FolderCogIcon className="h-5 w-5" />
            </span>
            Model Defaults…
          </button>

          <MenuThemeSwitcher theme={theme} setTheme={handleSetTheme} />

          <button
            type="button"
            onClick={handleBackToProjects}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <span className="h-5 w-5">
              <ArrowLeftCircleIcon className="h-5 w-5" />
            </span>
            Back to Projects
          </button>
        </div>
      </Popup>
    </div>
  );
};

const TrainingMenu = memo(TrainingMenuComponent);

export const TrainingTopShelf = () => {
  return (
    <TopShelfFrame>
      <ShelfInfoRow>
        <TrainingMenu />
      </ShelfInfoRow>
      <ShelfToolbarRow>
        <TrainingToolbar />
      </ShelfToolbarRow>
    </TopShelfFrame>
  );
};
