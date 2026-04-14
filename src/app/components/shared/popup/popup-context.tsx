'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  PopupConfig,
  PopupContextValue,
  PopupProviderProps,
  PopupState,
} from './types';
import { ANIMATION_DURATION } from './utils';

const PopupContext = createContext<PopupContextValue | null>(null);

const DEFAULT_STATE: PopupState = {
  isOpen: false,
  isAnimating: false,
  shouldRender: false,
  isPositioning: false,
};

/**
 * Global popup stack provider - manages a stack of open popups.
 *
 * When a popup opens:
 * - If its trigger is inside an existing open popup, it's pushed to the stack (child)
 * - If its trigger is outside all open popups, the stack is cleared first (sibling/new chain)
 *
 * Escape closes the top of the stack (innermost popup).
 * Click outside closes the entire stack.
 */
export const PopupProvider: React.FC<PopupProviderProps> = ({ children }) => {
  // Stack of open popup IDs, from bottom (oldest) to top (newest/innermost)
  const [popupStack, setPopupStack] = useState<string[]>([]);
  const [popupStates, setPopupStates] = useState<Map<string, PopupState>>(
    new Map(),
  );
  const popupConfigsRef = useRef<Map<string, PopupConfig>>(new Map());

  // Track pending close-animation timeouts per popup so a reopen can cancel them
  // and prevent the stale teardown from clobbering the freshly-opened state.
  const closingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // The active popup is the top of the stack
  const activePopupId =
    popupStack.length > 0 ? popupStack[popupStack.length - 1] : null;

  const getPopupState = useCallback(
    (id: string): PopupState => {
      return popupStates.get(id) || DEFAULT_STATE;
    },
    [popupStates],
  );

  const getPopupConfig = useCallback((id: string): PopupConfig | undefined => {
    return popupConfigsRef.current.get(id);
  }, []);

  const setPopupConfig = useCallback((id: string, config: PopupConfig) => {
    popupConfigsRef.current.set(id, config);
  }, []);

  const updatePopupState = useCallback(
    (id: string, updates: Partial<PopupState>) => {
      setPopupStates((prev) => {
        const current = prev.get(id) || DEFAULT_STATE;
        const newState = { ...current, ...updates };
        const newMap = new Map(prev);
        newMap.set(id, newState);
        return newMap;
      });
    },
    [],
  );

  /**
   * Close a single popup by ID (with animation)
   */
  const closePopup = useCallback(
    (id: string) => {
      const state = getPopupState(id);
      if (!state.isOpen && !state.isPositioning) return;

      // Start closing animation
      updatePopupState(id, {
        isOpen: false,
        isAnimating: true,
        isPositioning: false,
      });

      // Remove from stack immediately
      setPopupStack((prev) => prev.filter((popupId) => popupId !== id));

      // After animation completes, stop rendering. Track the timeout so a
      // reopen during the animation can cancel it and prevent this teardown
      // from clobbering the freshly-opened state.
      const timeoutId = setTimeout(() => {
        closingTimeoutsRef.current.delete(id);
        updatePopupState(id, {
          isAnimating: false,
          shouldRender: false,
        });
      }, ANIMATION_DURATION);
      closingTimeoutsRef.current.set(id, timeoutId);
    },
    [getPopupState, updatePopupState],
  );

  /**
   * Close all popups in the stack (from top to bottom)
   */
  const closeAllPopups = useCallback(() => {
    // Close from top to bottom for proper visual stacking
    const stackCopy = [...popupStack].reverse();
    for (const id of stackCopy) {
      closePopup(id);
    }
  }, [popupStack, closePopup]);

  /**
   * Close popups from the top of the stack down to (but not including) a specific popup.
   * Used when opening a child popup to close any existing children first.
   */
  const closePopupsAbove = useCallback(
    (parentId: string) => {
      const parentIndex = popupStack.indexOf(parentId);
      if (parentIndex === -1) return;

      // Close all popups above the parent
      const toClose = popupStack.slice(parentIndex + 1).reverse();
      for (const id of toClose) {
        closePopup(id);
      }
    },
    [popupStack, closePopup],
  );

  /**
   * Check if a DOM element is inside any currently open popup
   */
  const findContainingPopup = useCallback(
    (element: HTMLElement | null): string | null => {
      if (!element) return null;

      // Check from top of stack down (innermost first)
      for (let i = popupStack.length - 1; i >= 0; i--) {
        const popupId = popupStack[i];
        const popupElement = document.querySelector(
          `[data-popup-id="${popupId}"]`,
        );
        if (popupElement?.contains(element)) {
          return popupId;
        }
      }
      return null;
    },
    [popupStack],
  );

  const openPopup = useCallback(
    (id: string, config?: PopupConfig) => {
      // If this popup is already open (or mid-open), clicking the trigger
      // again is a no-op rather than a tear-down-and-rebuild. Without this,
      // closeAllPopups() below would close the popup we're trying to open.
      const currentState = getPopupState(id);
      if (currentState.isOpen || currentState.isPositioning) return;

      // If a close animation is in flight for this popup, cancel its pending
      // teardown so it doesn't fire later and clobber the reopened state.
      const pendingClose = closingTimeoutsRef.current.get(id);
      if (pendingClose !== undefined) {
        clearTimeout(pendingClose);
        closingTimeoutsRef.current.delete(id);
      }

      // Update config if provided
      if (config) {
        popupConfigsRef.current.set(id, {
          ...popupConfigsRef.current.get(id),
          ...config,
        });
      }

      const fullConfig = popupConfigsRef.current.get(id);
      const triggerElement = fullConfig?.triggerRef?.current;

      // Check if the trigger is inside an existing open popup
      const containingPopupId = findContainingPopup(triggerElement ?? null);

      if (containingPopupId) {
        // Trigger is inside an open popup - this is a child popup
        // Close any popups above the containing one first
        closePopupsAbove(containingPopupId);
      } else {
        // Trigger is not inside any open popup - start fresh
        closeAllPopups();
      }

      // Add to stack and start opening
      setPopupStack((prev) => {
        // Remove if already in stack (shouldn't happen, but safety)
        const filtered = prev.filter((popupId) => popupId !== id);
        return [...filtered, id];
      });

      updatePopupState(id, {
        shouldRender: true,
        isPositioning: true,
        isAnimating: false,
        isOpen: false,
      });

      // The Popup component will call finishPositioning when ready
    },
    [
      getPopupState,
      findContainingPopup,
      closePopupsAbove,
      closeAllPopups,
      updatePopupState,
    ],
  );

  const finishPositioning = useCallback(
    (id: string) => {
      const state = getPopupState(id);
      if (!state.isPositioning) return;

      // Positioning complete - enable transitions and trigger open animation
      updatePopupState(id, {
        isPositioning: false,
        isOpen: true,
      });
    },
    [getPopupState, updatePopupState],
  );

  // Handle escape key - close the top of the stack (innermost popup)
  // But yield to focused inputs/textareas inside the popup first
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !activePopupId) return;

      // Check if focus is on an input or textarea inside the active popup
      const activeElement = document.activeElement;
      const popupElement = document.querySelector(
        `[data-popup-id="${activePopupId}"]`,
      );

      if (
        activeElement &&
        popupElement?.contains(activeElement) &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA')
      ) {
        // Focus is on an input inside the popup - don't close, let the input handle it
        // The input's onKeyDown can blur itself or call closePopup when ready
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      closePopup(activePopupId);
    };

    if (activePopupId) {
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [activePopupId, closePopup]);

  // Handle click outside - close entire stack if click is outside all popups and triggers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupStack.length === 0) return;

      const target = event.target as Node;

      // Check if click is inside any popup or its trigger
      for (const popupId of popupStack) {
        const config = getPopupConfig(popupId);
        const triggerElement = config?.triggerRef?.current;
        const popupElement = document.querySelector(
          `[data-popup-id="${popupId}"]`,
        );

        // If click is inside this popup or its trigger, don't close anything
        if (
          triggerElement?.contains(target) ||
          popupElement?.contains(target)
        ) {
          return;
        }
      }

      // Click was outside all popups and triggers - close everything
      closeAllPopups();
    };

    if (popupStack.length > 0) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [popupStack, closeAllPopups, getPopupConfig]);

  const contextValue: PopupContextValue = useMemo(
    () => ({
      activePopupId,
      openPopup,
      closePopup,
      closeAllPopups,
      getPopupState,
      setPopupConfig,
      getPopupConfig,
      finishPositioning,
    }),
    [
      activePopupId,
      openPopup,
      closePopup,
      closeAllPopups,
      getPopupState,
      setPopupConfig,
      getPopupConfig,
      finishPositioning,
    ],
  );

  return (
    <PopupContext.Provider value={contextValue}>
      {children}
    </PopupContext.Provider>
  );
};

export const usePopup = () => {
  const context = useContext(PopupContext);
  if (!context) {
    throw new Error('usePopup must be used within a PopupProvider');
  }
  return context;
};
