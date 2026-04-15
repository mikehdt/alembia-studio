import { PopupPosition } from './types';

export const ANIMATION_DURATION = 150; // ms - should match CSS transition duration

export const DEFAULT_OFFSET = 4; // px spacing between trigger and popup - matches Tailwind mt-1

const VIEWPORT_MARGIN = 16; // px minimum margin from viewport edges
const MAX_HEIGHT_VH = 0.8; // Maximum height as fraction of viewport height (80vh)
const MIN_DROPDOWN_HEIGHT = 120; // px minimum before trying the opposite direction

interface PopupPositionResult {
  styles: React.CSSProperties;
  adjustedPosition: PopupPosition;
  /** True when the popup needed to be constrained to fit the viewport */
  isConstrained: boolean;
}

/**
 * Calculate popup position using pure math - no DOM manipulation.
 * Uses position:fixed with viewport-relative coordinates so popups
 * are never clipped by overflow:hidden/auto on ancestor elements.
 */
export function calculatePopupPosition(
  popupWidth: number,
  popupHeight: number,
  triggerRect: DOMRect,
  desiredPosition: PopupPosition,
  offset: number = DEFAULT_OFFSET,
  disableOverflowHandling: boolean = false,
): PopupPositionResult {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const styles: React.CSSProperties = {
    position: 'fixed',
    zIndex: 60,
  };

  const horizontalPart = desiredPosition.includes('left')
    ? '-left'
    : desiredPosition.includes('right')
      ? '-right'
      : '';
  const desiredVertical = desiredPosition.startsWith('top') ? 'top' : 'bottom';

  // --- Vertical positioning with flip logic ---
  const spaceBelow =
    viewportHeight - triggerRect.bottom - offset - VIEWPORT_MARGIN;
  const spaceAbove = triggerRect.top - offset - VIEWPORT_MARGIN;

  let verticalPart: 'top' | 'bottom';

  if (disableOverflowHandling) {
    // No flip when overflow handling is disabled
    verticalPart = desiredVertical;
  } else {
    const desiredSpace = desiredVertical === 'bottom' ? spaceBelow : spaceAbove;
    const oppositeSpace =
      desiredVertical === 'bottom' ? spaceAbove : spaceBelow;

    if (desiredSpace >= popupHeight || desiredSpace >= MIN_DROPDOWN_HEIGHT) {
      // Desired direction has enough room (fits fully, or at least the minimum)
      verticalPart = desiredVertical;
    } else if (oppositeSpace > desiredSpace) {
      // Opposite direction has more room — flip
      verticalPart = desiredVertical === 'bottom' ? 'top' : 'bottom';
    } else {
      // Neither side is great — stick with the desired direction
      verticalPart = desiredVertical;
    }
  }

  const adjustedPosition = `${verticalPart}${horizontalPart}` as PopupPosition;

  if (verticalPart === 'top') {
    styles.bottom = viewportHeight - triggerRect.top + offset;
  } else {
    styles.top = triggerRect.bottom + offset;
  }

  // --- Horizontal positioning ---
  // Calculate where the popup's edges would be at natural position
  let naturalLeft: number;
  let naturalRight: number;

  if (desiredPosition.includes('left')) {
    naturalLeft = triggerRect.left;
    naturalRight = naturalLeft + popupWidth;
  } else if (desiredPosition.includes('right')) {
    naturalRight = triggerRect.right;
    naturalLeft = naturalRight - popupWidth;
  } else {
    const triggerCenter = triggerRect.left + triggerRect.width / 2;
    naturalLeft = triggerCenter - popupWidth / 2;
    naturalRight = triggerCenter + popupWidth / 2;
  }

  // Calculate overflow with 1px buffer for rounding tolerance
  const ROUNDING_BUFFER = 1;
  const rightEdgeLimit = viewportWidth - VIEWPORT_MARGIN;
  const leftEdgeLimit = VIEWPORT_MARGIN;
  const maxAvailableWidth = viewportWidth - VIEWPORT_MARGIN * 2;

  const overflowRight = Math.max(0, naturalRight - rightEdgeLimit);
  const overflowLeft = Math.max(0, leftEdgeLimit - naturalLeft);

  const fitsInViewport = popupWidth <= maxAvailableWidth + ROUNDING_BUFFER;
  const isConstrained =
    !fitsInViewport || overflowRight > 0 || overflowLeft > 0;

  if (!fitsInViewport) {
    styles.maxWidth = `${maxAvailableWidth}px`;
    styles.minWidth = `${Math.min(300, maxAvailableWidth)}px`;
    styles.left = leftEdgeLimit;
  } else if (overflowRight > ROUNDING_BUFFER) {
    styles.left = rightEdgeLimit - popupWidth;
  } else if (overflowLeft > ROUNDING_BUFFER) {
    styles.left = leftEdgeLimit;
  } else {
    styles.left = naturalLeft;
  }

  // --- Vertical height constraint ---
  if (!disableOverflowHandling) {
    const maxPreferredHeight = viewportHeight * MAX_HEIGHT_VH;
    const availableHeight = verticalPart === 'bottom' ? spaceBelow : spaceAbove;

    if (
      availableHeight < MIN_DROPDOWN_HEIGHT &&
      popupHeight > availableHeight
    ) {
      // Neither direction has enough room — fill the viewport
      // Remove directional positioning; pin to both edges with margin
      delete styles.top;
      delete styles.bottom;
      styles.top = VIEWPORT_MARGIN;
      styles.bottom = VIEWPORT_MARGIN;
      styles.maxHeight = `${viewportHeight - VIEWPORT_MARGIN * 2}px`;
      styles.overflowY = 'auto';
    } else {
      const maxHeight = Math.min(maxPreferredHeight, availableHeight);

      if (maxHeight > 0) {
        styles.maxHeight = `${maxHeight}px`;
        styles.overflowY = 'auto';
      }
    }
  }

  return { styles, adjustedPosition, isConstrained };
}

/**
 * Get the transform origin CSS value based on popup position for smooth animations.
 */
export function getTransformOrigin(position: PopupPosition): string {
  switch (position) {
    case 'top-left':
      return 'bottom left';
    case 'top':
      return 'bottom center';
    case 'top-right':
      return 'bottom right';
    case 'bottom-left':
      return 'top left';
    case 'bottom':
      return 'top center';
    case 'bottom-right':
      return 'top right';
    default:
      return 'center';
  }
}
