// src/index.js — Express application entry point

import 'dotenv/config';
import express            from 'express';
import cors               from 'cors';
import helmet             from 'helmet';
import morgan             from 'morgan';
import { generalLimiter } from './middleware/rateLimiter.js';
import { errorHandler }   from './middleware/errorHandler.js';
import router             from './routes/index.js';
import { info }           from './utils/logger.js';
import './cron/midnight.js'; // starts the nightly task-assignment cron

const app  = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(generalLimiter);

// Routes
app.use('/api', router);

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`,
  });
});

// Global error handler — must be last
app.use(errorHandler);

// Start
app.listen(PORT, '0.0.0.0', () => {
  info(`HunterX backend running on port ${PORT}`);
  info(`Health: http://localhost:${PORT}/api/health`);
  info(`LAN Health: http://192.168.1.9:${PORT}/api/health`);
});

export default app;
