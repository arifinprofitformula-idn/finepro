import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const moduleUrl = new URL('../src/data/walletProviders.js', import.meta.url);

test('catalog exposes bank, e-wallet, cash, and ordered quick choices', async () => {
  const { WALLET_PROVIDERS, QUICK_PROVIDER_IDS } = await import(moduleUrl);
  assert.deepEqual(QUICK_PROVIDER_IDS.slice(0, 6), ['cash', 'bca', 'bri', 'mandiri', 'gopay', 'dana']);
  assert.ok(WALLET_PROVIDERS.some((item) => item.category === 'bank'));
  assert.ok(WALLET_PROVIDERS.some((item) => item.category === 'ewallet'));
  assert.ok(WALLET_PROVIDERS.some((item) => item.category === 'cash'));
});

test('search supports aliases and returns a custom provider when missing', async () => {
  const { searchWalletProviders } = await import(moduleUrl);
  assert.equal(searchWalletProviders('bank central')[0].name, 'BCA');
  assert.equal(searchWalletProviders('shopee')[0].name, 'ShopeePay');
  const custom = searchWalletProviders('Allo Bank');
  assert.equal(custom.at(-1).custom, true);
  assert.equal(custom.at(-1).name, 'Allo Bank');
});

test('activation UI keeps provider selection separate from editable wallet name', async () => {
  const source = await readFile(new URL('../src/components/ActivationWizard.jsx', import.meta.url), 'utf8');
  assert.match(source, /Combobox/);
  assert.match(source, /activation-provider-search/);
  assert.match(source, /Tambahkan provider/);
  assert.match(source, /activation-wallet-name/);
  assert.match(source, /Nama dompet/);
  assert.match(source, /createOpeningWallet\(\{name:name\.trim\(\),actual_balance:amount/);
});
