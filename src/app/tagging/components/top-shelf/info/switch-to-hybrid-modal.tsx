'use client';

import { EraserIcon, PencilIcon } from 'lucide-react';

import { Button } from '@/app/shared/button';
import { Modal } from '@/app/shared/modal';

type SwitchToHybridModalProps = {
  isOpen: boolean;
  /** How many loaded assets carry caption text that can't be re-derived. */
  ambiguousCount: number;
  onClose: () => void;
  /** Keep the caption text as the caption side of the hybrid file. */
  onKeep: () => void;
  /** Drop the caption text, leaving a tags-only hybrid file. */
  onClear: () => void;
};

/**
 * Confirm dialog shown when switching a Caption project to Hybrid mode.
 *
 * Caption mode's box holds the whole file body, so on the way back to hybrid the
 * text is ambiguous: it's either a tag block that was echoed in when the project
 * entered caption mode (keeping it would duplicate every tag after the
 * delimiter), or a real caption the user wrote. Only the user knows which.
 */
export const SwitchToHybridModal = ({
  isOpen,
  ambiguousCount,
  onClose,
  onKeep,
  onClear,
}: SwitchToHybridModalProps) => {
  const imageWord = ambiguousCount === 1 ? 'image has' : 'images have';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-md min-w-[24rem]"
      labelledById="switch-to-hybrid-modal-title"
    >
      <div className="flex flex-wrap gap-4">
        <h2
          id="switch-to-hybrid-modal-title"
          className="w-full text-2xl font-semibold text-slate-700 dark:text-slate-200"
        >
          Switch to Hybrid mode?
        </h2>

        <p className="w-full text-sm text-slate-500">
          {ambiguousCount} {imageWord} caption text that Hybrid can’t place on
          its own. Hybrid keeps tags and a caption in one file, and the tag list
          is already intact — so if this text is a copy of the tags, keeping it
          would write every tag out twice.
        </p>

        <div className="w-full rounded-md border border-slate-300 bg-slate-50 p-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
          Keep it if you wrote a real caption in Caption mode. Clear it if the
          box was just showing your tags back to you.
        </div>

        <div className="flex w-full justify-end gap-2 pt-2">
          <Button
            type="button"
            onClick={onClose}
            color="slate"
            size="md"
            width="lg"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onClear}
            color="rose"
            size="md"
            width="lg"
          >
            <EraserIcon className="mr-1 h-4 w-4" />
            Clear caption
          </Button>
          <Button
            type="button"
            onClick={onKeep}
            color="sky"
            size="md"
            width="lg"
          >
            <PencilIcon className="mr-1 h-4 w-4" />
            Keep caption
          </Button>
        </div>
      </div>
    </Modal>
  );
};
