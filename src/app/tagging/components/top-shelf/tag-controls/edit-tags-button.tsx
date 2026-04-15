import { PencilIcon } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Button } from '@/app/shared/button';
import { selectFilterTags } from '@/app/store/filters';
import { useAppSelector } from '@/app/store/hooks';

import { EditTagsModal } from './edit-tags-modal/edit-tags-modal';

export const EditTagsButton = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filterTags = useAppSelector(selectFilterTags);

  const openModal = useCallback(() => {
    if (filterTags.length > 0) {
      setIsModalOpen(true);
    }
  }, [filterTags.length]);

  const closeModal = useCallback(() => setIsModalOpen(false), []);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="toolbar"
        onClick={openModal}
        disabled={!filterTags.length}
        title="Edit selected tags"
      >
        <PencilIcon />
        <span className="max-xl:hidden">Edit</span>
      </Button>

      <EditTagsModal
        isOpen={isModalOpen}
        onClose={closeModal}
        filterTags={filterTags}
      />
    </>
  );
};
