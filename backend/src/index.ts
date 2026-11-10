import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { whoopRouter } from './routes/whoop.js';
import { summaryRouter } from './routes/summary.js';
import { financeRouter } from './routes/finance.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

app.use('/api/whoop', whoopRouter);
app.use('/api/summary', summaryRouter);
app.use('/api/finance', financeRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
