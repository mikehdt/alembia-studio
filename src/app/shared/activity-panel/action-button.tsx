import { Button } from '../button';

/** Small text button used in job card action rows. */
export function ActionButton({
  onClick,
  title,
  variant = 'default',
  children,
}: {
  onClick: () => void;
  title: string;
  variant?: 'default' | 'danger';
  children: React.ReactNode;
}) {
  return (
    <Button
      onClick={onClick}
      color={variant === 'danger' ? 'rose' : 'slate'}
      size="xs"
      width="sm"
      variant="ghost"
      title={title}
    >
      {children}
    </Button>
  );
}
