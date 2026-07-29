import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

const SUMOPOD_DEFAULT_BASE_URL = 'https://ai.sumopod.com/v1';
const SUMOPOD_DEFAULT_MODEL = 'gpt-4o-mini';
const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-4-5';
const NINE_ROUTER_DEFAULT_BASE_URL = 'https://9router.finepro.my.id/v1';
const NINE_ROUTER_DEFAULT_MODEL = 'Combo-3-Subscription';

function hasApiKey(value, placeholder) {
  return Boolean(value && value !== placeholder);
}

export function resolveAiProvider(config = {}) {
  const provider = config.provider || 'sumopod';
  const sumopodReady = hasApiKey(config.sumopod_api_key, 'isi-sumopod-api-key');
  const anthropicReady = hasApiKey(config.anthropic_api_key, 'isi-anthropic-api-key');
  const nineRouterReady = hasApiKey(config['9router_api_key'], 'isi-9router-api-key');

  if (!config.enabled) return null;
  if (provider === 'anthropic' && anthropicReady) return 'anthropic';
  if (provider === 'sumopod' && sumopodReady) return 'sumopod';
  if (provider === '9router' && nineRouterReady) return '9router';

  // Backward-compatible fallback for installs with older provider settings.
  if (nineRouterReady) return '9router';
  if (sumopodReady) return 'sumopod';
  if (anthropicReady) return 'anthropic';
  return null;
}

export function isAiConfigured(config = {}) {
  return Boolean(resolveAiProvider(config));
}

export function aiConfigurationMessage(featureName = 'Fitur AI') {
  return `${featureName} belum dikonfigurasi. Isi 9Router API Key di Admin Console, atau pilih SumoPod/Anthropic sebagai alternatif.`;
}

function buildMessages(system, messages) {
  return [
    ...(system ? [{ role: 'system', content: system }] : []),
    ...messages,
  ];
}

async function generateOpenAiCompatible({ apiKey, baseURL, model, system, messages, maxTokens, temperature }) {
  const client = new OpenAI({ apiKey, baseURL });
  const response = await client.chat.completions.create({
    model,
    messages: buildMessages(system, messages),
    max_tokens: maxTokens,
    temperature,
  });
  return response.choices?.[0]?.message?.content?.trim() || '';
}

export async function generateChatText({
  config = {},
  system,
  messages = [],
  maxTokens = 500,
  temperature = 0.7,
  sumopodModel,
  anthropicModel,
  nineRouterModel,
}) {
  const provider = resolveAiProvider(config);
  if (!provider) {
    throw new Error(aiConfigurationMessage());
  }

  if (provider === 'sumopod') {
    return generateOpenAiCompatible({
      apiKey: config.sumopod_api_key,
      baseURL: config.sumopod_base_url || SUMOPOD_DEFAULT_BASE_URL,
      model: sumopodModel || config.sumopod_model || config.model || SUMOPOD_DEFAULT_MODEL,
      system,
      messages,
      maxTokens,
      temperature,
    });
  }

  if (provider === '9router') {
    return generateOpenAiCompatible({
      apiKey: config['9router_api_key'],
      baseURL: config['9router_base_url'] || NINE_ROUTER_DEFAULT_BASE_URL,
      model: nineRouterModel || config['9router_model'] || config.model || NINE_ROUTER_DEFAULT_MODEL,
      system,
      messages,
      maxTokens,
      temperature,
    });
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
  nineRouterBaseUrl: NINE_ROUTER_DEFAULT_BASE_URL,
  nineRouterModel: NINE_ROUTER_DEFAULT_MODEL,
};
