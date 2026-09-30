import { z } from 'zod';

export interface AuthConfig {
  mongoUri: string;
  jwtKey: Uint8Array;
  origins: string[];
  secureCookies: boolean;
  accessSeconds: number;
  refreshSeconds: number;
}
export function loadAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): AuthConfig {
  const parsed = z
    .object({
      MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//),
      JWT_ACCESS_SECRET: z.string().regex(/^[a-f0-9]{64}$/i),
    })
    .safeParse(env);
  if (!parsed.success)
    throw new Error(
      'Set MONGODB_URI and a 64-character random hex JWT_ACCESS_SECRET in apps/api/.env.',
    );
  const origins = (
    env.WEB_ORIGINS ?? 'http://127.0.0.1:5173,http://127.0.0.1:8081'
  )
    .split(',')
    .map((value) => value.trim());
  const secureCookies = env.NODE_ENV === 'production';
  if (
    origins.some((origin) => {
      try {
        const url = new URL(origin);
        return (
          url.origin !== origin ||
          !['http:', 'https:'].includes(url.protocol) ||
          (secureCookies && url.protocol !== 'https:')
        );
      } catch {
        return true;
      }
    })
  )
    throw new Error(
      'WEB_ORIGINS must contain exact HTTP(S) origins; production requires HTTPS.',
    );
  return {
    mongoUri: parsed.data.MONGODB_URI,
    jwtKey: Buffer.from(parsed.data.JWT_ACCESS_SECRET, 'hex'),
    origins,
    secureCookies,
    accessSeconds: 900,
    refreshSeconds: 604800,
  };
}
