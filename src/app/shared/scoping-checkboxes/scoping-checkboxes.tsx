'use client';

import { Checkbox } from '../checkbox';

type ScopingCheckboxesProps = {
  // Filtered assets scoping
  hasActiveFilters: boolean;
  filteredCount: number;
  scopeToFiltered: boolean;
  onScopeToFilteredChange: (value: boolean) => void;

  // Selected assets scoping
  hasSelectedAssets: boolean;
  selectedCount: number;
  scopeToSelected: boolean;
  onScopeToSelectedChange: (value: boolean) => void;

  /**
   * When true, checkboxes only appear when both constraints exist.
   * When false, each checkbox appears independently when its constraint exists.
   */
  requireBothConstraints?: boolean;

  /**
   * When true and both constraints are available, at least one must be selected.
   * Only applies when requireBothConstraints is true.
   */
  requireAtLeastOne?: boolean;

  /**
   * When true, shows a border-top separator above the first checkbox.
   */
  showBorder?: boolean;
};

/**
 * Reusable scoping checkboxes for constraining operations to filtered/selected assets.
 * Used by add-tags-modal and edit-tags-modal.
 */
export const ScopingCheckboxes = ({
  hasActiveFilters,
  filteredCount,
  scopeToFiltered,
  onScopeToFilteredChange,
  hasSelectedAssets,
  selectedCount,
  scopeToSelected,
  onScopeToSelectedChange,
  requireBothConstraints = false,
  requireAtLeastOne = false,
  showBorder = false,
}: ScopingCheckboxesProps) => {
  const showBothMode =
    requireBothConstraints && hasSelectedAssets && hasActiveFilters;
  const showIndependentMode =
    !requireBothConstraints && (hasSelectedAssets || hasActiveFilters);

  // Check if validation error should show
  const hasInvalidConstraints =
    requireAtLeastOne && showBothMode && !scopeToSelected && !scopeToFiltered;

  if (!showBothMode && !showIndependentMode) {
    return null;
  }

  const borderClasses = showBorder
    ? 'w-full border-t border-t-slate-300 pt-4 dark:border-t-slate-600'
    : '';

  // In "both" mode, show checkboxes only when both constraints exist
  if (showBothMode) {
    return (
      <>
        <div className={`flex items-center ${borderClasses}`}>
          <Checkbox
            isSelected={scopeToSelected}
            onChange={() => onScopeToSelectedChange(!scopeToSelected)}
            label={`Scope to selected assets (${selectedCount} ${selectedCount === 1 ? 'asset' : 'assets'})`}
            ariaLabel="Scope to selected assets"
          />
        </div>

        <div className="flex items-center">
          <Checkbox
            isSelected={scopeToFiltered}
            onChange={() => onScopeToFilteredChange(!scopeToFiltered)}
            label={`Scope to filtered assets (${filteredCount} ${filteredCount === 1 ? 'asset' : 'assets'})`}
            ariaLabel="Scope to filtered assets"
          />
        </div>

        {hasInvalidConstraints && (
          <p className="text-xs text-red-600">
            Select at least one option above to proceed.
          </p>
        )}
      </>
    );
  }

  // In "independent" mode, show each checkbox when its constraint exists
  // Apply border to the first visible checkbox
  const filteredIsFirst = hasActiveFilters;

  return (
    <>
      {hasActiveFilters && (
        <div
          className={`flex w-full items-center ${filteredIsFirst ? borderClasses : ''}`}
        >
          <Checkbox
            isSelected={scopeToFiltered}
            onChange={() => onScopeToFilteredChange(!scopeToFiltered)}
            label={`Scope to filtered assets (${filteredCount} ${filteredCount === 1 ? 'asset' : 'assets'})`}
            ariaLabel="Scope to filtered assets"
          />
        </div>
      )}

      {hasSelectedAssets && (
        <div
          className={`flex items-center ${!filteredIsFirst ? borderClasses : ''}`}
        >
          <Checkbox
            isSelected={scopeToSelected}
            onChange={() => onScopeToSelectedChange(!scopeToSelected)}
            label={`Scope to selected assets (${selectedCount} ${selectedCount === 1 ? 'asset' : 'assets'})`}
            ariaLabel="Scope to selected assets"
          />
        </div>
      )}
    </>
  );
};
