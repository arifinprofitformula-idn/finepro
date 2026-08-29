import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const adminPage = fs.readFileSync(new URL('../../src/pages/AdminPage.jsx', import.meta.url), 'utf8');
const adminRoute = fs.readFileSync(new URL('../routes/admin.js', import.meta.url), 'utf8');

test('AdminPage imports QrCode before rendering SumoPod method', () => {
  const lucideImport = adminPage.match(/import\s*\{([\s\S]*?)\}\s*from\s*["']lucide-react["'];/)?.[1] || '';
  assert.match(adminPage, /icon:\s*QrCode/);
  assert.match(lucideImport, /\bQrCode\b/);
});

test('admin request handlers do not run schema DDL at runtime', () => {
  assert.doesNotMatch(adminRoute, /ensureBusinessExpensesTable/);
  assert.doesNotMatch(adminRoute, /CREATE\s+(?:TABLE|INDEX)/i);
});
