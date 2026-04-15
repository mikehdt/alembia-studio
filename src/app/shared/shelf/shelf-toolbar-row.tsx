import { type ReactNode } from 'react';

type ShelfToolbarRowProps = {
  children: ReactNode;
};

export const ShelfToolbarRow = ({ children }: ShelfToolbarRowProps) => (
  <div className="border-t border-t-(--border-subtle) bg-(--surface-glass) shadow-md backdrop-blur-md">
    <div className="mx-auto flex min-h-12 max-w-400 items-center gap-2 px-4 text-sm">
      {children}
    </div>
  </div>
);
