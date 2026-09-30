import type { AuthResponse, PublicUser } from '@medora/shared-types';
export interface Credentials {
  email: string;
  password: string;
  displayName?: string;
}
const baseUrl = (
  import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3000'
).replace(/\/$/, '');
export const patientAppUrl =
  import.meta.env.VITE_PATIENT_APP_URL ?? 'http://127.0.0.1:8081';
let accessToken: string | null = null;
let signingOut = false;
let refreshInFlight: Promise<PublicUser> | null = null;
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function call<T>(
  path: string,
  body?: object,
  token?: string,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/auth/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Medora-Client': 'web',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiError(
      0,
      'Cannot reach Medora. Check your connection and try again.',
    );
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      response.status,
      data.error?.message ?? 'Unable to complete this request.',
    );
  return data as T;
}
export async function signIn(
  mode: 'login' | 'register',
  values: Credentials,
): Promise<PublicUser> {
  signingOut = false;
  const result = await call<AuthResponse>(mode, values);
  accessToken = result.accessToken;
  return result.user;
}
export function refreshSession(): Promise<PublicUser> {
  if (signingOut) return Promise.reject(new ApiError(401, 'Please sign in.'));
  if (!refreshInFlight)
    refreshInFlight = call<AuthResponse>('refresh', {})
      .then((result) => {
        if (signingOut) throw new ApiError(401, 'Please sign in.');
        accessToken = result.accessToken;
        return result.user;
      })
      .catch((error) => {
        accessToken = null;
        throw error;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  return refreshInFlight;
}
export async function currentUser(): Promise<PublicUser> {
  if (signingOut) throw new ApiError(401, 'Please sign in.');
  if (!accessToken) return refreshSession();
  try {
    const result = await call<{ user: PublicUser }>(
      'me',
      undefined,
      accessToken,
    );
    if (signingOut) throw new ApiError(401, 'Please sign in.');
    return result.user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && !signingOut)
      return refreshSession();
    throw error;
  }
}
export async function signOut() {
  signingOut = true;
  // Finish any pending rotation before revoking its latest cookie.
  await refreshInFlight?.catch(() => undefined);
  try {
    await call<void>('logout', {});
  } catch (error) {
    signingOut = false;
    throw error;
  }
  accessToken = null;
}
