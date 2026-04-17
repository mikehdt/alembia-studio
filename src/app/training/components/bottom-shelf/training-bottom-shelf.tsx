import { ListPlusIcon, PlayIcon } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { BottomShelfFrame } from '@/app/shared/shelf';
import { Button } from '@/app/shared/button';
import { useAppSelector } from '@/app/store/hooks';
import { selectIsTraining } from '@/app/store/jobs';

type TrainingBottomShelfProps = {
  canStart: boolean;
  onStart: () => void;
};

// Defer the button's disabled state until after hydration. `canStart` is
// derived from form state that matches SSR, but something in React 19 /
// Turbopack is flagging the `disabled` attribute as mismatched anyway.
// Using the server-snapshot technique guarantees the first client render
// mirrors SSR, then the real value comes in on the mount re-render.
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export const TrainingBottomShelf = ({
  canStart,
  onStart,
}: TrainingBottomShelfProps) => {
  const isTraining = useAppSelector(selectIsTraining);
  const isClient = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const effectiveCanStart = isClient ? canStart : true;

  return (
    <BottomShelfFrame>
      <div className="ml-auto flex items-center text-sm">
        <Button
          size="md"
          onClick={onStart}
          ghostDisabled
          neutralDisabled
          disabled={!effectiveCanStart}
          color="teal"
        >
          {isClient && isTraining ? (
            <>
              <ListPlusIcon />
              Add to Queue
            </>
          ) : (
            <>
              <PlayIcon />
              Start Training
            </>
          )}
        </Button>
      </div>
    </BottomShelfFrame>
  );
};
