/**
 * Vision-Language Model definitions for natural-language captioning
 *
 * Two runtimes are supported:
 * - 'llama-cpp': GGUF quants via llama-cpp-python (CPU-only on Windows)
 * - 'transformers': HuggingFace safetensors via PyTorch + CUDA (GPU path)
 *
 * Abliterated variants are preferred — standard models can be overly
 * conservative on content that's perfectly fine for training data.
 *
 * VRAM estimates are rough and depend on context length and image size.
 */

import type { TaggerModel } from '../../types';

const PROVIDER_ID = 'vlm';

export const VLM_MODELS: TaggerModel[] = [
  // --- Transformers / GPU path ---
  {
    id: 'qwen3-vl-4b-gpu',
    name: 'Qwen3-VL 4B (GPU)',
    provider: PROVIDER_ID,
    runtime: 'transformers',
    repoId: 'huihui-ai/Huihui-Qwen3-VL-4B-Instruct-abliterated',
    description: 'Fast GPU captioning, fp16, ~9GB VRAM',
    isDefault: true,
    vramEstimate: 9,
    supportsVideo: true,
    // 4B leaves plenty of VRAM headroom on a 16GB card; 32 frames at
    // standard quality lands well under peak. A 7B/8B entry would want
    // a smaller budget.
    videoDefaults: {
      frameBudget: 32,
      maxFps: 2.0,
      quality: 'standard',
    },
    files: [
      // Config and tokenizer files — small, needed by transformers.from_pretrained
      { name: 'config.json', size: 1_548 },
      { name: 'generation_config.json', size: 213 },
      { name: 'preprocessor_config.json', size: 782 },
      { name: 'video_preprocessor_config.json', size: 817 },
      { name: 'special_tokens_map.json', size: 613 },
      { name: 'tokenizer_config.json', size: 5_445 },
      { name: 'added_tokens.json', size: 707 },
      { name: 'chat_template.jinja', size: 5_292 },
      { name: 'vocab.json', size: 2_776_833 },
      { name: 'merges.txt', size: 1_671_853 },
      { name: 'tokenizer.json', size: 11_422_654 },
      // Weight shards
      { name: 'model.safetensors.index.json', size: 64_778 },
      {
        name: 'model-00001-of-00002.safetensors',
        size: 4_990_497_880,
      },
      {
        name: 'model-00002-of-00002.safetensors',
        size: 3_885_221_448,
      },
    ],
  },

  // --- llama-cpp / CPU path (kept for non-GPU users and fallback) ---
  {
    id: 'qwen3-vl-8b-abliterated',
    name: 'Qwen3-VL 8B (CPU)',
    provider: PROVIDER_ID,
    runtime: 'llama-cpp',
    repoId: 'mradermacher/Qwen3-VL-8B-Instruct-abliterated-v2.0-GGUF',
    description: 'Strong CPU captioning, GGUF Q6_K, slow without GPU',
    vramEstimate: 7,
    files: [
      // Main LLM weights
      {
        name: 'Qwen3-VL-8B-Instruct-abliterated-v2.0.Q6_K.gguf',
        size: 6_725_901_408,
      },
      // Vision projector — required for image input via llama-cpp-python
      {
        name: 'Qwen3-VL-8B-Instruct-abliterated-v2.0.mmproj-Q8_0.gguf',
        size: 752_290_272,
      },
    ],
  },
  {
    id: 'qwen3.5-vl-8b',
    name: 'Qwen3.5-VL 8B (CPU)',
    provider: PROVIDER_ID,
    runtime: 'llama-cpp',
    repoId: 'Qwen/Qwen3.5-VL-8B-Instruct-GGUF',
    description: 'Latest Qwen vision model, conservative safety filters',
    vramEstimate: 6,
    files: [{ name: 'qwen3.5-vl-8b-instruct-q6_k.gguf', size: 6_700_000_000 }],
  },
  {
    id: 'gemma-3-12b-abliterated',
    name: 'Gemma 3 12B (CPU)',
    provider: PROVIDER_ID,
    runtime: 'llama-cpp',
    repoId: 'mradermacher/gemma-3-12b-it-abliterated-i1-GGUF',
    description: 'Google vision model, different description style',
    vramEstimate: 9,
    files: [
      {
        name: 'gemma-3-12b-it-abliterated.i1-Q6_K.gguf',
        size: 9_800_000_000,
      },
    ],
  },
];
