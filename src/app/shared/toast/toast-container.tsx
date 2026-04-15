'use client';

import { useCallback } from 'react';

import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { removeToast, selectToasts } from '@/app/store/toasts';

import { Toast } from './toast';

export const ToastContainer = () => {
  const toasts = useAppSelector(selectToasts);
  const dispatch = useAppDispatch();

  const handleRemoveToast = useCallback(
    (id: string) => {
      dispatch(removeToast(id));
    },
    [dispatch],
  );

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 transform flex-col items-center gap-0"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onRemove={handleRemoveToast} />
      ))}
    </div>
  );
};
