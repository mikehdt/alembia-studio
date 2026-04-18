import type { ReactNode } from 'react';

type InputTraySize = 'sm' | 'md' | 'lg';

type InputTrayProps = {
  children: ReactNode;
  size?: InputTraySize;
  className?: string;
};

const sizeClasses: Record<InputTraySize, string> = {
  sm: 'rounded-sm',
  md: 'p-0.5 rounded-md',
  lg: 'p-1 rounded-lg',
};

export function InputTray({
  children,
  size = 'sm',
  className = '',
}: InputTrayProps) {
  return (
    <div
      className={`inline-flex items-center bg-slate-200 inset-shadow-xs inset-shadow-slate-300 dark:bg-slate-800 dark:inset-shadow-slate-900 ${sizeClasses[size]} ${className}`}
    >
      {children}
    </div>
  );
}
