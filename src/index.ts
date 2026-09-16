import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import routes from './routes';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';
import { getRepositories } from './db';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json());
if (env.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', driver: env.dbDriver } });
});

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

// Eagerly initialize the data layer (and, for the memory driver, seed it)
// before accepting traffic so the first request isn't slow.
getRepositories();

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[arise-backend] listening on http://localhost:${env.port} (driver=${env.dbDriver})`);
});
