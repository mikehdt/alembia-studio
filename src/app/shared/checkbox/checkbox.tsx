import React, { KeyboardEvent, MouseEvent, useCallback } from 'react';

type PreviewState = 'select' | 'deselect' | null;

/**
 * Props for the Checkbox component
 */
interface CheckboxProps {
  isSelected: boolean;
  onChange: (e: MouseEvent) => void;
  className?: string;
  tabIndex?: number;
  disabled?: boolean;
  ariaLabel?: string;
  label?: string; // Optional label to display next to the checkbox
  size?: 'sm' | 'md'; // Size of the checkbox
  previewState?: PreviewState; // For shift-hover preview
}

const sizeClasses = {
  sm: {
    checkbox: 'h-4 w-4',
    label: 'text-xs',
    gap: 'gap-1.5',
  },
  md: {
    checkbox: 'h-5 w-5',
    label: 'text-sm',
    gap: 'gap-2',
  },
};

/**
 * A reusable checkbox component with custom styling and keyboard accessibility
 */
export const Checkbox = ({
  isSelected,
  onChange,
  className = '',
  tabIndex = 0,
  disabled = false,
  ariaLabel,
  label,
  size = 'md',
  previewState,
}: CheckboxProps) => {
  const onClick = useCallback(
    (e: MouseEvent) => {
      if (!disabled) onChange(e);
    },
    [disabled, onChange],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        // Create a synthetic mouse event for keyboard activation
        // This ensures consistent handling - keyboard toggles don't support shift-selection
        const syntheticEvent = {
          stopPropagation: () => e.stopPropagation(),
          preventDefault: () => e.preventDefault(),
          shiftKey: false,
        } as MouseEvent;
        onChange(syntheticEvent);
      }
    },
    [disabled, onChange],
  );

  const currentSize = sizeClasses[size];

  // Determine visual state: preview overrides actual selection for display
  const showAsSelected =
    previewState === 'select'
      ? true
      : previewState === 'deselect'
        ? false
        : isSelected;
  const isPreview = previewState !== null && previewState !== undefined;

  // Build checkbox styling based on state
  const getCheckboxStyles = () => {
    if (disabled) {
      return 'border-slate-300 bg-slate-50 shadow-slate-200 dark:bg-slate-700 dark:shadow-slate-900 dark:border-slate-600';
    }

    if (showAsSelected) {
      if (isPreview) {
        // Preview-select: lighter sky blue
        return 'border-sky-400 bg-sky-300 text-white shadow-slate-300 inset-shadow-sky-200';
      }
      // Normal selected
      return 'border-sky-700 bg-sky-500 text-white shadow-slate-500 inset-shadow-sky-300 group-hover/control:bg-sky-600 dark:shadow-slate-600';
    }
    if (isPreview) {
      // Preview-deselect: lighter unselected
      return 'border-slate-300 bg-slate-50 shadow-white inset-shadow-slate-200 dark:shadow-slate-900';
    }
    // Normal unselected
    return 'border-slate-400 bg-white shadow-white inset-shadow-slate-300 group-hover/control:border-sky-500 group-hover/control:bg-sky-50 dark:shadow-slate-900';
  };

  return (
    <label
      className={`group/control inline-flex items-start ${currentSize.gap} ${currentSize.label} select-none ${disabled ? 'cursor-not-allowed text-slate-300 dark:text-slate-600' : 'cursor-pointer text-slate-700 dark:text-slate-400'}`}
      onClick={onClick}
      tabIndex={-1} // prevent double tab stop
    >
      <div
        className={`relative flex ${currentSize.checkbox} items-center justify-center overflow-hidden rounded border shadow-sm inset-shadow-xs transition-all ${getCheckboxStyles()} ${className}`}
        role="checkbox"
        aria-checked={isSelected}
        aria-label={ariaLabel}
        tabIndex={disabled ? -1 : tabIndex}
        onKeyDown={onKeyDown}
      >
        {showAsSelected && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full text-white"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>
      {label && <span>{label}</span>}
    </label>
  );
};
