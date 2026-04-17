'use client';

import { useCallback } from 'react';

import { useAppDispatch } from '../store/hooks';
import { startTraining } from '../store/training/training-runtime';
import { TrainingConfigForm } from './components/training-config-form/training-config-form';

export default function TrainingPage() {
  const dispatch = useAppDispatch();

  const handleStartTraining = useCallback(
    (config: Record<string, unknown>) => {
      dispatch(startTraining(config));
    },
    [dispatch],
  );

  return (
    <div className="py-6">
      <TrainingConfigForm onStartTraining={handleStartTraining} />
    </div>
  );
}
