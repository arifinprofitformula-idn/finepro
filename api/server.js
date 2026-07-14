import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import transactionsRoutes from './routes/transactions.js';
import budgetsRoutes from './routes/budgets.js';
import categoriesRoutes from './routes/categories.js';
import householdsRoutes from './routes/households.js';
import invitesRoutes from './routes/invites.js';
import webhookRoutes from './routes/webhook.js';
import paymentsRoutes from './routes/payments.js';
import billsRoutes from './routes/bills.js';
import receiptsRoutes from './routes/receipts.js';
import walletsRoutes from './routes/wallets.js';
import arisanRoutes from './routes/arisan.js';
import pushRoutes from './routes/push.js';
import aiInsightsRoutes from './routes/ai-insights.js';
import adminRoutes from './routes/admin.js';
import telegramRoutes from './routes/telegram.js';
import whatsappRoutes from './routes/whatsapp.js';
import savingsGoalsRoutes from './routes/savings-goals.js';
import metalPricesRoutes from './routes/metal-prices.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.API_PORT || 3001;

// Trust reverse proxy (Caddy) agar express-rate-limit membaca IP asli pengguna
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

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
app.use('/api/invites', invitesRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/bills', billsRoutes);
app.use('/api/receipts', receiptsRoutes);
app.use('/api/wallets', walletsRoutes);
app.use('/api/arisan', arisanRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/ai', aiInsightsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/savings-goals', savingsGoalsRoutes);
app.use('/api/metal-prices', metalPricesRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Keuangan API running on http://0.0.0.0:${PORT}`);
});
