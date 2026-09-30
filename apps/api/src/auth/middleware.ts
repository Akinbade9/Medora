import type { RequestHandler } from 'express';
import type { Role } from '@medora/shared-types';
import { AuthService, assertRole } from './service.js';
import type { Principal } from './service.js';
import { AuthError } from './validation.js';
declare module 'express-serve-static-core' {
  interface Request {
    auth?: Principal;
  }
}
export function authenticate(service: AuthService): RequestHandler {
  return async (req, _res, next) => {
    const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization ?? '');
    if (!match) throw new AuthError(401, 'Authentication required.');
    req.auth = await service.authenticate(match[1]!);
    next();
  };
}
export function requireRoles(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) throw new AuthError(401, 'Authentication required.');
    assertRole(req.auth, roles);
    next();
  };
}
