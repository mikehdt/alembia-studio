import { MousePointerClickIcon, PencilIcon } from 'lucide-react';
import { memo, useCallback } from 'react';

import { TagEditMode } from '@/app/store/preferences';

import {
  SegmentedControl,
  type SegmentOption,
} from '../segmented-control/segmented-control';

const options: SegmentOption<TagEditMode>[] = [
  { value: TagEditMode.BUTTON, icon: <PencilIcon />, label: 'Button' },
  {
    value: TagEditMode.DOUBLE_CLICK,
    icon: <MousePointerClickIcon />,
    label: 'Double Click',
  },
];

type MenuEditModeSwitcherProps = {
  editMode: TagEditMode;
  setEditMode: (mode: TagEditMode) => void;
};

const MenuEditModeSwitcherComponent = ({
  editMode,
  setEditMode,
}: MenuEditModeSwitcherProps) => {
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
        Editing
      </span>
      <SegmentedControl
        options={options}
        value={editMode}
        onChange={setEditMode}
        size="sm"
        width="full"
        className="ml-auto"
      />
    </div>
  );
};

export const MenuEditModeSwitcher = memo(MenuEditModeSwitcherComponent);
