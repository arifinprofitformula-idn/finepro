import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import transactionsRoutes from './routes/transactions.js';
import budgetsRoutes from './routes/budgets.js';
import categoriesRoutes from './routes/categories.js';
import householdsRoutes from './routes/households.js';
import webhookRoutes from './routes/webhook.js';

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/budgets', budgetsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/households', householdsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Keuangan API running on http://127.0.0.1:${PORT}`);
});
