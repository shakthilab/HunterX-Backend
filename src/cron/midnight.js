// src/cron/midnight.js - Cron job scheduled for midnight IST (18:30 UTC)

import cron from 'node-cron';
import { info } from '../utils/logger.js';

// Cron schedule: 30 18 * * * corresponding to 00:00 IST (18:30 UTC)
export const midnightJob = cron.schedule('30 18 * * *', () => {
  info(`Midnight reset triggered - ${new Date().toISOString()}`);
});

export default midnightJob;
