import { Modal } from '@/app/shared/modal';
import type { TaggingJob } from '@/app/store/jobs';

import { TaggingDetailContent } from './tagging-detail-content';
import { useTaggingDetailModal } from './use-tagging-detail-modal';

type TaggingDetailModalProps = {
  /** The job to show, or null when no detail modal should be open. */
  jobId: string | null;
  onClose: () => void;
  onCancel: (job: TaggingJob) => void;
};

/**
 * Enlarged detail view for a tagging/caption job's activity card. Lives at the
 * activity-panel level (not inside a job card) and reads its job straight from
 * Redux by ID, so it keeps live-updating even after the activity panel hides
 * itself while this modal is open — the same arrangement as
 * {@link TrainingDetailModal}.
 */
export function TaggingDetailModal({
  jobId,
  onClose,
  onCancel,
}: TaggingDetailModalProps) {
  const { job } = useTaggingDetailModal(jobId, onClose);
  const isOpen = jobId !== null && job !== null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="w-full max-w-3xl"
      ariaLabel="Tagging details"
    >
      <TaggingDetailContent job={job} onCancel={onCancel} />
    </Modal>
  );
}
