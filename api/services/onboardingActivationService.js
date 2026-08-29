import pool from '../db.js';

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    const error = new Error('Saldo awal tidak valid');
    error.code = 'INVALID_OPENING_BALANCE';
    throw error;
  }
  return Number(n.toFixed(2));
}

function mapStatus(row) {
  const activationRequired = Boolean(row.activation_required);
  const walletReady = Boolean(row.wallet_setup_completed_at);
  return {
    household_id: row.household_id,
    role: row.role,
    activation_required: activationRequired,
    wallet_setup_completed: walletReady,
    transaction_ready: !activationRequired || walletReady,
    dashboard_tour_completed: Boolean(row.dashboard_tour_completed_at),
    current_step: row.current_step || (walletReady ? 'dashboard_tour' : 'wallet_setup'),
    onboarding_version: Number(row.onboarding_version || 1),
  };
}

export async function getOnboardingStatus(userId, queryable = pool) {
  const result = await queryable.query(
    `SELECT hm.household_id, hm.role,
            COALESCE(ho.activation_required, false) activation_required,
            ho.wallet_setup_completed_at,
            uop.dashboard_tour_completed_at, uop.current_step,
            COALESCE(uop.onboarding_version, 1) onboarding_version
     FROM household_members hm
     LEFT JOIN household_onboarding ho ON ho.household_id=hm.household_id
     LEFT JOIN user_onboarding_progress uop
       ON uop.household_id=hm.household_id AND uop.user_id=hm.user_id
     WHERE hm.user_id=$1 LIMIT 1`,
    [userId]
  );
  if (!result.rowCount) return null;
  return mapStatus(result.rows[0]);
}

export async function assertTransactionReady(householdId, queryable = pool) {
  const result = await queryable.query(
    `SELECT COALESCE(activation_required,false) activation_required, wallet_setup_completed_at
     FROM household_onboarding WHERE household_id=$1`,
    [householdId]
  );
  const row = result.rows[0];
  if (row?.activation_required && !row.wallet_setup_completed_at) {
    const error = new Error('Pemilik household perlu membuat dompet dan menetapkan saldo awal sebelum transaksi pertama');
    error.code = 'HOUSEHOLD_SETUP_REQUIRED';
    throw error;
  }
  return true;
}

export async function createOpeningWallet({ householdId, userId, name, actualBalance, idempotencyKey }) {
  if (!idempotencyKey) throw new Error('Idempotency key wajib diisi');
  const cleanName = String(name || '').trim();
  if (!cleanName) throw new Error('Nama dompet wajib diisi');
  const target = money(actualBalance);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const membership = await client.query(
      `SELECT role FROM household_members WHERE household_id=$1 AND user_id=$2 FOR UPDATE`,
      [householdId, userId]
    );
    if (membership.rows[0]?.role !== 'owner') {
      const error = new Error('Hanya pemilik household yang dapat menetapkan saldo awal');
      error.code = 'ONBOARDING_OWNER_REQUIRED';
      throw error;
    }
    const existing = await client.query(
      `SELECT wr.id reconciliation_id, w.id wallet_id, w.name, wr.actual_balance
       FROM wallet_reconciliations wr JOIN wallets w ON w.id=wr.wallet_id
       WHERE wr.household_id=$1 AND wr.idempotency_key=$2`,
      [householdId, idempotencyKey]
    );
    if (existing.rowCount) {
      await client.query('COMMIT');
      const row=existing.rows[0];
      return { wallet:{ id:row.wallet_id,name:row.name,balance:Number(row.actual_balance) }, reconciliation_id:row.reconciliation_id, already_existed:true };
    }
    const state = await client.query(`SELECT * FROM household_onboarding WHERE household_id=$1 FOR UPDATE`, [householdId]);
    if (!state.rowCount) {
      await client.query(`INSERT INTO household_onboarding(household_id,activation_required) VALUES($1,true)`, [householdId]);
    } else if (state.rows[0].wallet_setup_completed_at) {
      const error = new Error('Saldo awal household sudah ditetapkan');
      error.code = 'OPENING_BALANCE_ALREADY_SET';
      throw error;
    }
    const wallet = await client.query(
      `INSERT INTO wallets(household_id,name,is_default)
       VALUES($1,$2,NOT EXISTS(SELECT 1 FROM wallets WHERE household_id=$1)) RETURNING id,name,is_default`,
      [householdId, cleanName]
    );
    const reconciliation = await client.query(
      `INSERT INTO wallet_reconciliations
       (household_id,wallet_id,created_by,actual_balance,balance_before,adjustment_amount,reason,note,idempotency_key,entry_type)
       VALUES($1,$2,$3,$4,0,$4,'other','Saldo awal saat aktivasi FinePro',$5,'opening_balance') RETURNING id`,
      [householdId,wallet.rows[0].id,userId,target,idempotencyKey]
    );
    await client.query(
      `UPDATE household_onboarding SET wallet_setup_completed_at=now(),updated_at=now() WHERE household_id=$1`,
      [householdId]
    );
    await client.query(
      `INSERT INTO user_onboarding_progress(household_id,user_id,onboarding_version,current_step,updated_at)
       VALUES($1,$2,1,'dashboard_tour',now())
       ON CONFLICT(household_id,user_id) DO UPDATE SET current_step='dashboard_tour',updated_at=now()`,
      [householdId,userId]
    );
    await client.query('COMMIT');
    return { wallet:{...wallet.rows[0],balance:target}, reconciliation_id:reconciliation.rows[0].id, already_existed:false };
  } catch(error) {
    await client.query('ROLLBACK').catch(()=>{});
    throw error;
  } finally { client.release(); }
}

export async function completeDashboardTour(householdId, userId, version=1) {
  const result = await pool.query(
    `INSERT INTO user_onboarding_progress
     (household_id,user_id,onboarding_version,current_step,dashboard_tour_completed_at,completed_at,updated_at)
     SELECT $1,$2,$3,'complete',now(),now(),now()
     WHERE EXISTS(SELECT 1 FROM household_members WHERE household_id=$1 AND user_id=$2)
     ON CONFLICT(household_id,user_id) DO UPDATE SET
       onboarding_version=EXCLUDED.onboarding_version,current_step='complete',
       dashboard_tour_completed_at=now(),completed_at=now(),updated_at=now()
     RETURNING household_id`,
    [householdId,userId,version]
  );
  if (!result.rowCount) throw new Error('Household tidak ditemukan');
  return getOnboardingStatus(userId);
}

export async function restartDashboardTour(householdId, userId) {
  await pool.query(
    `INSERT INTO user_onboarding_progress(household_id,user_id,onboarding_version,current_step,updated_at)
     SELECT $1,$2,1,'dashboard_tour',now()
     WHERE EXISTS(SELECT 1 FROM household_members WHERE household_id=$1 AND user_id=$2)
     ON CONFLICT(household_id,user_id) DO UPDATE SET current_step='dashboard_tour',dashboard_tour_completed_at=NULL,completed_at=NULL,updated_at=now()`,
    [householdId,userId]
  );
  return getOnboardingStatus(userId);
}
