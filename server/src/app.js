import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import usersRouter from './routes/users.js';
import backupRouter from './routes/backup.js';
import seedRouter from './routes/seed.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

/* ---------- Security & parsing ---------- */
app.use(helmet());
app.use(express.json({ limit: '2mb' }));

const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim());
app.use(cors({ origin: origins, credentials: true }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

/* ---------- Routes ---------- */
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'veloura-pos-api' }));
app.use('/api/users', usersRouter);
app.use('/api/backup', backupRouter);
app.use('/api/seed', seedRouter);

app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
app.use(errorHandler);

export default app;
