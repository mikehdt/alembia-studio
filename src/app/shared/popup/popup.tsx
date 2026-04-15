'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { usePopup } from './popup-context';
import type { PopupProps } from './types';
import {
  calculatePopupPosition,
  DEFAULT_OFFSET,
  getTransformOrigin,
} from './utils';

/**
 * Check whether the trigger element is at least partially visible in the viewport
 * and not clipped by an overflow:hidden/auto/scroll ancestor.
 */
function isTriggerVisible(trigger: HTMLElement): boolean {
  const rect = trigger.getBoundingClientRect();

  // Fully outside the viewport
  if (
    rect.bottom <= 0 ||
    rect.top >= window.innerHeight ||
    rect.right <= 0 ||
    rect.left >= window.innerWidth
  ) {
    return false;
  }

  // Walk up overflow-clipping ancestors to check if the trigger is hidden
  let parent = trigger.parentElement;
  while (parent) {
    const { overflow, overflowX, overflowY } = getComputedStyle(parent);
    const clips =
      overflow !== 'visible' ||
      overflowX !== 'visible' ||
      overflowY !== 'visible';

    if (clips) {
      const parentRect = parent.getBoundingClientRect();
      if (
        rect.bottom <= parentRect.top ||
        rect.top >= parentRect.bottom ||
        rect.right <= parentRect.left ||
        rect.left >= parentRect.right
      ) {
        return false;
      }
    }
    parent = parent.parentElement;
  }

  return true;
}

export const Popup: React.FC<PopupProps> = ({
  id,
  position = 'bottom',
  triggerRef,
  offset = DEFAULT_OFFSET,
  className = '',
  style: userStyle,
  children,
  disableOverflowHandling = false,
  onPositioned,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const {
    getPopupState,
    getPopupConfig,
    setPopupConfig,
    finishPositioning,
    closePopup,
  } = usePopup();
  const [positionStyles, setPositionStyles] = useState<React.CSSProperties>({});
  const [isConstrained, setIsConstrained] = useState(false);
  // Store natural dimensions measured during positioning phase
  // Needed for resize calculations since scroll dimensions change once constrained
  const naturalWidthRef = useRef<number | null>(null);
  const naturalHeightRef = useRef<number | null>(null);

  const state = getPopupState(id);
  const config = getPopupConfig(id);

  // Set config when popup mounts or props change
  useEffect(() => {
    setPopupConfig(id, { position, triggerRef, offset, className });
  }, [id, position, triggerRef, offset, className, setPopupConfig]);

  /**
   * Calculate and apply position, adjusting for viewport if needed.
   * Uses a ref to access config to avoid useCallback dependency issues.
   */
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  });

  const calculateAndApplyPosition = useCallback(
    (isInitialPositioning: boolean = false) => {
      const popup = popupRef.current;
      const currentConfig = configRef.current;
      const trigger = currentConfig?.triggerRef?.current ?? triggerRef?.current;

      if (!popup || !trigger) return;

      const desiredPosition = currentConfig?.position || position;
      const currentOffset = currentConfig?.offset ?? offset;

      // For initial positioning, measure and store natural dimensions
      // For resize, reuse stored values (scroll dimensions change once constrained)
      let popupWidth: number;
      let popupHeight: number;
      if (isInitialPositioning || naturalWidthRef.current === null) {
        popupWidth = popup.scrollWidth;
        popupHeight = popup.scrollHeight;
        naturalWidthRef.current = popupWidth;
        naturalHeightRef.current = popupHeight;
      } else {
        popupWidth = naturalWidthRef.current;
        popupHeight = naturalHeightRef.current ?? popup.scrollHeight;
      }

      const triggerRect = trigger.getBoundingClientRect();

      // Calculate final position using pure math (no DOM manipulation)
      const {
        styles,
        adjustedPosition,
        isConstrained: constrained,
      } = calculatePopupPosition(
        popupWidth,
        popupHeight,
        triggerRect,
        desiredPosition,
        currentOffset,
        disableOverflowHandling,
      );

      // Add transform origin to styles
      styles.transformOrigin = getTransformOrigin(adjustedPosition);

      // Apply everything through React state
      setPositionStyles(styles);
      setIsConstrained(constrained);
    },
    [position, offset, triggerRef, disableOverflowHandling],
  );

  // Handle the positioning phase when popup opens
  useEffect(() => {
    if (!state.shouldRender || !state.isPositioning) return;
    if (!popupRef.current) return;

    // Clear stored natural dimensions so we measure fresh
    naturalWidthRef.current = null;
    naturalHeightRef.current = null;

    // We're in positioning phase - calculate position while hidden
    calculateAndApplyPosition(true);

    // Use double rAF to ensure styles are applied before enabling transitions
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Positioning complete - tell context to enable transitions and animate
        finishPositioning(id);
        // Notify consumer that popup is positioned and about to be visible
        onPositioned?.();
      });
    });
  }, [
    state.shouldRender,
    state.isPositioning,
    calculateAndApplyPosition,
    finishPositioning,
    id,
    onPositioned,
  ]);

  // Reposition on resize and scroll while popup is open.
  // With position:fixed, the popup doesn't move with scrollable ancestors,
  // so we recalculate on any scroll event (captured at window level).
  // If the trigger scrolls out of view, close the popup automatically.
  useEffect(() => {
    if (!state.isOpen) return;

    let rafId: number | null = null;

    const handleRepositionEvent = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        // Check if the trigger is still visible before repositioning
        const trigger =
          configRef.current?.triggerRef?.current ?? triggerRef?.current;
        if (trigger && !isTriggerVisible(trigger)) {
          closePopup(id);
        } else {
          calculateAndApplyPosition();
        }
        rafId = null;
      });
    };

    window.addEventListener('resize', handleRepositionEvent);
    window.addEventListener('scroll', handleRepositionEvent, true);
    return () => {
      window.removeEventListener('resize', handleRepositionEvent);
      window.removeEventListener('scroll', handleRepositionEvent, true);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [state.isOpen, calculateAndApplyPosition, closePopup, id, triggerRef]);

  // Don't render if not needed
  if (!state.shouldRender) {
    return null;
  }

  // Determine if transitions should be enabled
  // Disabled during positioning phase to prevent "fly-in" effect
  const transitionsEnabled = !state.isPositioning;

  // During positioning phase:
  // 1. Hide with visibility:hidden (prevents flash, allows measurement)
  // 2. Clear all positioning styles so we can measure natural width
  // Note: autoFocus won't work during this phase - use onPositioned callback instead
  // After positioning, apply the calculated styles
  const appliedStyles: React.CSSProperties = state.isPositioning
    ? {
        position: 'fixed',
        zIndex: 60,
        visibility: 'hidden',
        ...userStyle,
      }
    : { ...positionStyles, ...userStyle };

  const popupElement = (
    <div
      ref={popupRef}
      data-popup-id={id}
      data-constrained={isConstrained || undefined}
      style={appliedStyles}
      className={`text-sm ${
        transitionsEnabled ? 'transition-all duration-150 ease-in-out' : ''
      } ${
        state.isOpen
          ? 'scale-100 opacity-100'
          : 'pointer-events-none scale-95 opacity-0'
      } ${className}`}
    >
      {children}
    </div>
  );

  // Portal to document.body so the popup is never clipped by
  // overflow:hidden/auto on ancestor elements (e.g. modals).
  return createPortal(popupElement, document.body);
};
