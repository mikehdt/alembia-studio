import { ChevronDownIcon } from 'lucide-react';
import { memo, useCallback, useId, useRef } from 'react';

import { Popup, usePopup } from '@/app/shared/popup';

import { useVisibilityControl } from './use-visibility-control';
import { VisibilityPanel } from './visibility-panel';

const VisibilityControlComponent = () => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { openPopup, closePopup, getPopupState } = usePopup();
  const popupId = useId();
  const isOpen = getPopupState(popupId).isOpen;

  const { activeCount } = useVisibilityControl();

  const handleClick = useCallback(() => {
    if (isOpen) {
      closePopup(popupId);
    } else {
      openPopup(popupId, {
        position: 'bottom-left',
        triggerRef: buttonRef,
      });
    }
  }, [isOpen, closePopup, openPopup, popupId]);

  const isActive = activeCount > 0;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="Visibility settings"
        className={`flex cursor-pointer items-center gap-1 rounded-sm border border-slate-300 px-2 py-1 text-sm whitespace-nowrap inset-shadow-xs inset-shadow-white transition-colors dark:border-slate-700 dark:inset-shadow-white/10 ${
          isOpen
            ? 'bg-white shadow-sm dark:bg-slate-700'
            : 'bg-slate-100 shadow-sm hover:bg-slate-200 dark:bg-slate-600 dark:hover:bg-slate-500'
        }`}
      >
        <span className="text-nowrap">Filter Assets</span>

        {isActive && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-xs font-bold text-white tabular-nums">
            {activeCount}
          </span>
        )}

        <ChevronDownIcon
          className={`ml-2 h-3 w-3 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <Popup
        id={popupId}
        position="bottom-left"
        triggerRef={buttonRef}
        className="w-64 rounded-md border border-slate-200 bg-white shadow-md shadow-slate-600/50 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:shadow-slate-950/50"
      >
        <VisibilityPanel />
      </Popup>
    </div>
  );
};

export const VisibilityControl = memo(VisibilityControlComponent);
