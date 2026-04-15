import { XIcon } from 'lucide-react';
import { memo } from 'react';

export type TagChipStatus = 'all' | 'some' | 'none';

type TagChipProps = {
  tag: string;
  status: TagChipStatus;
  isHighlighted: boolean;
  onRemove: (tag: string) => void;
};

const getTagStyles = (status: TagChipStatus, isHighlighted: boolean) => {
  if (isHighlighted) {
    return 'border-blue-500 bg-blue-100 text-blue-800 ring-1 ring-blue-500 dark:bg-blue-800 dark:text-blue-300';
  }

  const styles = {
    none: 'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
    some: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-800 dark:text-amber-300',
    all: 'border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-600 dark:bg-rose-800 dark:text-rose-300',
  };

  return styles[status];
};

const getButtonHoverStyle = (status: TagChipStatus, isHighlighted: boolean) => {
  if (isHighlighted) {
    return 'hover:bg-blue-200';
  }

  const styles = {
    none: 'hover:bg-slate-300 dark:hover:bg-slate-600',
    some: 'hover:bg-amber-200 dark:hover:bg-amber-600',
    all: 'hover:bg-rose-300 dark:hover:bg-rose-600',
  };

  return styles[status];
};

const getIconStyle = (status: TagChipStatus, isHighlighted: boolean) => {
  if (isHighlighted) {
    return 'text-blue-600 dark:text-blue-300';
  }

  const styles = {
    none: 'text-slate-600 dark:text-slate-300',
    some: 'text-amber-600 dark:text-amber-300',
    all: 'text-rose-600 dark:text-rose-300',
  };

  return styles[status];
};

const TagChipComponent = ({
  tag,
  status,
  isHighlighted,
  onRemove,
}: TagChipProps) => {
  return (
    <div
      className={`m-0.5 flex cursor-default items-center gap-1 rounded-full border py-0.5 pr-1 pl-3 text-sm ${getTagStyles(status, isHighlighted)}`}
    >
      <span>{tag}</span>

      <button
        type="button"
        onClick={() => onRemove(tag)}
        className={`ml-1 cursor-pointer rounded-full p-0.5 transition-colors ${getButtonHoverStyle(status, isHighlighted)}`}
        aria-label={`Remove tag ${tag}`}
      >
        <XIcon className={`h-4 w-4 ${getIconStyle(status, isHighlighted)}`} />
      </button>
    </div>
  );
};

export const TagChip = memo(TagChipComponent);
