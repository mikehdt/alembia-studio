/**
 * Types for the auto-tagger service
 * Supports ONNX booru taggers (Node.js) and NL vision-language models (Python sidecar)
 */

/** How the provider runs inference */
export type ProviderType = 'onnx' | 'vlm';

/**
 * Which Python runtime handles a VLM model.
 * - 'llama-cpp': GGUF quants via llama-cpp-python (CPU / Linux CUDA)
 * - 'transformers': HuggingFace transformers + PyTorch (Windows CUDA path)
 *
 * Ignored for 'onnx' provider models.
 */
export type VlmRuntime = 'llama-cpp' | 'transformers';

export type TaggerProvider = {
  id: string;
  name: string;
  description: string;
  providerType: ProviderType;
  models: TaggerModel[];
};

export type TaggerModel = {
  id: string;
  name: string;
  provider: string;
  repoId: string;
  files: ModelFile[];
  description?: string;
  isDefault?: boolean;
  /** VRAM estimate in GB for VLM models (helps users pick the right quant) */
  vramEstimate?: number;
  /**
   * Which Python runtime loads this model. Only meaningful for VLM models.
   * Defaults to 'llama-cpp' for backwards compatibility with existing GGUF entries.
   */
  runtime?: VlmRuntime;
  /**
   * Whether this model can natively process video frames. True for Qwen-VL
   * via transformers (real video token support), false/undefined for GGUF
   * (which only sees stills). Videos sent to a non-video model fall back
   * to poster-frame substitution upstream of the sidecar.
   */
  supportsVideo?: boolean;
  /**
   * Per-model defaults for the video sampling controls. Lets a smaller
   * model ship with a larger frame budget than a memory-heavier one
   * without the user having to know the math.
   */
  videoDefaults?: VlmVideoOptions;
};

export type ModelFile = {
  name: string;
  size: number;
};

export type TagResult = {
  tag: string;
  confidence: number;
};

export type TaggerOutput = {
  general: TagResult[];
  character: TagResult[];
  rating: TagResult[];
};

export type TagInsertMode = 'prepend' | 'append';

/**
 * Where injected trigger phrases should land in a VLM-generated caption.
 * Distinct from `TagInsertMode` because 'integrate' has no analogue in the
 * ONNX tagging flow — it asks the model to weave phrases into the prose
 * where they fit naturally, falling back to append for ones that don't.
 */
export type TriggerPhraseInsertMode = 'prepend' | 'integrate' | 'append';

/**
 * Frame quality preset for video captioning. Maps to a `max_pixels` value
 * the qwen-vl-utils video reader uses to resize each sampled frame before
 * passing it to the model. Higher quality = bigger VRAM footprint per frame
 * = slower inference, but more visual detail per frame.
 */
export type VlmVideoQuality = 'low' | 'standard' | 'high';

/**
 * Per-batch video sampling controls. Only applied when at least one selected
 * asset is a video AND the chosen model declares `supportsVideo: true`.
 * The actual `fps` per video is derived as `min(maxFps, frameBudget/duration)`
 * so a 5-minute clip still gets uniform coverage across its full length while
 * a 5-second clip doesn't oversample.
 */
export type VlmVideoOptions = {
  /** Total frames sampled across the whole clip, regardless of duration. */
  frameBudget: number;
  /** Hard cap on sample rate so short clips don't oversample. */
  maxFps: number;
  /** Quality preset — controls the per-frame resolution sent to the model. */
  quality: VlmVideoQuality;
};

/**
 * `max_pixels` value passed to qwen-vl-utils for each quality preset.
 * Numbers are roughly the patch counts Qwen recommends for video frames.
 */
export const VLM_VIDEO_QUALITY_PIXELS: Record<VlmVideoQuality, number> = {
  low: 280 * 320,
  standard: 360 * 420,
  high: 560 * 640,
};

export type TaggerOptions = {
  generalThreshold: number;
  characterThreshold: number;
  removeUnderscore: boolean;
  includeCharacterTags: boolean;
  includeRatingTags: boolean;
  excludeTags: string[];
  includeTags: string[];
  tagInsertMode: TagInsertMode;
};

export const DEFAULT_TAGGER_OPTIONS: TaggerOptions = {
  generalThreshold: 0.3,
  characterThreshold: 0.9,
  removeUnderscore: true,
  includeCharacterTags: false,
  includeRatingTags: false,
  excludeTags: [],
  includeTags: [],
  tagInsertMode: 'append',
};

/**
 * VLM (natural-language captioner) options.
 * Used when the selected model's provider is 'vlm'.
 */
export type VlmOptions = {
  prompt: string;
  maxTokens: number;
  temperature: number;
  /**
   * If true, the project's trigger phrases are appended to the prompt as a
   * must-include instruction. The backend handles the actual injection at
   * request time so the prompt the user edits stays clean.
   */
  injectTriggerPhrases: boolean;
  /**
   * Where injected trigger phrases should land in the generated caption.
   * - 'prepend':   model places them at the very start, then writes the caption
   * - 'integrate': model weaves them into the prose where they fit, falling
   *                back to the end for phrases that don't fit naturally
   * - 'append':    model writes the caption first, then lists them at the end
   */
  triggerPhraseInsertMode: TriggerPhraseInsertMode;
  /** Per-batch video sampling controls. Ignored when no videos are in scope. */
  video: VlmVideoOptions;
};

export const DEFAULT_VLM_OPTIONS: VlmOptions = {
  // Prompt notes:
  // - Example-based priming works better than negative instructions alone;
  //   VLMs are trained on markdown-heavy data and "please don't" loses.
  // - Strict rules go LAST because VLMs weight the end of the prompt more.
  // - Explicit word target + multiple "stop after N paragraphs" instructions
  //   are how we push back against the model's verbosity bias. The example
  //   is deliberately short (~80 words) to anchor the expected length.
  prompt: [
    'Write a training caption for this image. Describe the main subject, notable clothing or gear, pose or action, setting, art style, and overall composition. Include visible details that matter, but skip minor background filler and avoid repeating yourself.',
    '',
    'Keep it to 2–3 short paragraphs, around 100–160 words total. Format as plain prose like this example:',
    '',
    'A close-up portrait of a young man with spiked dark brown hair and bright green eyes, facing slightly left with a determined expression. He wears a brown sleeveless vest over a grey shirt, with a golden chest plate featuring a glowing cyan emblem, and an orange scarf wrapped loosely around his neck. A leather strap crosses his shoulder.',
    '',
    'Behind him, stylised blue-purple mountains rise under a clear sky streaked with thin clouds. Soft rim lighting catches the edge of his hair and armour. The illustration is in anime style with clean lines, bold saturated colours, and dramatic lighting that emphasises the subject.',
    '',
    'STRICT RULES — your response MUST follow these:',
    '- Maximum 3 short paragraphs. Do not add a fourth. Stop writing after the third paragraph.',
    '- Target 100–160 words total. Stay focused, do not pad.',
    '- No markdown, no **bold**, no *italics*, no bullet points, no lists, no # headings, no *, no -, no paragraph titles.',
    '- No speculation about mood, narrative, or backstory beyond what the pose and expression directly show.',
    '- Only plain prose describing what is visible. Then stop.',
  ].join('\n'),
  maxTokens: 550,
  temperature: 0.6,
  injectTriggerPhrases: true,
  triggerPhraseInsertMode: 'append',
  video: {
    frameBudget: 32,
    maxFps: 2.0,
    quality: 'standard',
  },
};

/**
 * Settings saved to project config.
 * Both ONNX and VLM fields are optional — a project tracks defaults for
 * whichever providers it's been used with.
 */
export type AutoTaggerSettings = {
  defaultModelId?: string;
} & Partial<Omit<TaggerOptions, 'includeTags'>> & // includeTags not saved (session only)
  Partial<VlmOptions>;
