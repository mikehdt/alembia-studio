import { type ReactNode } from 'react';

type TopShelfFrameProps = {
  children: ReactNode;
};

export const TopShelfFrame = ({ children }: TopShelfFrameProps) => (
  <div className="fixed top-0 left-0 z-20 w-full">{children}</div>
);
