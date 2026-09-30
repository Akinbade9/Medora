import { randomBytes } from 'node:crypto';
import type { AuthConfig } from '../src/auth/config.js';
export const testConfig: AuthConfig = {
  mongoUri: 'mongodb://127.0.0.1/test',
  jwtKey: randomBytes(32),
  origins: ['http://127.0.0.1:5173'],
  secureCookies: false,
  accessSeconds: 900,
  refreshSeconds: 604800,
};
