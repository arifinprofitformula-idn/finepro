const provider = (id, name, category, aliases = []) => ({ id, name, category, aliases });

export const WALLET_PROVIDERS = [
  provider('cash', 'Tunai', 'cash', ['uang tunai', 'cash', 'kas']),
  provider('bca', 'BCA', 'bank', ['bank central asia']),
  provider('bri', 'BRI', 'bank', ['bank rakyat indonesia']),
  provider('mandiri', 'Mandiri', 'bank', ['bank mandiri']),
  provider('bni', 'BNI', 'bank', ['bank negara indonesia']),
  provider('bsi', 'BSI', 'bank', ['bank syariah indonesia']),
  provider('cimb-niaga', 'CIMB Niaga', 'bank', ['cimb']),
  provider('bank-jago', 'Bank Jago', 'bank', ['jago']),
  provider('seabank', 'SeaBank', 'bank', ['sea bank']),
  provider('permata', 'PermataBank', 'bank', ['permata bank']),
  provider('danamon', 'Danamon', 'bank', ['bank danamon']),
  provider('btn', 'BTN', 'bank', ['bank tabungan negara']),
  provider('maybank', 'Maybank', 'bank', ['bank maybank']),
  provider('ocbc', 'OCBC', 'bank', ['ocbc nisp']),
  provider('panin', 'PaninBank', 'bank', ['panin bank']),
  provider('blu', 'blu by BCA Digital', 'bank', ['blu', 'bca digital']),
  provider('neobank', 'Bank Neo Commerce', 'bank', ['neo bank', 'neobank', 'bnc']),
  provider('gopay', 'GoPay', 'ewallet', ['go pay', 'gojek']),
  provider('dana', 'DANA', 'ewallet', ['dana indonesia']),
  provider('ovo', 'OVO', 'ewallet'),
  provider('shopeepay', 'ShopeePay', 'ewallet', ['shopee pay', 'shopee']),
  provider('linkaja', 'LinkAja', 'ewallet', ['link aja']),
  provider('isaku', 'i.saku', 'ewallet', ['isaku']),
  provider('sakuku', 'Sakuku', 'ewallet'),
];

export const QUICK_PROVIDER_IDS = ['cash', 'bca', 'bri', 'mandiri', 'gopay', 'dana', 'ovo', 'shopeepay'];

export const PROVIDER_CATEGORY_LABELS = {
  cash: 'Dompet umum',
  bank: 'Bank',
  ewallet: 'Dompet digital',
  custom: 'Provider lainnya',
};

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('id-ID')
    .trim();
}

export function searchWalletProviders(query = '') {
  const clean = String(query || '').trim().slice(0, 80);
  const term = normalize(clean);
  const matches = term
    ? WALLET_PROVIDERS.filter((item) => normalize([item.name, ...item.aliases].join(' ')).includes(term))
    : WALLET_PROVIDERS;
  const exact = WALLET_PROVIDERS.some((item) => normalize(item.name) === term);
  return clean && !exact
    ? [...matches, { id: `custom:${term}`, name: clean, category: 'custom', aliases: [], custom: true }]
    : matches;
}

export function quickWalletProviders() {
  const byId = new Map(WALLET_PROVIDERS.map((item) => [item.id, item]));
  return QUICK_PROVIDER_IDS.map((id) => byId.get(id)).filter(Boolean);
}
