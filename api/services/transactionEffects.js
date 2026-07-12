import pool from '../db.js';
import { crossedThreshold, notifyHousehold } from '../lib/webpush.js';

export async function checkBudgetThreshold(householdId, category, date, newAmount) {
  const now = new Date();
  const txDate = new Date(date + 'T00:00:00');
  if (txDate.getFullYear() !== now.getFullYear() || txDate.getMonth() !== now.getMonth()) return;

  const budgetResult = await pool.query(
    'SELECT amount FROM budgets WHERE household_id = $1 AND category = $2',
    [householdId, category]
  );
  const budget = parseFloat(budgetResult.rows[0]?.amount || 0);
  if (budget <= 0) return;

  const spentResult = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as spent FROM transactions
     WHERE household_id = $1 AND category = $2 AND type = 'expense'
       AND EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE)`,
    [householdId, category]
  );
  const spentAfter = parseFloat(spentResult.rows[0].spent);
  const spentBefore = spentAfter - newAmount;

  const pctBefore = (spentBefore / budget) * 100;
  const pctAfter = (spentAfter / budget) * 100;
  const threshold = crossedThreshold(pctBefore, pctAfter);
  if (!threshold) return;

  const title = threshold >= 100 ? `Budget "${category}" terlampaui` : `Budget "${category}" hampir habis`;
  const body = threshold >= 100
    ? 'Pengeluaran kategori ini sudah melewati budget bulan ini.'
    : `Pengeluaran kategori ini sudah mencapai ${threshold}% dari budget bulan ini.`;

  await notifyHousehold(householdId, { title, body });
}
