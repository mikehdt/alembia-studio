import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { memo, useCallback } from 'react';

import type { ThemeMode } from '@/app/store/preferences';

import {
  SegmentedControl,
  type SegmentOption,
} from '../segmented-control/segmented-control';

const options: SegmentOption<ThemeMode>[] = [
  { value: 'light', icon: <SunIcon />, label: 'Light' },
  { value: 'dark', icon: <MoonIcon />, label: 'Dark' },
  { value: 'auto', icon: <MonitorIcon />, label: 'Auto' },
];

type MenuThemeSwitcherProps = {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
};

const MenuThemeSwitcherComponent = ({
  theme,
  setTheme,
}: MenuThemeSwitcherProps) => {
  const stopPropagation = useCallback(
    (e: React.MouseEvent) => e.stopPropagation(),
    [],
  );

  return (
    <div
      className="flex items-center gap-2 px-3 py-2"
      onClick={stopPropagation}
    >
      <span className="text-sm text-slate-700 dark:text-slate-300">Theme</span>
      <SegmentedControl
        options={options}
        value={theme}
        onChange={setTheme}
        size="xs"
        width="full"
        className="ml-auto"
      />
    </div>
  );
};

export const MenuThemeSwitcher = memo(MenuThemeSwitcherComponent);
