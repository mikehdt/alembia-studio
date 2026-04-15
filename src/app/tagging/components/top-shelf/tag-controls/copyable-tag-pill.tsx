import { CheckIcon, CircleOffIcon } from 'lucide-react';
import { memo, useCallback } from 'react';

type CopyableTagPillProps = {
  tagName: string;
  recipientCount: number;
  isSelected: boolean;
  onToggle: (tagName: string) => void;
};

/**
 * A tag pill for the Copy Tags modal with selection state.
 * Shows: [ count | tagname | ✓/✕ ]
 */
const CopyableTagPillComponent = ({
  tagName,
  recipientCount,
  isSelected,
  onToggle,
}: CopyableTagPillProps) => {
  const handleClick = useCallback(() => {
    onToggle(tagName);
  }, [onToggle, tagName]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggle(tagName);
      }
    },
    [onToggle, tagName],
  );

  return (
    <div
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="checkbox"
      aria-checked={isSelected}
      className={`inline-flex cursor-pointer items-center rounded-2xl border py-1 pr-2 pl-3 transition-all ${
        isSelected
          ? 'border-teal-500 bg-teal-100 hover:bg-teal-50 dark:bg-teal-800 dark:hover:bg-teal-900'
          : 'border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600'
      }`}
    >
      <span
        className={`mr-1.5 inline-flex text-xs tabular-nums ${
          isSelected
            ? 'text-teal-600 dark:text-teal-400'
            : 'text-slate-400 dark:text-slate-500'
        }`}
      >
        {recipientCount}
      </span>
      <span
        className={
          isSelected
            ? 'text-slate-800 dark:text-slate-200'
            : 'text-slate-600 dark:text-slate-400'
        }
      >
        {tagName}
      </span>
      <span
        className={`ml-1.5 inline-flex w-4 ${
          isSelected
            ? 'text-teal-600 dark:text-teal-400'
            : 'text-slate-300 dark:text-slate-600'
        }`}
      >
        {isSelected ? (
          <CheckIcon className="h-4 w-4" />
        ) : (
          <CircleOffIcon className="h-4 w-4" />
        )}
      </span>
    </div>
  );
};

export const CopyableTagPill = memo(CopyableTagPillComponent);
