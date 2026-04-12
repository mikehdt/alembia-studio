/**
 * WD v3 model definitions from SmilingWolf
 * https://huggingface.co/SmilingWolf
 *
 * v3 models are the latest generation — v2 models are superseded and removed.
 * EVA02-Large is the most accurate; ConvNext and SwinV2 are lighter alternatives.
 */

import type { TaggerModel } from '../../types';

const PROVIDER_ID = 'wd14';

export const WD14_MODELS: TaggerModel[] = [
  {
    id: 'wd-eva02-large-tagger-v3',
    name: 'EVA02-Large v3',
    provider: PROVIDER_ID,
    repoId: 'SmilingWolf/wd-eva02-large-tagger-v3',
    description: 'Most accurate WD tagger',
    isDefault: true,
    files: [
      { name: 'model.onnx', size: 1_260_435_999 }, // ~1.2GB
      { name: 'selected_tags.csv', size: 308_468 },
    ],
  },
  {
    id: 'wd-convnext-tagger-v3',
    name: 'ConvNext v3',
    provider: PROVIDER_ID,
    repoId: 'SmilingWolf/wd-convnext-tagger-v3',
    description: 'Smallest and fastest',
    files: [
      { name: 'model.onnx', size: 394_990_732 }, // ~377MB
      { name: 'selected_tags.csv', size: 308_468 },
    ],
  },
  {
    id: 'wd-swinv2-tagger-v3',
    name: 'SwinV2 v3',
    provider: PROVIDER_ID,
    repoId: 'SmilingWolf/wd-swinv2-tagger-v3',
    description: 'Good balance of speed and accuracy',
    files: [
      { name: 'model.onnx', size: 467_460_978 }, // ~446MB
      { name: 'selected_tags.csv', size: 308_468 },
    ],
  },
];
