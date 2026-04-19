import { RotateCcwIcon } from 'lucide-react';
import { useCallback } from 'react';

import { Button } from '@/app/shared/button';

type SectionResetButtonProps = {
  onClick: () => void;
};

export const SectionResetButton = ({ onClick }: SectionResetButtonProps) => {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick();
    },
    [onClick],
  );

  return (
    <Button
      onClick={handleClick}
      size="xs"
      width="lg"
      variant="ghost"
      title="Reset to defaults"
    >
      <RotateCcwIcon />
      Reset
    </Button>
  );
};
