import { useAppSelector } from '@/app/store/hooks';
import {
  selectTrainingViewMode,
  type TrainingViewMode,
} from '@/app/store/preferences';

/**
 * Read the persisted training view mode from the store.
 *
 * No hydration gate is needed: the server seeds the store from the preferences
 * cookie (see StoreProvider), so this value already matches the server-rendered
 * HTML on the first client render.
 */
export function useTrainingViewMode(): TrainingViewMode {
  return useAppSelector(selectTrainingViewMode);
}
