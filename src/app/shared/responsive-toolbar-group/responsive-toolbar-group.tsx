import React, { ReactNode, useCallback, useId, useRef } from 'react';

import { Button } from '../button';
import { Popup, usePopup } from '../popup';

interface ResponsiveToolbarGroupProps {
  /** Icon to display as the visual indicator/button */
  icon: ReactNode;
  /** Title/tooltip for the group */
  title?: string;
  /** Child components to render inside the toolbar/popover */
  children: ReactNode;
  /** Preferred position for the popover - defaults to center */
  position?: 'left' | 'center' | 'right';
  /** Breakpoint at which to switch from mobile to desktop layout - defaults to md.
   * Use 'full' to always show button-toggle mode regardless of screen size. */
  breakpoint?: 'md' | 'lg' | 'full';
}

/**
 * Internal component that uses the popup context
 */
function ResponsiveToolbarGroupInternal({
  icon,
  title,
  children,
  position = 'center',
  breakpoint = 'md',
}: ResponsiveToolbarGroupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupContentRef = useRef<HTMLDivElement>(null);
  const { openPopup, closePopup, getPopupState } = usePopup();

  const focusFirstInteractable = useCallback(() => {
    const el = popupContentRef.current;
    if (!el) return;
    const focusable = el.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
  }, []);

  const popupId = useId();
  const isPopoverOpen = getPopupState(popupId).isOpen;

  // Define breakpoint-specific classes
  // 'full' breakpoint means always show button mode (no inline desktop view)
  const alwaysButton = breakpoint === 'full';
  const showDesktop = alwaysButton
    ? 'hidden'
    : breakpoint === 'lg'
      ? 'lg:flex'
      : 'md:flex';
  const hideDesktop = alwaysButton
    ? 'flex'
    : breakpoint === 'lg'
      ? 'lg:hidden'
      : 'md:hidden';
  const hideIconOnMobile = alwaysButton
    ? 'hidden'
    : breakpoint === 'lg'
      ? 'max-lg:hidden'
      : 'max-md:hidden';

  // Determine popup position based on the position prop
  const popupPosition =
    position === 'left'
      ? 'bottom-left'
      : position === 'right'
        ? 'bottom-right'
        : 'bottom';

  const handleButtonClick = useCallback(() => {
    if (isPopoverOpen) {
      closePopup(popupId);
    } else {
      openPopup(popupId, {
        position: popupPosition,
        triggerRef: buttonRef,
      });
    }
  }, [isPopoverOpen, closePopup, openPopup, popupPosition, popupId]);

  const handleButtonKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleButtonClick();
    } else if (e.key === 'Escape' && isPopoverOpen) {
      e.preventDefault();
      closePopup(popupId);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Desktop: Show icon with inline children */}
      <div
        role="toolbar"
        aria-label={title}
        className={`hidden min-h-9.5 items-center gap-1 rounded-md bg-(--surface-elevated) px-1 py-1 ${showDesktop}`}
      >
        <div
          className={`mr-1 border-r border-dotted border-r-(--unselected-text) py-1.5 pr-1 text-(--unselected-text) ${hideIconOnMobile}`}
          title={title}
        >
          {icon}
        </div>
        {children}
      </div>

      {/* Mobile: Show button that opens popover */}
      <div
        className={`flex items-center rounded-md bg-(--surface-elevated) px-1 py-1 ${hideDesktop}`}
      >
        <Button
          ref={buttonRef}
          variant="toggle"
          size="toolbar"
          onClick={handleButtonClick}
          onKeyDown={handleButtonKeyDown}
          isPressed={isPopoverOpen}
          title={title}
        >
          {icon}
        </Button>

        {/* If needed later, styles to force full-width: max-sm:right-4! max-sm:left-4! max-sm:w-auto! */}
        <Popup
          id={popupId}
          position={popupPosition}
          triggerRef={buttonRef}
          className="rounded-md border border-(--border) bg-slate-100 shadow-lg shadow-slate-600/50 focus:outline-none dark:bg-slate-700 dark:shadow-slate-950/50"
          disableOverflowHandling
          onPositioned={focusFirstInteractable}
        >
          <div
            ref={popupContentRef}
            role="toolbar"
            aria-label={title}
            className={`flex items-center gap-1 p-2 max-sm:flex-wrap ${
              position === 'left'
                ? 'max-sm:justify-start'
                : position === 'right'
                  ? 'max-sm:justify-end'
                  : 'max-sm:justify-center'
            }`}
          >
            {children}
          </div>
        </Popup>
      </div>
    </div>
  );
}

/**
 * A responsive toolbar group that shows an inactive icon with inline actions at larger screens,
 * and becomes an active icon button with popover at smaller screens.
 * The breakpoint can be customized to 'md', 'lg', or 'full' (always button mode) - defaults to 'md'.
 * This version uses the global popup stack for consistent behavior across the application.
 * Requires a PopupProvider ancestor in the component tree.
 */
export const ResponsiveToolbarGroup = (props: ResponsiveToolbarGroupProps) => {
  return <ResponsiveToolbarGroupInternal {...props} />;
};
