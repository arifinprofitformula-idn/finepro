BEGIN;

-- Drafts whose linked transaction was deleted before referential integrity existed
-- are no longer actionable. Keep the audit row, but normalize its state.
UPDATE transaction_analysis_drafts d
SET status = 'cancelled', confirmed_transaction_id = NULL, updated_at = now()
WHERE d.status = 'confirmed'
  AND d.confirmed_transaction_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM transactions t WHERE t.id = d.confirmed_transaction_id
  );

-- Repair legacy drafts left pending although the same scan already inserted a
-- transaction. Link only an unambiguous exact amount/date/user/household match
-- created within 60 seconds. No transaction is inserted or deleted here.
WITH candidate_matches AS (
  SELECT d.id AS draft_id,
         (array_agg(t.id ORDER BY t.created_at, t.id))[1] AS transaction_id,
         count(*) AS match_count
  FROM transaction_analysis_drafts d
  JOIN transactions t
    ON t.household_id = d.household_id
   AND t.created_by = d.user_id
   AND t.amount = CASE
     WHEN (d.analysis->>'amount') ~ '^[0-9]+([.][0-9]+)?$'
       THEN (d.analysis->>'amount')::numeric
     ELSE NULL
   END
   AND t.date = CASE
     WHEN COALESCE(d.analysis->>'transaction_date', d.analysis->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
       THEN COALESCE(d.analysis->>'transaction_date', d.analysis->>'date')::date
     ELSE NULL
   END
   AND t.created_at BETWEEN d.created_at - interval '1 second'
                        AND d.created_at + interval '60 seconds'
  WHERE d.status = 'pending'
    AND d.confirmed_transaction_id IS NULL
  GROUP BY d.id
), redundant AS (
  SELECT c.draft_id
  FROM candidate_matches c
  JOIN transaction_analysis_drafts canonical
    ON canonical.confirmed_transaction_id = c.transaction_id
   AND canonical.status = 'confirmed'
  WHERE c.match_count = 1
)
UPDATE transaction_analysis_drafts d
SET status = 'cancelled', updated_at = now()
FROM redundant r
WHERE d.id = r.draft_id;

-- Coach requested the existing draft inbox be cleared. Preserve every row as
-- audit history; only deactivate remaining legacy pending drafts. Future drafts
-- are unaffected because this migration runs once.
UPDATE transaction_analysis_drafts
SET status = 'cancelled', updated_at = now()
WHERE status = 'pending';

-- Old confirmation code omitted source. Restore provenance from canonical draft
-- channel for linked scan transactions only.
UPDATE transactions t
SET source = CASE
  WHEN d.source_channel IN ('whatsapp', 'telegram') THEN d.source_channel
  ELSE 'receipt_scan'
END
FROM transaction_analysis_drafts d
WHERE d.confirmed_transaction_id = t.id
  AND d.status = 'confirmed'
  AND t.source = 'manual';

CREATE UNIQUE INDEX IF NOT EXISTS ux_transaction_drafts_confirmed_transaction
  ON transaction_analysis_drafts (confirmed_transaction_id)
  WHERE confirmed_transaction_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'transaction_analysis_drafts'::regclass
      AND conname = 'transaction_analysis_drafts_confirmed_transaction_fkey'
  ) THEN
    ALTER TABLE transaction_analysis_drafts
      ADD CONSTRAINT transaction_analysis_drafts_confirmed_transaction_fkey
      FOREIGN KEY (confirmed_transaction_id)
      REFERENCES transactions(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

ALTER TABLE transaction_analysis_drafts
  VALIDATE CONSTRAINT transaction_analysis_drafts_confirmed_transaction_fkey;

COMMIT;
