import { Modal } from '@/app/shared/modal';

import { TrainingDetailTabs } from './training-detail-tabs/training-detail-tabs';
import { useTrainingDetailModal } from './use-training-detail-modal';

type TrainingDetailModalProps = {
  /** The job to show, or null when no detail modal should be open. */
  jobId: string | null;
  onClose: () => void;
};

/**
 * Enlarged detail view for a live training job's activity card. Lives at the
 * activity-panel level (not inside a job card) and reads its job straight from
 * Redux by ID, so it keeps live-updating even after the activity panel hides
 * itself while this modal is open. The run-history modal reuses the same
 * {@link TrainingDetailContent} body against an archived snapshot.
 */
export function TrainingDetailModal({
  jobId,
  onClose,
}: TrainingDetailModalProps) {
  const { job } = useTrainingDetailModal(jobId, onClose);
  const isOpen = jobId !== null && job !== null;

  // Widen to make room for the samples grid only once samples exist — with none
  // the modal keeps its original width and looks exactly as before.
  const hasSamples = (job?.progress?.samples?.length ?? 0) > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className={`w-full ${hasSamples ? 'max-w-5xl' : 'max-w-3xl'}`}
      ariaLabel="Training details"
    >
      <TrainingDetailTabs key={job?.id} job={job} />
    </Modal>
  );
}
