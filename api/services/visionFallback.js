// api/services/visionFallback.js
// Sprint 3 — Vision Model Fallback
//
// When OCR + regex + AI text extraction fails or has low confidence,
// send image directly to vision model (Claude Vision, GPT-4V, or similar).
//
// Supported providers:
// - Anthropic Claude (claude-3.5-sonnet with vision)
// - OpenAI GPT-4V (via SumoPod or direct)

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

const SUMOPOD_BASE_URL = 'https://ai.sumopod.com/v1';

// ── Main vision fallback ───────────────────────────────────────────

/**
 * Analyze receipt image using vision model.
 * Fallback when OCR/regex text extraction fails.
 *
 * @param {Buffer} imageBuffer
 * @param {object} config - AI provider config
 * @param {string} config.provider - 'anthropic' or 'sumopod'
 * @param {string} config.anthropic_api_key
 * @param {string} config.sumopod_api_key
 * @param {string} config.model - optional override
 * @param {object} context - additional context (wallets, categories, rules, etc)
 * @returns {object} {
 *   success: boolean,
 *   analysis: {
 *     transaction_type,
 *     amount,
 *     currency,
 *     merchant,
 *     category,
 *     description,
 *     transaction_date,
 *     source_wallet_name,
 *     destination_wallet_name,
 *   },
 *   raw_response: string,
 *   used_provider: string,
 *   model_used: string,
 * }
 */
export async function analyzeReceiptWithVision(imageBuffer, config = {}, context = {}) {
  const provider = config.provider || 'anthropic';

  if (provider === 'anthropic') {
    return analyzeWithClaude(imageBuffer, config, context);
  } else if (provider === 'sumopod') {
    return analyzeWithGPT4V(imageBuffer, config, context);
  } else {
    throw new Error(`Unsupported vision provider: ${provider}`);
  }
}

// ── Claude Vision ──────────────────────────────────────────────────

async function analyzeWithClaude(imageBuffer, config, context) {
  if (!config.anthropic_api_key) {
    throw new Error('Anthropic API key not configured');
  }

  const client = new Anthropic({
    apiKey: config.anthropic_api_key,
  });

  const base64Image = imageBuffer.toString('base64');

  const systemPrompt = buildSystemPrompt(context);
  const userPrompt = buildUserPrompt(context);

  try {
    const response = await client.messages.create({
      model: config.model || 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    const rawResponse = textContent?.text || '';

    // Parse response
    const analysis = parseVisionResponse(rawResponse);

    return {
      success: !!analysis,
      analysis: analysis || {},
      raw_response: rawResponse,
      used_provider: 'anthropic',
      model_used: config.model || 'claude-3-5-sonnet-20241022',
    };
  } catch (error) {
    console.error('Claude vision error:', error);
    return {
      success: false,
      analysis: {},
      raw_response: '',
      used_provider: 'anthropic',
      error: error.message,
    };
  }
}

// ── GPT-4V Vision ──────────────────────────────────────────────────

async function analyzeWithGPT4V(imageBuffer, config, context) {
  if (!config.sumopod_api_key) {
    throw new Error('SumoPod API key not configured');
  }

  const client = new OpenAI({
    apiKey: config.sumopod_api_key,
    baseURL: SUMOPOD_BASE_URL,
  });

  const base64Image = imageBuffer.toString('base64');

  const userPrompt = buildUserPrompt(context);

  try {
    const response = await client.chat.completions.create({
      model: config.model || 'gpt-4-vision',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
              },
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
    });

    const rawResponse = response.choices?.[0]?.message?.content || '';

    // Parse response
    const analysis = parseVisionResponse(rawResponse);

    return {
      success: !!analysis,
      analysis: analysis || {},
      raw_response: rawResponse,
      used_provider: 'sumopod/gpt-4v',
      model_used: config.model || 'gpt-4-vision',
    };
  } catch (error) {
    console.error('GPT-4V vision error:', error);
    return {
      success: false,
      analysis: {},
      raw_response: '',
      used_provider: 'sumopod/gpt-4v',
      error: error.message,
    };
  }
}

// ── Prompt Building ────────────────────────────────────────────────

function buildSystemPrompt(context = {}) {
  return `Anda adalah ahli ekstraksi data dari struk/kwitansi transaksi.
Tugas: ekstrak informasi transaksi dari gambar struk dengan akurat.

Kembalikan JSON dengan field:
{
  "transaction_type": "expense|income|transfer",
  "amount": number (nilai transaksi),
  "currency": "IDR|USD|...",
  "merchant": string (nama toko/ATM),
  "category": string (kategori transaksi),
  "subcategory": string (sub-kategori, jika ada),
  "description": string (deskripsi tambahan),
  "transaction_date": "YYYY-MM-DD",
  "source_wallet_name": string (dari mana uang diambil),
  "destination_wallet_name": string (kemana uang dikirim),
  "reference_number": string (nomor referensi/invoice),
  "confidence": object {
    "amount": 0-1,
    "merchant": 0-1,
    "category": 0-1,
    "transaction_date": 0-1
  }
}

Instruksi:
- Ekstrak HANYA informasi yang terlihat jelas di struk
- Jika tidak yakin, set confidence rendah (0.3-0.5)
- Jika tidak ada field, gunakan null
- Format date sebagai YYYY-MM-DD
- Untuk amount, hanya angka (tanpa simbol)`;
}

function buildUserPrompt(context = {}) {
  let prompt = 'Ekstrak informasi transaksi dari struk ini:\n\n';

  if (context.wallets && context.wallets.length > 0) {
    const walletNames = context.wallets.map((w) => w.name).join(', ');
    prompt += `Daftar wallet pengguna: ${walletNames}\n`;
  }

  if (context.categories && context.categories.length > 0) {
    const categoryNames = context.categories.map((c) => c.name).join(', ');
    prompt += `Daftar kategori yang tersedia: ${categoryNames}\n`;
  }

  if (context.recentMerchants && context.recentMerchants.length > 0) {
    const merchants = context.recentMerchants.join(', ');
    prompt += `Merchant terakhir yang sering: ${merchants}\n`;
  }

  prompt += '\nKembalikan hasil sebagai JSON object.';

  return prompt;
}

// ── Response Parsing ───────────────────────────────────────────────

/**
 * Parse vision model response into structured analysis.
 */
function parseVisionResponse(responseText) {
  try {
    // Try to extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    // Normalize fields
    return {
      transaction_type: parsed.transaction_type || 'expense',
      amount: parseFloat(parsed.amount) || 0,
      currency: parsed.currency || 'IDR',
      merchant: parsed.merchant || '',
      category: parsed.category || '',
      subcategory: parsed.subcategory || null,
      description: parsed.description || '',
      transaction_date: parsed.transaction_date || '',
      source_wallet_name: parsed.source_wallet_name || '',
      destination_wallet_name: parsed.destination_wallet_name || '',
      reference_number: parsed.reference_number || '',
      confidence: parsed.confidence || {
        amount: 0.7,
        merchant: 0.7,
        category: 0.6,
        transaction_date: 0.7,
      },
    };
  } catch (e) {
    console.error('Vision response parse error:', e);
    return null;
  }
}

/**
 * Check if vision model result is usable.
 */
export function isVisionResultUsable(analysis, minConfidence = 0.6) {
  if (!analysis) return false;

  const requiredFields = ['transaction_type', 'amount', 'merchant'];
  const hasRequired = requiredFields.every((f) => analysis[f]);

  if (!hasRequired) return false;

  // Check if confidence is above threshold
  const { confidence } = analysis;
  if (!confidence) return false;

  const scores = Object.values(confidence).filter((v) => typeof v === 'number');
  const avgConfidence = scores.length > 0 ? scores.reduce((a, b) => a + b) / scores.length : 0;

  return avgConfidence >= minConfidence;
}
