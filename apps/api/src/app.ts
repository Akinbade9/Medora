import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import type { ApiErrorResponse, HealthResponse } from '@medora/shared-types';
import { errorHandler } from './middleware/error-handler.js';
import type { AuthConfig } from './auth/config.js';
import { AuthService } from './auth/service.js';
import { authRouter } from './auth/routes.js';
import { AuthError } from './auth/validation.js';
import { catalogueRouter, adminCatalogueRouter } from './catalogue/routes.js';
import { prescriptionRouter } from './prescriptions/routes.js';
import { doctorRouter } from './doctor/routes.js';

export function createApp(config: AuthConfig) {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    cors({
      credentials: true,
      origin: (origin, callback) => {
        if (!origin || config.origins.includes(origin)) callback(null, true);
        else callback(new AuthError(403, 'Untrusted browser origin.'));
      },
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Medora-Client'],
      methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'medora-api' } satisfies HealthResponse);
  });

  app.use('/api/auth', authRouter(new AuthService(config)));
  app.use('/api/medicines', catalogueRouter(new AuthService(config)));
  app.use('/api/admin', adminCatalogueRouter(new AuthService(config)));
  app.use('/api', prescriptionRouter(new AuthService(config)));
  app.use('/api/doctor', doctorRouter(new AuthService(config)));

  app.use((_req, res) => {
    res
      .status(404)
      .json({ error: { message: 'Not found' } } satisfies ApiErrorResponse);
  });

  app.use(errorHandler);
  return app;
}
