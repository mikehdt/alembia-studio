import { SegmentedControl } from '@/app/shared/segmented-control/segmented-control';
import type { TrainingJob } from '@/app/store/jobs';

import { SamplesGrid } from '../samples-grid/samples-grid';
import { SamplesLightbox } from '../samples-lightbox/samples-lightbox';
import { TrainingDetailContent } from '../training-detail-content';
import { useTrainingDetailTabs } from './use-training-detail-tabs';

/**
 * Tabbed shell around {@link TrainingDetailContent}: an Overview tab (the
 * unchanged detail body) and a Samples tab (the previews grid + in-place
 * lightbox). Shared by the live activity-panel modal and the run-history modal
 * so both get the tabs from one place. When the run has no samples this renders
 * exactly the Overview body with no tab control, so the modal looks as before.
 */
export function TrainingDetailTabs({ job }: { job: TrainingJob | null }) {
  const {
    grid,
    hasSamples,
    tab,
    setTab,
    lightbox,
    openLightbox,
    closeLightbox,
    move,
    activeRow,
    activeColumn,
    activeSample,
  } = useTrainingDetailTabs(job);

  if (!hasSamples) return <TrainingDetailContent job={job} />;

  // No `overflow-hidden` here: the lightbox overlay deliberately extends over
  // the modal's p-6 padding (see its `-inset-6`) to cover the Modal's own close
  // button, and it carries its own rounding, so nothing needs clipping here.
  return (
    <div className="relative">
      {/* Sit the tab control left of the modal's absolute close button. */}
      <div className="mb-4 pr-8">
        <SegmentedControl
          options={[
            { value: 'overview' as const, label: 'Overview' },
            { value: 'samples' as const, label: 'Samples' },
          ]}
          value={tab}
          onChange={setTab}
          size="sm"
        />
      </div>

      {tab === 'overview' ? (
        <TrainingDetailContent job={job} />
      ) : (
        <div className="max-h-[70vh] overflow-y-auto">
          <SamplesGrid grid={grid} onOpen={openLightbox} />
        </div>
      )}

      {lightbox && activeSample && activeRow && activeColumn && (
        <SamplesLightbox
          sample={activeSample}
          row={activeRow}
          column={activeColumn}
          onClose={closeLightbox}
          onMove={move}
        />
      )}
    </div>
  );
}
