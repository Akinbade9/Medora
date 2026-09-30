import express from 'express';
import type { ApiErrorResponse, HealthResponse } from '@medora/shared-types';
import { errorHandler } from './middleware/error-handler.js';

export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'medora-api' } satisfies HealthResponse);
});

app.use((_req, res) => {
  res
    .status(404)
    .json({ error: { message: 'Not found' } } satisfies ApiErrorResponse);
});

app.use(errorHandler);
