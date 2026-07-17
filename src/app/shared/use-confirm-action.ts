import { useCallback, useEffect, useRef, useState } from 'react';

/** How long an armed action waits for its confirming click before disarming. */
const CONFIRM_WINDOW_MS = 3500;

/**
 * Two-step confirmation for a destructive action. The first `trigger()` arms
 * the action (callers swap the label to "Confirm?"); a second within the
 * window commits it. It disarms itself if the user doesn't follow through, so
 * a half-pressed button never stays armed waiting to catch a later stray click.
 *
 * A hook rather than a component because the call sites render different
 * button shells — a cramped ghost `ActionButton` in an activity-panel job
 * card, a full-size `Button` in the auto-tagger modal footer — while needing
 * identical arming behaviour.
 */
export function useConfirmAction(
  onConfirm: () => void,
  windowMs: number = CONFIRM_WINDOW_MS,
) {
  const [armed, setArmed] = useState(false);
  const resetTimer = useRef<number | null>(null);

  const clearResetTimer = useCallback(() => {
    if (resetTimer.current !== null) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
  }, []);

  useEffect(() => clearResetTimer, [clearResetTimer]);

  const trigger = useCallback(() => {
    if (armed) {
      clearResetTimer();
      setArmed(false);
      onConfirm();
      return;
    }
    setArmed(true);
    resetTimer.current = window.setTimeout(() => {
      setArmed(false);
      resetTimer.current = null;
    }, windowMs);
  }, [armed, clearResetTimer, onConfirm, windowMs]);

  return { armed, trigger };
}
