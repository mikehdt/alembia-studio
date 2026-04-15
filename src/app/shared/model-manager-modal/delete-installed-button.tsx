'use client';

import { Trash2Icon, XIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '../button';

/**
 * Inline-confirm Delete button for an installed model.
 *
 * Click once → swaps to "Confirm — frees X GB" + Cancel for ~3 seconds.
 * Click again → calls onConfirm.
 * No second click → reverts to the resting Delete icon.
 *
 * Used in the Model Manager rows to uninstall a fully-downloaded model.
 */
export function DeleteInstalledButton({
  onConfirm,
}: {
  sizeBytes: number;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disarm = useCallback(() => {
    setArmed(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleArm = useCallback(() => {
    setArmed(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setArmed(false);
      timerRef.current = null;
    }, 3000);
  }, []);

  const handleConfirm = useCallback(() => {
    disarm();
    onConfirm();
  }, [disarm, onConfirm]);

  if (!armed) {
    return (
      <Button
        onClick={handleArm}
        color="rose"
        variant="ghost"
        size="sm"
        width="sm"
        title="Delete model files"
      >
        <Trash2Icon />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        onClick={handleConfirm}
        color="rose"
        size="sm"
        width="sm"
        title="Confirm delete"
      >
        <Trash2Icon />
        Confirm
      </Button>

      <Button
        onClick={disarm}
        color="slate"
        variant="ghost"
        size="sm"
        width="sm"
        title="Cancel"
      >
        <XIcon />
      </Button>
    </div>
  );
}
