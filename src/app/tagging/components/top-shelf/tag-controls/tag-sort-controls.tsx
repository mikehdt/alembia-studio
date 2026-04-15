import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import { useCallback } from 'react';

import { Button } from '@/app/shared/button';
import { Dropdown, DropdownItem } from '@/app/shared/dropdown';
import { InputTray } from '@/app/shared/input-tray/input-tray';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import {
  selectTagSortDirection,
  selectTagSortType,
  setTagSortDirection,
  setTagSortType,
  TagSortDirection,
  TagSortType,
  toggleTagSortDirection,
} from '@/app/store/project';

/**
 * Get the appropriate sort direction label based on sort type
 */
const getTagSortDirectionLabel = (
  sortType: TagSortType,
  sortDirection: TagSortDirection,
): string => {
  const isAsc = sortDirection === TagSortDirection.ASC;

  switch (sortType) {
    case TagSortType.ALPHABETICAL:
      return isAsc ? 'A-Z' : 'Z-A';
    case TagSortType.FREQUENCY:
      return isAsc ? '0-9' : '9-0';
    case TagSortType.SORTABLE:
    default:
      return 'Saved';
  }
};

const tagSortTypeItems: DropdownItem<TagSortType>[] = [
  {
    value: TagSortType.SORTABLE,
    label: 'Tag Order',
  },
  {
    value: TagSortType.ALPHABETICAL,
    label: 'Alphabetical',
  },
  {
    value: TagSortType.FREQUENCY,
    label: 'Frequency',
  },
];

export const TagSortControls = () => {
  const dispatch = useAppDispatch();

  const tagSortType = useAppSelector(selectTagSortType);
  const tagSortDirection = useAppSelector(selectTagSortDirection);

  const handleSortTypeChange = useCallback(
    (newSortType: TagSortType) => {
      dispatch(setTagSortType(newSortType));
      const defaultDirection =
        newSortType === TagSortType.FREQUENCY
          ? TagSortDirection.DESC
          : TagSortDirection.ASC;
      dispatch(setTagSortDirection(defaultDirection));
    },
    [dispatch],
  );

  const handleToggleSortDirection = useCallback(() => {
    dispatch(toggleTagSortDirection());
  }, [dispatch]);

  const showDirectionToggle = tagSortType !== TagSortType.SORTABLE;

  return (
    <InputTray>
      <Dropdown
        size="toolbar"
        items={tagSortTypeItems}
        selectedValue={tagSortType}
        onChange={handleSortTypeChange}
      />

      {showDirectionToggle && (
        <Button
          type="button"
          onClick={handleToggleSortDirection}
          variant="ghost"
          size="toolbar"
          title={`Sort ${tagSortDirection === TagSortDirection.ASC ? 'ascending' : 'descending'}`}
        >
          {tagSortDirection === TagSortDirection.ASC ? (
            <ArrowUpIcon />
          ) : (
            <ArrowDownIcon />
          )}

          <span className="ml-1 max-2xl:hidden">
            {getTagSortDirectionLabel(tagSortType, tagSortDirection)}
          </span>
        </Button>
      )}
    </InputTray>
  );
};
