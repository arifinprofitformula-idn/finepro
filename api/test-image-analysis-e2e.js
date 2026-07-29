// Test E2E: image → analyzeTransactionImage → draft + transaction tersimpan di DB
// Jalankan: node test-image-analysis-e2e.js
import fs from 'fs';
import path from 'path';
import pool from './db.js';
import { analyzeTransactionImage } from './services/transactionImageAnalysisService.js';

const TEST_USER_ID = 'test-user-e2e-' + Date.now();
let TEST_HOUSEHOLD_ID = null;

async function setupTestHousehold() {
  const hh = await pool.query(
    `SELECT id FROM households LIMIT 1`
  );
  if (hh.rows.length === 0) {
    const created = await pool.query(
      `INSERT INTO households (type, name) VALUES ($1, $2) RETURNING id`,
      ['individual', 'Test Household E2E']
    );
    TEST_HOUSEHOLD_ID = created.rows[0].id;
  } else {
    TEST_HOUSEHOLD_ID = hh.rows[0].id;
  }
  console.log('✓ Test household:', TEST_HOUSEHOLD_ID);
}

async function ensureDefaultWalletAndCategory() {
  const wallets = await pool.query(
    `SELECT id FROM wallets WHERE household_id = $1 LIMIT 1`,
    [TEST_HOUSEHOLD_ID]
  );
  if (wallets.rows.length === 0) {
    const w = await pool.query(
      `INSERT INTO wallets (household_id, name, type, is_default) 
       VALUES ($1, $2, $3, true) RETURNING id`,
      [TEST_HOUSEHOLD_ID, 'Tunai', 'cash']
    );
    console.log('✓ Created default wallet:', w.rows[0].id);
  }

  const cats = await pool.query(
    `SELECT id FROM categories WHERE household_id = $1 AND type = 'expense' LIMIT 1`,
    [TEST_HOUSEHOLD_ID]
  );
  if (cats.rows.length === 0) {
    const c = await pool.query(
      `INSERT INTO categories (household_id, type, name, is_default) 
       VALUES ($1, $2, $3, true) RETURNING id`,
      [TEST_HOUSEHOLD_ID, 'expense', 'Kebutuhan Pokok']
    );
    console.log('✓ Created default expense category:', c.rows[0].id);
  }

  const catIncome = await pool.query(
    `SELECT id FROM categories WHERE household_id = $1 AND type = 'income' LIMIT 1`,
    [TEST_HOUSEHOLD_ID]
  );
  if (catIncome.rows.length === 0) {
    const ci = await pool.query(
      `INSERT INTO categories (household_id, type, name, is_default) 
       VALUES ($1, $2, $3, true) RETURNING id`,
      [TEST_HOUSEHOLD_ID, 'income', 'Lainnya']
    );
    console.log('✓ Created default income category:', ci.rows[0].id);
  }
}

async function testImageAnalysis(imagePath, label) {
  console.log(`\n📸 Testing: ${label}`);
  console.log(`   File: ${imagePath}`);

  const imageBuffer = fs.readFileSync(imagePath);
  console.log(`   Size: ${imageBuffer.length} bytes`);

  try {
    const result = await analyzeTransactionImage({
      imageBuffer,
      mimeType: 'image/png',
      userId: TEST_USER_ID,
      householdId: TEST_HOUSEHOLD_ID,
      channel: 'test-e2e',
    });

    console.log(`   ✓ Analysis complete`);
    console.log(`   - Draft ID: ${result.draft_id}`);
    console.log(`   - Type: ${result.transaction_type}`);
    console.log(`   - Amount: Rp ${result.amount}`);
    console.log(`   - Category: ${result.category || '(none)'}`);
    console.log(`   - Wallet: ${result.source_wallet_name || result.destination_wallet_name || '(none)'}`);
    console.log(`   - Overall confidence: ${(result.overall_confidence * 100).toFixed(0)}%`);
    console.log(`   - Needs confirmation: ${result.needs_confirmation}`);

    // Verify in DB
    const draftCheck = await pool.query(
      `SELECT id, status, analysis FROM transaction_analysis_drafts WHERE id = $1`,
      [result.draft_id]
    );
    if (draftCheck.rows.length > 0) {
      console.log(`   ✓ DRAFT FOUND in DB (status: ${draftCheck.rows[0].status})`);
      const analysis = typeof draftCheck.rows[0].analysis === 'string'
        ? JSON.parse(draftCheck.rows[0].analysis)
        : draftCheck.rows[0].analysis;
      console.log(`     - Amount in draft: Rp ${analysis.amount}`);
    } else {
      console.log(`   ✗ DRAFT NOT FOUND in DB!`);
    }

    // If no confirmation needed, should be auto-confirmed as transaction
    if (!result.needs_confirmation && result.overall_confidence >= 0.75) {
      console.log(`   → Should auto-confirm as transaction (confidence ${(result.overall_confidence * 100).toFixed(0)}%)`);
    }

    return result;
  } catch (error) {
    console.error(`   ✗ ERROR: ${error.message}`);
    if (error.stack) console.error(error.stack);
    return null;
  }
}

async function run() {
  try {
    console.log('=== E2E Image Analysis Test ===\n');

    await setupTestHousehold();
    await ensureDefaultWalletAndCategory();

    const results = [];

    // Test 1: Expense receipt
    const expense = await testImageAnalysis('/tmp/struk_expense.png', 'Struk Belanja Tunai (Expense)');
    if (expense) results.push(expense);

    // Test 2: Income transfer
    const income = await testImageAnalysis('/tmp/transfer_income.png', 'Bukti Transfer Bank (Income)');
    if (income) results.push(income);

    console.log(`\n=== Summary ===`);
    console.log(`Tests run: ${results.length}`);
    results.forEach((r, i) => {
      console.log(`${i + 1}. ${r.transaction_type.toUpperCase()} - Rp ${r.amount} - Confidence: ${(r.overall_confidence * 100).toFixed(0)}%`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

run();
