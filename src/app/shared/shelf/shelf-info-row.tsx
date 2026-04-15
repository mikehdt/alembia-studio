import { type ReactNode } from 'react';

type ShelfInfoRowProps = {
  children: ReactNode;
};

export const ShelfInfoRow = ({ children }: ShelfInfoRowProps) => (
  <div className="relative z-10 border-b border-b-(--border)/50 bg-(--surface-glass-alt) shadow-(--border) backdrop-blur-md">
    <div className="mx-auto flex max-w-400 flex-wrap items-center gap-2 px-4 py-1 text-sm text-(--unselected-text)">
      {children}
    </div>
  </div>
);
