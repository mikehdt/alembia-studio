'use client';

import { useCallback } from 'react';

import { useAppDispatch } from '@/app/store/hooks';
import { addToast } from '@/app/store/toasts';
import type { ToastVariant } from '@/app/store/toasts/types';

export const useToast = () => {
  const dispatch = useAppDispatch();

  const showToast = useCallback(
    (children: React.ReactNode, variant?: ToastVariant) => {
      dispatch(addToast({ children, variant }));
    },
    [dispatch],
  );

  const showErrorToast = useCallback(
    (children: React.ReactNode) => {
      dispatch(addToast({ children, variant: 'error' }));
    },
    [dispatch],
  );

  return { showToast, showErrorToast };
};
