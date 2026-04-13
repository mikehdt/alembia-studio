/**
 * Types for the auto-tagger Redux slice
 */

export type ModelInfo = {
  id: string;
  name: string;
  provider: string;
  description?: string;
  isDefault?: boolean;
  totalSize: number;
  /**
   * Rough memory estimate in GB. For `runtime: 'transformers'` this is
   * VRAM; for `runtime: 'llama-cpp'` on a CPU build it's system RAM.
   * The UI picks the correct label based on runtime.
   */
  memoryEstimate?: number;
  /** VLM runtime; undefined for ONNX providers. */
  runtime?: 'llama-cpp' | 'transformers';
  /**
   * Whether this VLM model can natively process video frames. True for
   * Qwen-VL family models loaded via transformers (they have dedicated
   * video tokens and temporal embeddings). False/undefined for GGUF
   * (llama-cpp) models, which only see still images. Videos sent to a
   * non-video model fall back to poster-frame substitution upstream.
   */
  supportsVideo?: boolean;
  /**
   * Default video sampling parameters for models that support video.
   * The UI hydrates the per-batch controls from these so a freshly-picked
   * model has sensible starting values without the user having to know
   * what its VRAM headroom looks like.
   */
  videoDefaults?: {
    /** Total frames sampled across the whole clip. */
    frameBudget: number;
    /** Hard cap on sample rate so short clips don't oversample. */
    maxFps: number;
    /** Quality preset name — see VlmVideoQuality in types.ts */
    quality: 'low' | 'standard' | 'high';
  };
  status:
    | 'not_installed'
    | 'downloading'
    | 'ready'
    | 'partial'
    | 'error'
    | 'checking';
};

export type ProviderInfo = {
  id: string;
  name: string;
  description: string;
  providerType: 'onnx' | 'vlm';
};

export type AutoTaggerState = {
  // Whether the models list has been loaded from the API
  isInitialised: boolean;

  // Whether we're currently loading model info
  isLoading: boolean;

  // Available providers
  providers: ProviderInfo[];

  // Available models with their status
  models: ModelInfo[];

  // Currently selected model ID (for tagging)
  selectedModelId: string | null;

  // Error message if something went wrong
  error: string | null;
};
