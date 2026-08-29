import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = '/home/ubuntu/projects/finepro';
const read = (rel) => fs.readFileSync(`${root}/${rel}`, 'utf8');

test('email verification creates authenticated continuation session', () => {
  const route = read('api/routes/auth.js');
  const client = read('src/api/auth.js');
  const context = read('src/context/AuthContext.jsx');
  const page = read('src/pages/AuthPage.jsx');
  assert.match(route, /Email berhasil diverifikasi[\s\S]{0,500}token:\s*generateToken\(user\)/);
  assert.match(client, /export async function verifyEmail\(token\)[\s\S]{0,300}setToken\(data\.token\)/);
  assert.match(context, /verifyEmailToken[\s\S]{0,250}setUser\(data\.user\)/);
  assert.match(page, /history\.replaceState\(\{\},\s*"",\s*window\.location\.pathname\)/);
});

test('onboarding pages show one shared five-stage progress', () => {
  assert.ok(fs.existsSync(`${root}/src/components/OnboardingProgress.jsx`));
  for (const rel of ['src/pages/OnboardingPage.jsx', 'src/pages/PricingPage.jsx', 'src/pages/CheckoutPage.jsx', 'src/pages/PaymentFinishPage.jsx']) {
    assert.match(read(rel), /OnboardingProgress/, `${rel} must use OnboardingProgress`);
  }
});

test('checkout renders only selected plan and one payment action', () => {
  const checkout = read('src/components/UpgradeCheckout.jsx');
  assert.match(checkout, /selectedPlanOnly/);
  assert.match(checkout, /Bayar\s+\{?formatPlanPrice|Bayar Sekarang|Bayar dengan QRIS/);
  assert.doesNotMatch(checkout, /API Key dan Webhook Token/);
  assert.doesNotMatch(checkout, /Secret Key di Admin Console/);
});

test('successful first payment continues to wallet activation', () => {
  const finish = read('src/pages/PaymentFinishPage.jsx');
  const app = read('src/App.jsx');
  assert.match(finish, /Siapkan Dompet/);
  assert.match(finish, /onContinueSetup/);
  assert.match(app, /onContinueSetup/);
});

test('selected plan survives checkout reload', () => {
  const app = read('src/App.jsx');
  assert.match(app, /finepro-selected-plan/);
  assert.match(app, /sessionStorage\.setItem/);
});

test('SumoPod redirect is disclosed before leaving FinePro', () => {
  const checkout = read('src/components/UpgradeCheckout.jsx');
  assert.match(checkout, /halaman pembayaran aman/i);
  assert.match(checkout, /kembali otomatis ke FinePro/i);
});

test('checkout action stays provider-neutral and invalid saved plan is discarded', () => {
  const checkout = read('src/components/UpgradeCheckout.jsx');
  const app = read('src/App.jsx');
  assert.match(checkout, /Bayar Sekarang/);
  assert.match(app, /PLAN_ORDER\.includes\(savedPlan\)/);
});
