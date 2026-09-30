import type { ErrorRequestHandler } from 'express';
import type { ApiErrorResponse } from '@medora/shared-types';
import { AuthError } from '../auth/validation.js';

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  next,
) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const suppliedStatus =
    typeof error === 'object' && error !== null && 'status' in error
      ? error.status
      : undefined;
  const status =
    typeof suppliedStatus === 'number' &&
    Number.isInteger(suppliedStatus) &&
    suppliedStatus >= 400 &&
    suppliedStatus < 500
      ? suppliedStatus
      : 500;

  // Never expose exception messages, stack traces, or request bodies to clients.
  const message =
    error instanceof AuthError
      ? error.message
      : status === 500
        ? 'Internal server error'
        : status === 413
          ? 'Request body too large'
          : 'Invalid request';
  res.status(status).json({ error: { message } } satisfies ApiErrorResponse);
};
