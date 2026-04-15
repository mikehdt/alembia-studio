'use client';

import { useCallback, useEffect, useState } from 'react';

import type { Toast as ToastType } from '@/app/store/toasts';

type ToastProps = {
  toast: ToastType;
  onRemove: (id: string) => void;
  duration?: number;
};

export const Toast = ({ toast, onRemove, duration = 3000 }: ToastProps) => {
  const [isExiting, setIsExiting] = useState(false);
  const [isEntering, setIsEntering] = useState(true);

  // Trigger enter animation after mount
  useEffect(() => {
    // Use requestAnimationFrame to ensure the DOM is ready
    requestAnimationFrame(() => {
      setIsEntering(false);
    });
  }, []);

  const handleRemove = useCallback(() => {
    setIsExiting(true);
    // Delay the actual removal to allow exit animation to complete
    setTimeout(() => {
      onRemove(toast.id);
    }, 300); // Match this with the exit animation duration
  }, [onRemove, toast.id]);

  useEffect(() => {
    const timer = setTimeout(handleRemove, duration);
    return () => clearTimeout(timer);
  }, [handleRemove, duration]);

  const variantClasses =
    toast.variant === 'error'
      ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200'
      : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900';

  const animationClasses = isExiting
    ? 'opacity-0'
    : isEntering
      ? 'translate-y-4 scale-95 opacity-0'
      : 'translate-y-0 scale-100 opacity-100';

  return (
    <div
      className={`pointer-events-auto mb-3 w-full max-w-sm origin-bottom rounded-lg border px-4 py-3 text-sm shadow-lg shadow-slate-600/50 transition-all duration-300 ease-out dark:shadow-slate-950/50 ${variantClasses} ${animationClasses}`}
      role="alert"
      aria-live="polite"
    >
      {toast.children}
    </div>
  );
};
