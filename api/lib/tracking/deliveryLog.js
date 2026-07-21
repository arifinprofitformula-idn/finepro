// api/lib/tracking/deliveryLog.js
// Audit log delivery server-side ke tracking_event_deliveries. Tidak pernah
// menyimpan payload lengkap, PII, atau secret — hanya metadata status.

import pool from '../../db.js';

const ENVIRONMENT = process.env.NODE_ENV === 'production' ? 'production' : 'development';

// recordDelivery(...) -> insert log baris baru. Dipakai setelah setiap percobaan kirim (sukses/gagal).
export async function recordDelivery({
  eventId,
  internalEventName,
  provider,
  channel,
  providerEventName,
  status,
  responseCode = null,
  errorCode = null,
  errorMessageSanitized = null,
  attemptCount = 1,
}) {
  try {
    await pool.query(
      `INSERT INTO tracking_event_deliveries
        (event_id, internal_event_name, provider, channel, provider_event_name, delivery_status,
         response_code, error_code, error_message_sanitized, attempt_count, environment, delivered_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CASE WHEN $6 = 'success' THEN now() ELSE NULL END)`,
      [
        eventId,
        internalEventName,
        provider,
        channel,
        providerEventName,
        status,
        responseCode,
        errorCode,
        errorMessageSanitized ? String(errorMessageSanitized).slice(0, 500) : null,
        attemptCount,
        ENVIRONMENT,
      ]
    );
  } catch (err) {
    // Logging tidak boleh pernah menggagalkan tracking flow itu sendiri.
    console.error('[tracking] Gagal menulis delivery log:', err.message);
  }
}

// wasAlreadyDelivered(provider, channel, eventId) -> true kalau sudah ada delivery sukses
// dengan kombinasi (provider, channel, event_id) yang sama — mencegah pengiriman server berulang.
export async function wasAlreadyDelivered(provider, channel, eventId) {
  const result = await pool.query(
    `SELECT 1 FROM tracking_event_deliveries
     WHERE provider = $1 AND channel = $2 AND event_id = $3 AND delivery_status = 'success'
     LIMIT 1`,
    [provider, channel, eventId]
  );
  return result.rows.length > 0;
}

export async function listDeliveries({ provider, status, eventName, dateFrom, dateTo, limit = 25, offset = 0 }) {
  const conditions = [];
  const params = [];

  if (provider) {
    params.push(provider);
    conditions.push(`provider = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`delivery_status = $${params.length}`);
  }
  if (eventName) {
    params.push(eventName);
    conditions.push(`internal_event_name = $${params.length}`);
  }
  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`created_at >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`created_at <= $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(Math.min(Number(limit) || 25, 100), Number(offset) || 0);

  const result = await pool.query(
    `SELECT id, event_id, internal_event_name, provider, channel, provider_event_name,
            delivery_status, response_code, attempt_count, environment, created_at, delivered_at,
            COUNT(*) OVER()::int AS total_count
     FROM tracking_event_deliveries
     ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const total = result.rows[0]?.total_count ?? 0;
  return { rows: result.rows.map(({ total_count, ...row }) => row), total };
}

// cleanupOldDeliveries(retentionDays) -> hapus log lebih tua dari retensi. Dipanggil dari job/cron sesuai pola proyek.
export async function cleanupOldDeliveries(retentionDays = 30) {
  const result = await pool.query(
    `DELETE FROM tracking_event_deliveries WHERE created_at < now() - ($1 || ' days')::interval`,
    [Number(retentionDays) || 30]
  );
  return result.rowCount;
}
