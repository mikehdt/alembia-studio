'use client';

import { useCallback } from 'react';

import { DevUIPlayground } from '../shared/dev-ui-playground';
import { useAppDispatch } from '../store/hooks';
import { startMockTraining } from '../store/training/mock-training';
import { TrainingConfigForm } from './components/training-config-form/training-config-form';

export default function TrainingPage() {
  const dispatch = useAppDispatch();

  const handleStartTraining = useCallback(
    (config: Record<string, unknown>) => {
      dispatch(startMockTraining(config));
    },
    [dispatch],
  );

  return (
    <div className="py-6">
      <DevUIPlayground />
      <TrainingConfigForm onStartTraining={handleStartTraining} />
    </div>
  );
}
