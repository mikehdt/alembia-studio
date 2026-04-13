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
};

export type ModelFile = {
  name: string;
  size: number;
};

type ModelStatus =
  | 'not_installed'
  | 'downloading'
  | 'ready'
  | 'error'
  | 'checking';

type DownloadProgress = {
  modelId: string;
  status: ModelStatus;
  currentFile?: string;
  bytesDownloaded: number;
  totalBytes: number;
  error?: string;
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
