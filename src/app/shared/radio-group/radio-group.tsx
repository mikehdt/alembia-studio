import { KeyboardEvent, useCallback } from 'react';

type RadioOption<T extends string> = {
  value: T;
  label: string;
};

type RadioGroupProps<T extends string> = {
  options: RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  name: string;
  layout?: 'inline' | 'list';
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
};

/**
 * A radio button group component with bevel/emboss styling
 * Supports inline (horizontal) or list (vertical) layouts
 */
export function RadioGroup<T extends string>({
  options,
  value,
  onChange,
  name,
  layout = 'inline',
  size = 'md',
  disabled = false,
  className = '',
}: RadioGroupProps<T>) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, optionValue: T) => {
      if (disabled) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onChange(optionValue);
      }
    },
    [disabled, onChange],
  );

  // Size-specific styling
  const sizeClasses = {
    sm: {
      radio: 'h-4 w-4',
      dot: 'h-1.5 w-1.5',
      label: 'text-xs',
      gap: 'gap-1.5',
    },
    md: {
      radio: 'h-5 w-5',
      dot: 'h-2 w-2',
      label: 'text-sm',
      gap: 'gap-2',
    },
  };

  const currentSize = sizeClasses[size];

  // Layout classes
  const layoutClasses = {
    inline: 'flex flex-row flex-wrap gap-4',
    list: 'flex flex-col gap-2',
  };

  // Radio button styling based on state
  const getRadioStyles = (isSelected: boolean) => {
    if (disabled) {
      return 'border-slate-300 bg-slate-50 shadow-slate-200';
    }
    if (isSelected) {
      return 'border-sky-700 bg-linear-to-t from-sky-600 to-sky-500 shadow-slate-500 inset-shadow-xs inset-shadow-sky-300 group-hover/control:from-sky-700 group-hover/control:to-sky-600 dark:shadow-slate-600';
    }
    return 'border-slate-400 bg-linear-to-t from-slate-100 to-white shadow-white inset-shadow-xs inset-shadow-slate-300 group-hover/control:border-sky-500 group-hover/control:from-sky-50 group-hover/control:to-white dark:shadow-slate-900';
  };

  // Inner dot styling
  const getDotStyles = (isSelected: boolean) => {
    if (disabled) {
      return isSelected ? 'bg-slate-400' : 'bg-transparent';
    }
    if (isSelected) {
      return 'bg-white shadow-sm shadow-sky-800';
    }
    return 'bg-transparent';
  };

  return (
    <div
      className={`${layoutClasses[layout]} ${className}`}
      role="radiogroup"
      aria-label={name}
    >
      {options.map((option) => {
        const isSelected = value === option.value;

        return (
          <label
            key={option.value}
            className={`group/control inline-flex items-center ${currentSize.gap} ${currentSize.label} select-none ${
              disabled
                ? 'cursor-not-allowed text-slate-400'
                : 'cursor-pointer text-slate-700 dark:text-slate-400'
            }`}
          >
            <div
              className={`relative flex ${currentSize.radio} items-center justify-center rounded-full border shadow-sm transition-all ${getRadioStyles(isSelected)}`}
              role="radio"
              aria-checked={isSelected}
              tabIndex={disabled ? -1 : 0}
              onKeyDown={(e) => handleKeyDown(e, option.value)}
              onClick={() => !disabled && onChange(option.value)}
            >
              <div
                className={`${currentSize.dot} rounded-full transition-all ${getDotStyles(isSelected)}`}
              />
            </div>
            <span>{option.label}</span>
            {/* Hidden native radio for form semantics */}
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={isSelected}
              onChange={() => onChange(option.value)}
              disabled={disabled}
              className="sr-only"
            />
          </label>
        );
      })}
    </div>
  );
}
