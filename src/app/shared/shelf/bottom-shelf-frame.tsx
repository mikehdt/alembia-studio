import { type ReactNode } from 'react';

type BottomShelfFrameProps = {
  children: ReactNode;
};

export const BottomShelfFrame = ({ children }: BottomShelfFrameProps) => (
  <div className="fixed bottom-0 left-0 z-10 w-full border-t border-t-(--border-subtle) bg-(--surface-glass) inset-shadow-sm backdrop-blur-md">
    <div className="mx-auto flex h-12 max-w-400 items-center px-4">
      {children}
    </div>
  </div>
);
