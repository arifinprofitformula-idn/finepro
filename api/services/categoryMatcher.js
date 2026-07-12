import pool from '../db.js';

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' dan ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function preferredCategoryHints(type, text) {
  if (type === 'income') {
    if (/\b(gaji|salary|upah|usaha|bisnis)\b/.test(text)) return ['gaji', 'usaha'];
    if (/\b(beasiswa)\b/.test(text)) return ['beasiswa'];
    if (/\b(freelance|part time|parttime|kerja)\b/.test(text)) return ['freelance', 'part', 'kerja'];
    if (/\b(transfer|dana masuk|masuk|refund)\b/.test(text)) return ['lainnya', 'transfer'];
    return ['lainnya'];
  }

  if (/\b(makan|minum|food|resto|warung|cafe|kopi|dapur)\b/.test(text)) {
    return ['uang makan', 'kebutuhan pokok', 'rumah tangga'];
  }
  if (/\b(transport|ojol|gojek|grab|bensin|parkir|tol|motor|mobil)\b/.test(text)) {
    return ['transportasi'];
  }
  if (/\b(kuota|internet|pulsa|wifi|data)\b/.test(text)) {
    return ['kuota', 'internet'];
  }
  if (/\b(kesehatan|obat|dokter|apotek|klinik)\b/.test(text)) {
    return ['kesehatan'];
  }
  if (/\b(sekolah|kuliah|buku|pendidikan)\b/.test(text)) {
    return ['pendidikan', 'kuliah', 'buku'];
  }
  if (/\b(zakat|sedekah|infaq|infak|donasi)\b/.test(text)) {
    return ['zakat', 'sedekah'];
  }
  if (/\b(hiburan|nonton|game|nongkrong)\b/.test(text)) {
    return ['hiburan', 'nongkrong'];
  }
  if (/\b(tabungan|investasi|saham|reksa|emas)\b/.test(text)) {
    return ['tabungan', 'investasi'];
  }
  return ['lainnya'];
}

function scoreCategory(inputText, categoryName) {
  const input = normalizeText(inputText);
  const category = normalizeText(categoryName);
  if (!input || !category) return 0;
  if (input === category) return 100;
  if (input.includes(category) || category.includes(input)) return 80;

  const inputTokens = new Set(input.split(' ').filter((t) => t.length > 2));
  const categoryTokens = category.split(' ').filter((t) => t.length > 2);
  if (categoryTokens.length === 0) return 0;
  const hits = categoryTokens.filter((token) => inputTokens.has(token)).length;
  return hits > 0 ? Math.round((hits / categoryTokens.length) * 60) : 0;
}

export async function normalizeTransactionCategory(householdId, type, suggestedCategory) {
  const finalType = type === 'income' ? 'income' : 'expense';
  const result = await pool.query(
    `SELECT name, sort_order, is_default
     FROM categories
     WHERE household_id = $1 AND type = $2
     ORDER BY is_default DESC, sort_order ASC, name ASC`,
    [householdId, finalType]
  );

  const categories = result.rows.map((row) => row.name);
  if (categories.length === 0) {
    return suggestedCategory || (finalType === 'income' ? 'Lainnya' : 'Lainnya');
  }

  const suggested = normalizeText(suggestedCategory);
  if (suggested) {
    const ranked = categories
      .map((name) => ({ name, score: scoreCategory(suggested, name) }))
      .sort((a, b) => b.score - a.score);
    if (ranked[0]?.score >= 45) return ranked[0].name;
  }

  const hints = preferredCategoryHints(finalType, suggested);
  for (const hint of hints) {
    const match = categories.find((name) => normalizeText(name).includes(hint));
    if (match) return match;
  }

  return categories.find((name) => normalizeText(name) === 'lainnya') || categories[0];
}
