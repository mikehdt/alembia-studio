import { BookmarkCheckIcon, BookmarkXIcon } from 'lucide-react';

import { Button } from '@/app/components/shared/button';
import {
  resetAllModifiedTags,
  saveAllAssets,
  selectHasModifiedAssets,
} from '@/app/store/assets';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { selectProjectFolderName } from '@/app/store/project';

export const IoActions = ({ ioInProgress }: { ioInProgress: boolean }) => {
  const dispatch = useAppDispatch();

  const hasModifiedAssets = useAppSelector(selectHasModifiedAssets);
  const projectFolderName = useAppSelector(selectProjectFolderName);

  const saveAllChanges = () => {
    dispatch(saveAllAssets({ projectPath: projectFolderName || undefined }));
  };
  const cancelAllChanges = () => dispatch(resetAllModifiedTags());

  return (
    <>
      <Button
        type="button"
        size="md"
        ghostDisabled
        onClick={cancelAllChanges}
        disabled={!hasModifiedAssets || ioInProgress}
        title={
          hasModifiedAssets ? 'Cancel all tag changes' : 'No changes to cancel'
        }
      >
        <BookmarkXIcon />
        <span className="max-lg:hidden">Cancel All</span>
      </Button>

      <Button
        type="button"
        size="md"
        color="teal"
        ghostDisabled
        neutralDisabled
        onClick={saveAllChanges}
        disabled={!hasModifiedAssets || ioInProgress}
        title={
          hasModifiedAssets ? 'Save all tag changes' : 'No changes to save'
        }
      >
        <BookmarkCheckIcon />
        <span className="max-lg:hidden">Save All</span>
      </Button>
    </>
  );
};
