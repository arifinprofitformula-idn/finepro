// api/services/financialStats.js
// Menghitung agregat keuangan household secara MURNI SQL/JS (tidak memanggil AI).
// Hasilnya jadi satu-satunya "kebenaran angka" yang dikirim ke Claude di
// routes/ai-insights.js — AI hanya boleh menarasikan angka ini, tidak boleh
// mengarang data lain.

import pool from '../db.js';

export async function computeFinancialStats(householdId) {
  const monthsResult = await pool.query(
    `SELECT COUNT(DISTINCT to_char(date_trunc('month', date), 'YYYY-MM')) as count
     FROM transactions WHERE household_id = $1`,
    [householdId]
  );
  const monthsWithData = Number(monthsResult.rows[0].count);

  if (monthsWithData < 2) {
    return { insufficientData: true, monthsWithData };
  }

  const trendResult = await pool.query(
    `SELECT to_char(date_trunc('month', date), 'YYYY-MM') as month, type, category, SUM(amount) as total
     FROM transactions
     WHERE household_id = $1 AND date >= (CURRENT_DATE - INTERVAL '3 months')
     GROUP BY 1, 2, 3
     ORDER BY 1`,
    [householdId]
  );

  const budgetResult = await pool.query(
    `SELECT b.category, c.system_key, b.amount as budget,
       COALESCE((
         SELECT SUM(t.amount) FROM transactions t
         WHERE t.household_id = $1 AND t.type = 'expense' AND t.category = b.category
           AND EXTRACT(MONTH FROM t.date) = EXTRACT(MONTH FROM CURRENT_DATE)
           AND EXTRACT(YEAR FROM t.date) = EXTRACT(YEAR FROM CURRENT_DATE)
       ), 0) as spent
     FROM budgets b
     LEFT JOIN categories c
       ON c.household_id = b.household_id
      AND c.type = 'expense'
      AND c.name = b.category
     WHERE b.household_id = $1`,
    [householdId]
  );
  const overBudgetCategories = budgetResult.rows
    .filter((r) => Number(r.budget) > 0 && Number(r.spent) > Number(r.budget))
    .map((r) => ({ category: r.category, system_key: r.system_key, budget: Number(r.budget), spent: Number(r.spent) }));

  const currentMonthExpenseResult = await pool.query(
    `SELECT
       COALESCE(SUM(t.amount), 0) as total_expense,
       COALESCE(SUM(CASE
         WHEN c.system_key = 'zakat_sedekah'
           OR t.category IN ('Zakat & Sedekah', 'Ibadah & Sedekah')
         THEN t.amount ELSE 0 END), 0) as giving_expense
     FROM transactions t
     LEFT JOIN categories c
       ON c.household_id = t.household_id
      AND c.type = t.type
      AND c.name = t.category
     WHERE t.household_id = $1
       AND t.type = 'expense'
       AND EXTRACT(MONTH FROM t.date) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(YEAR FROM t.date) = EXTRACT(YEAR FROM CURRENT_DATE)`,
    [householdId]
  );
  const totalExpenseThisMonth = Number(currentMonthExpenseResult.rows[0]?.total_expense || 0);
  const givingExpenseThisMonth = Number(currentMonthExpenseResult.rows[0]?.giving_expense || 0);

  const savingsResult = await pool.query(
    `SELECT to_char(date_trunc('month', date), 'YYYY-MM') as month,
       SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
       SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
     FROM transactions
     WHERE household_id = $1 AND date >= (CURRENT_DATE - INTERVAL '2 months')
     GROUP BY 1
     ORDER BY 1 DESC
     LIMIT 2`,
    [householdId]
  );
  const savingsRatioOf = (row) => {
    if (!row) return null;
    const income = Number(row.income);
    const expense = Number(row.expense);
    return income > 0 ? Number((((income - expense) / income) * 100).toFixed(1)) : null;
  };
  const savingsRatio = {
    thisMonth: savingsRatioOf(savingsResult.rows[0]),
    lastMonth: savingsRatioOf(savingsResult.rows[1])
  };

  const zakatResult = await pool.query(
    `SELECT to_char(date_trunc('month', date), 'YYYY-MM') as month
     FROM transactions t
     LEFT JOIN categories c
       ON c.household_id = t.household_id
      AND c.type = t.type
      AND c.name = t.category
     WHERE t.household_id = $1
       AND t.type = 'expense'
       AND (
         c.system_key = 'zakat_sedekah'
         OR t.category IN ('Zakat & Sedekah', 'Ibadah & Sedekah')
       )
     GROUP BY 1
     ORDER BY 1 DESC`,
    [householdId]
  );
  const zakatMonths = new Set(zakatResult.rows.map((r) => r.month));
  let zakatStreakMonths = 0;
  const cursor = new Date();
  while (true) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    if (!zakatMonths.has(key)) break;
    zakatStreakMonths += 1;
    cursor.setMonth(cursor.getMonth() - 1);
  }

  const billsResult = await pool.query(
    `SELECT name, amount, to_char(due_date, 'YYYY-MM-DD') as due_date
     FROM bills
     WHERE household_id = $1 AND paid_at IS NULL AND due_date <= CURRENT_DATE + INTERVAL '7 days'
     ORDER BY due_date`,
    [householdId]
  );

  const walletsResult = await pool.query(
    `SELECT w.name,
       COALESCE((
         SELECT SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END)
         FROM transactions t WHERE t.wallet_id = w.id
       ), 0)
       + COALESCE((SELECT SUM(amount) FROM wallet_transfers WHERE to_wallet_id = w.id), 0)
       - COALESCE((SELECT SUM(amount) FROM wallet_transfers WHERE from_wallet_id = w.id), 0)
       as balance
     FROM wallets w WHERE w.household_id = $1`,
    [householdId]
  );

  return {
    insufficientData: false,
    monthsWithData,
    trend3Months: trendResult.rows.map((r) => ({
      month: r.month,
      type: r.type,
      category: r.category,
      total: Number(r.total)
    })),
    overBudgetCategories,
    expenseBreakdownThisMonth: {
      totalExpense: totalExpenseThisMonth,
      givingExpense: givingExpenseThisMonth,
      operationalExpense: totalExpenseThisMonth - givingExpenseThisMonth,
      givingSystemKey: 'zakat_sedekah'
    },
    savingsRatioPercent: savingsRatio,
    zakatStreakMonths,
    upcomingBills: billsResult.rows.map((r) => ({
      name: r.name,
      amount: Number(r.amount),
      due_date: r.due_date
    })),
    walletBalances: walletsResult.rows.map((r) => ({ name: r.name, balance: Number(r.balance) }))
  };
}
