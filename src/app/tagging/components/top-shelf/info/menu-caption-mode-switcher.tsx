import { HashIcon, TextIcon } from 'lucide-react';
import { memo, useCallback } from 'react';

import {
  SegmentedControl,
  type SegmentOption,
} from '@/app/shared/segmented-control/segmented-control';
import type { CaptionMode } from '@/app/store/project/types';

const options: SegmentOption<CaptionMode>[] = [
  { value: 'tags', icon: <HashIcon />, label: 'Tags' },
  // Sentences mode hidden until split logic is reworked
  // { value: 'sentences', icon: <WholeWordIcon />, label: 'Sentences' },
  { value: 'caption', icon: <TextIcon />, label: 'Caption' },
];

type MenuCaptionModeSwitcherProps = {
  captionMode: CaptionMode;
  setCaptionMode: (mode: CaptionMode) => void;
};

const MenuCaptionModeSwitcherComponent = ({
  captionMode,
  setCaptionMode,
}: MenuCaptionModeSwitcherProps) => {
  const stopPropagation = useCallback(
    (e: React.MouseEvent) => e.stopPropagation(),
    [],
  );

  return (
    <div
      className="flex items-center gap-2 px-3 py-2"
      onClick={stopPropagation}
    >
      <span className="text-sm text-slate-700 dark:text-slate-300">
        Tagging
      </span>
      <SegmentedControl
        options={options}
        value={captionMode}
        onChange={setCaptionMode}
        size="sm"
        width="full"
        className="ml-auto"
      />
    </div>
  );
};

export const MenuCaptionModeSwitcher = memo(MenuCaptionModeSwitcherComponent);
