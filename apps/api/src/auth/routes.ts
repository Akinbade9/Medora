import { Router } from 'express';
import type { Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AuthService } from './service.js';
import { authenticate, requireRoles } from './middleware.js';
import {
  AuthError,
  loginSchema,
  parseInput,
  refreshSchema,
  registerSchema,
} from './validation.js';

const cookieName = 'medora_refresh';
export function authRouter(service: AuthService) {
  const router = Router();
  const cookieOptions = {
    httpOnly: true,
    secure: service.config.secureCookies,
    sameSite: 'strict' as const,
    path: '/api/auth',
  };
  const limit = (max: number) =>
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: max,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        error: { message: 'Too many attempts. Please try again later.' },
      },
    });
  const credentialsLimit = limit(20);
  const sessionLimit = limit(120);
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  // Custom header + exact Origin checks protect browser cookie mutations against CSRF.
  router.use((req, _res, next) => {
    if (req.method !== 'GET') {
      const client = req.get('X-Medora-Client');
      const origin = req.get('Origin');
      if (client === 'web') {
        if (!origin || !service.config.origins.includes(origin))
          throw new AuthError(403, 'Untrusted browser origin.');
      } else if (client !== 'native' || origin)
        throw new AuthError(403, 'Invalid authentication client.');
      if (!req.is('application/json'))
        throw new AuthError(415, 'Use application/json.');
    }
    next();
  });
  function tokenFrom(req: Request) {
    const body = parseInput(refreshSchema, req.body);
    if (req.get('X-Medora-Client') === 'web') {
      if (body.refreshToken !== undefined)
        throw new AuthError(
          400,
          'Browser refresh tokens must use the secure cookie.',
        );
      const cookie: unknown = req.cookies?.[cookieName];
      return typeof cookie === 'string' ? cookie : undefined;
    }
    return body.refreshToken;
  }
  function sendSession(
    req: Request,
    res: Response,
    result: Awaited<ReturnType<AuthService['login']>>,
    status = 200,
  ) {
    if (req.get('X-Medora-Client') === 'native')
      return res.status(status).json(result);
    res.cookie(cookieName, result.refreshToken, {
      ...cookieOptions,
      maxAge: service.config.refreshSeconds * 1000,
    });
    return res.status(status).json({
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    });
  }
  router.post('/register', credentialsLimit, async (req, res) => {
    sendSession(
      req,
      res,
      await service.register(parseInput(registerSchema, req.body)),
      201,
    );
  });
  router.post('/login', credentialsLimit, async (req, res) => {
    sendSession(
      req,
      res,
      await service.login(parseInput(loginSchema, req.body)),
    );
  });
  router.post('/refresh', sessionLimit, async (req, res) => {
    try {
      sendSession(req, res, await service.refresh(tokenFrom(req)));
    } catch (error) {
      if (error instanceof AuthError && error.status === 401)
        res.clearCookie(cookieName, cookieOptions);
      throw error;
    }
  });
  router.post('/logout', sessionLimit, async (req, res) => {
    await service.logout(tokenFrom(req));
    res.clearCookie(cookieName, cookieOptions);
    res.sendStatus(204);
  });
  router.get('/me', authenticate(service), (req, res) => {
    res.json({ user: req.auth!.user });
  });
  for (const [path, roles] of [
    ['patient', ['PATIENT']],
    ['doctor', ['DOCTOR']],
    ['pharmacy', ['PHARMACY_ADMIN', 'PHARMACY_STAFF']],
    ['admin', ['PLATFORM_ADMIN']],
  ] as const)
    router.get(
      `/access/${path}`,
      authenticate(service),
      requireRoles(...roles),
      (_req, res) => {
        res.json({ workspace: path });
      },
    );
  return router;
}
