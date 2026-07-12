import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

async function getUserHouseholdId(userId) {
  const result = await pool.query(
    'SELECT household_id FROM household_members WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  return result.rows[0]?.household_id || null;
}

// GET /api/categories
router.get('/', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.json({ categories: [] });

    const result = await pool.query(
      'SELECT id, type, name, sort_order, is_default, system_key FROM categories WHERE household_id = $1 ORDER BY type, sort_order',
      [householdId]
    );
    res.json({ categories: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil kategori' });
  }
});

// POST /api/categories — tambah kategori custom
router.post('/', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.status(400).json({ error: 'Belum punya household' });

    const { type, name } = req.body;
    if (!type || !['income', 'expense'].includes(type)) {
      return res.status(400).json({ error: 'type wajib income atau expense' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nama kategori wajib diisi' });
    }

    const existing = await pool.query(
      'SELECT id FROM categories WHERE household_id = $1 AND type = $2 AND name = $3',
      [householdId, type, name.trim()]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Kategori dengan nama ini sudah ada' });
    }

    const maxOrder = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) as max FROM categories WHERE household_id = $1 AND type = $2',
      [householdId, type]
    );

    const result = await pool.query(
      `INSERT INTO categories (household_id, type, name, sort_order, is_default)
       VALUES ($1, $2, $3, $4, false)
       RETURNING id, type, name, sort_order, is_default, system_key`,
      [householdId, type, name.trim(), Number(maxOrder.rows[0].max) + 1]
    );
    res.status(201).json({ category: result.rows[0] });
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Gagal menambah kategori' });
  }
});

// PATCH /api/categories/:id — ubah nama kategori (termasuk kategori bawaan sistem)
// Karena transactions.category & budgets.category menyimpan nama sebagai teks
// (bukan foreign key), rename di-cascade ke keduanya dalam satu transaction
// supaya laporan/histori lama tetap konsisten dengan nama yang baru.
router.patch('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.status(400).json({ error: 'Belum punya household' });

    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nama kategori wajib diisi' });
    }
    const newName = name.trim();

    const current = await client.query(
      'SELECT id, type, name, sort_order, is_default, system_key FROM categories WHERE id = $1 AND household_id = $2',
      [req.params.id, householdId]
    );
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Kategori tidak ditemukan' });
    }
    const oldName = current.rows[0].name;
    const { type } = current.rows[0];

    if (oldName === newName) {
      return res.json({ category: current.rows[0] });
    }

    const dup = await client.query(
      'SELECT id FROM categories WHERE household_id = $1 AND type = $2 AND name = $3 AND id != $4',
      [householdId, type, newName, req.params.id]
    );
    if (dup.rows.length > 0) {
      return res.status(409).json({ error: 'Kategori dengan nama ini sudah ada' });
    }

    await client.query('BEGIN');
    const updated = await client.query(
      'UPDATE categories SET name = $1 WHERE id = $2 RETURNING id, type, name, sort_order, is_default, system_key',
      [newName, req.params.id]
    );
    await client.query(
      'UPDATE transactions SET category = $1 WHERE household_id = $2 AND category = $3',
      [newName, householdId, oldName]
    );
    await client.query(
      'UPDATE budgets SET category = $1 WHERE household_id = $2 AND category = $3',
      [newName, householdId, oldName]
    );
    await client.query('COMMIT');

    res.json({ category: updated.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Rename category error:', err);
    res.status(500).json({ error: 'Gagal mengubah kategori' });
  } finally {
    client.release();
  }
});

// DELETE /api/categories/:id — hapus kategori (termasuk kategori bawaan sistem)
router.delete('/:id', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.status(400).json({ error: 'Belum punya household' });

    const current = await pool.query(
      'SELECT id, type FROM categories WHERE id = $1 AND household_id = $2',
      [req.params.id, householdId]
    );
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Kategori tidak ditemukan' });
    }

    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM categories WHERE household_id = $1 AND type = $2',
      [householdId, current.rows[0].type]
    );
    if (Number(countResult.rows[0].count) <= 1) {
      return res.status(400).json({ error: 'Tidak bisa menghapus kategori terakhir untuk tipe ini' });
    }

    await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: 'Gagal menghapus kategori' });
  }
});

export default router;
