import type { ProviderType } from '@/app/services/auto-tagger';
import { Button } from '@/app/shared/button';
import type { TaggingSummary } from '@/app/store/jobs';

type ImageError = { fileId: string; error: string };

type AutoTaggerSummaryProps = {
  summary: TaggingSummary;
  wasCancelled: boolean;
  providerType?: ProviderType;
  imageErrors?: ImageError[];
  onClose: () => void;
};

export function AutoTaggerSummary({
  summary,
  wasCancelled,
  providerType,
  imageErrors = [],
  onClose,
}: AutoTaggerSummaryProps) {
  const hasErrors = imageErrors.length > 0;
  const isCaptioning = providerType === 'vlm';

  const verbPast = isCaptioning ? 'Captioning' : 'Tagging';
  const noneSuffix = isCaptioning
    ? 'had no caption'
    : 'had no new tags (threshold not met or already tagged)';

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`rounded-md border p-4 text-sm ${
          wasCancelled
            ? 'border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
            : hasErrors && summary.imagesWithNewTags === 0
              ? 'border-rose-400 bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
              : 'border-teal-400 bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200'
        }`}
      >
        <p className="font-medium">
          {wasCancelled
            ? `${verbPast} cancelled`
            : hasErrors && summary.imagesWithNewTags === 0
              ? `${verbPast} failed`
              : `${verbPast} complete!`}
        </p>
        <ul className="mt-2 space-y-1">
          <li>
            Processed {summary.imagesProcessed}
            {summary.imagesProcessed !== 1 ? 'images' : 'image'}
          </li>
          {isCaptioning ? (
            <li>
              Captioned {summary.imagesWithNewTags}
              {summary.imagesWithNewTags !== 1 ? 'images' : 'image'}
            </li>
          ) : (
            <li>
              Found {summary.totalTagsFound}
              {summary.totalTagsFound !== 1 ? 'tags' : 'tag'} across{' '}
              {summary.imagesWithNewTags}
              {summary.imagesWithNewTags !== 1 ? 'images' : 'image'}
            </li>
          )}
          {summary.imagesProcessed > summary.imagesWithNewTags &&
            imageErrors.length === 0 && (
              <li className={wasCancelled ? 'text-amber-600' : 'text-teal-600'}>
                {summary.imagesProcessed - summary.imagesWithNewTags}
                {summary.imagesProcessed - summary.imagesWithNewTags !== 1
                  ? 'images'
                  : 'image'}{' '}
                {noneSuffix}
              </li>
            )}
        </ul>
      </div>

      {hasErrors && (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-sm dark:border-rose-800 dark:bg-rose-950">
          <p className="font-medium text-rose-700 dark:text-rose-200">
            {imageErrors.length}
            {imageErrors.length !== 1 ? 'errors' : 'error'} during batch:
          </p>
          <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto text-rose-700 dark:text-rose-200">
            {imageErrors.slice(0, 20).map((err, i) => (
              <li key={`${err.fileId}-${i}`} className="wrap-break-word">
                <span className="font-mono text-xs opacity-70">
                  {err.fileId}
                </span>
                <br />
                <span className="text-sm">{err.error}</span>
              </li>
            ))}
            {imageErrors.length > 20 && (
              <li className="italic opacity-70">
                …and {imageErrors.length - 20} more
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={onClose} color="indigo" size="md">
          Done
        </Button>
      </div>
    </div>
  );
}
