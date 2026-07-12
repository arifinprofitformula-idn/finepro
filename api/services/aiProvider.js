import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

const SUMOPOD_DEFAULT_BASE_URL = 'https://ai.sumopod.com/v1';
const SUMOPOD_DEFAULT_MODEL = 'gpt-4o-mini';
const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-4-5';

function hasApiKey(value, placeholder) {
  return Boolean(value && value !== placeholder);
}

export function resolveAiProvider(config = {}) {
  const provider = config.provider || 'sumopod';
  const sumopodReady = hasApiKey(config.sumopod_api_key, 'isi-sumopod-api-key');
  const anthropicReady = hasApiKey(config.anthropic_api_key, 'isi-anthropic-api-key');

  if (!config.enabled) return null;
  if (provider === 'anthropic' && anthropicReady) return 'anthropic';
  if (provider === 'sumopod' && sumopodReady) return 'sumopod';

  // Backward-compatible fallback for installs that already configured Anthropic
  // before SumoPod became the default provider.
  if (sumopodReady) return 'sumopod';
  if (anthropicReady) return 'anthropic';
  return null;
}

export function isAiConfigured(config = {}) {
  return Boolean(resolveAiProvider(config));
}

export function aiConfigurationMessage(featureName = 'Fitur AI') {
  return `${featureName} belum dikonfigurasi. Isi SumoPod API Key di Admin Console, atau pilih Anthropic sebagai alternatif.`;
}

export async function generateChatText({
  config = {},
  system,
  messages = [],
  maxTokens = 500,
  temperature = 0.7,
  sumopodModel,
  anthropicModel,
}) {
  const provider = resolveAiProvider(config);
  if (!provider) {
    throw new Error(aiConfigurationMessage());
  }

  if (provider === 'sumopod') {
    const client = new OpenAI({
      apiKey: config.sumopod_api_key,
      baseURL: config.sumopod_base_url || SUMOPOD_DEFAULT_BASE_URL,
    });
    const response = await client.chat.completions.create({
      model: sumopodModel || config.sumopod_model || config.model || SUMOPOD_DEFAULT_MODEL,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...messages,
      ],
      max_tokens: maxTokens,
      temperature,
    });
    return response.choices?.[0]?.message?.content?.trim() || '';
  }

  const anthropic = new Anthropic({ apiKey: config.anthropic_api_key });
  const message = await anthropic.messages.create({
    model: anthropicModel || config.anthropic_model || config.model || ANTHROPIC_DEFAULT_MODEL,
    max_tokens: maxTokens,
    temperature,
    ...(system ? { system } : {}),
    messages,
  });
  const textBlock = message.content.find((b) => b.type === 'text');
  return textBlock?.text?.trim() || '';
}

export const AI_PROVIDER_DEFAULTS = {
  sumopodBaseUrl: SUMOPOD_DEFAULT_BASE_URL,
  sumopodModel: SUMOPOD_DEFAULT_MODEL,
  anthropicModel: ANTHROPIC_DEFAULT_MODEL,
};
