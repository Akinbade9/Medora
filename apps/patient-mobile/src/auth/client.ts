import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { AuthResponse, PublicUser } from '@medora/shared-types';
export interface Credentials {
  email: string;
  password: string;
  displayName?: string;
}
const baseUrl = (
  process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:3000'
).replace(/\/$/, '');
export const dashboardUrl =
  process.env.EXPO_PUBLIC_WEB_DASHBOARD_URL ?? 'http://127.0.0.1:5173';
const native = Platform.OS !== 'web';
const key = 'medora.refresh';
let accessToken: string | null = null;
let signingOut = false;
let refreshing: Promise<PublicUser> | null = null;
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${baseUrl}/api/auth/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: native ? 'omit' : 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Medora-Client': native ? 'native' : 'web',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    if (response.status === 204) return undefined as T;
    const data = await response.json();
    if (!response.ok)
      throw new ApiError(
        response.status,
        data.error?.message ?? 'Unable to complete this request.',
      );
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      0,
      'Cannot reach Medora. Check your connection and try again.',
    );
  } finally {
    clearTimeout(timeout);
  }
}
async function accept(result: AuthResponse) {
  if (native) {
    if (!result.refreshToken)
      throw new ApiError(0, 'Unable to save your session securely.');
    try {
      await SecureStore.setItemAsync(key, result.refreshToken, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    } catch {
      await call<void>('logout', { refreshToken: result.refreshToken }).catch(
        () => undefined,
      );
      throw new ApiError(
        0,
        'Unable to save your session securely. Please retry.',
      );
    }
  }
  accessToken = result.accessToken;
  return result.user;
}
export async function signIn(
  mode: 'login' | 'register',
  values: Credentials,
): Promise<PublicUser> {
  signingOut = false;
  return accept(await call<AuthResponse>(mode, values));
}
export function refreshSession(): Promise<PublicUser> {
  if (signingOut) return Promise.reject(new ApiError(401, 'Please sign in.'));
  if (!refreshing)
    refreshing = (async () => {
      const refreshToken = native ? await SecureStore.getItemAsync(key) : null;
      if (native && !refreshToken) throw new ApiError(401, 'Please sign in.');
      try {
        const account = await accept(
          await call<AuthResponse>('refresh', native ? { refreshToken } : {}),
        );
        if (signingOut) throw new ApiError(401, 'Please sign in.');
        return account;
      } catch (error) {
        accessToken = null;
        if (
          native &&
          error instanceof ApiError &&
          error.status === 401 &&
          !signingOut
        )
          await SecureStore.deleteItemAsync(key);
        throw error;
      }
    })().finally(() => {
      refreshing = null;
    });
  return refreshing;
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
  try {
    await refreshing?.catch(() => undefined);
    const refreshToken = native ? await SecureStore.getItemAsync(key) : null;
    await call<void>(
      'logout',
      native ? { ...(refreshToken ? { refreshToken } : {}) } : {},
    );
    if (native) await SecureStore.deleteItemAsync(key);
    accessToken = null;
  } catch (error) {
    signingOut = false;
    throw error;
  }
}
