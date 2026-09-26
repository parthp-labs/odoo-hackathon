// Provider factory — build the yolo-auto OpenAI-compatible LanguageModel.
//
// yolo-auto exposes an OpenAI-compatible chat API, so we wrap it through
// createOpenAICompatible (from @ai-sdk/openai-compatible) under the custom
// provider name 'yolo'. Every value can be overridden for tests/CLI, falling
// back to environment variables read directly from process.env (the backend
// has no shared src/config/env.js, so the env lookup lives here).
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const ENV_DEFAULTS = {
  yoloBaseUrl: 'https://yolo-auto.com/v1',
  yoloApiKey: '',
  model: 'qwen3.8-27b',
};

/**
 * Return an AI SDK LanguageModel wired to the yolo-auto OpenAI-compatible
 * endpoint.
 *
 * @param {object} [overrides]
 * @param {string} [overrides.baseURL]  Default: process.env.YOLO_BASE_URL or 'https://yolo-auto.com/v1'.
 * @param {string} [overrides.apiKey]   Default: process.env.YOLO_API_KEY.
 * @param {string} [overrides.model]    Default: process.env.AGENT_MODEL or 'qwen3.8-27b'.
 * @returns {import('@ai-sdk/provider').LanguageModelV1}
 */
export function makeModel(overrides = {}) {
  const baseURL =
    overrides.baseURL || process.env.YOLO_BASE_URL || ENV_DEFAULTS.yoloBaseUrl;
  const apiKey = overrides.apiKey || process.env.YOLO_API_KEY || ENV_DEFAULTS.yoloApiKey;
  const modelId = overrides.model || process.env.AGENT_MODEL || ENV_DEFAULTS.model;

  const provider = createOpenAICompatible({ name: 'yolo', baseURL, apiKey });
  return provider(modelId);
}