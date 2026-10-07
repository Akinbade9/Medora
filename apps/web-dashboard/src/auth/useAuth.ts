import { useCallback, useEffect, useState } from 'react';
import type { PublicUser } from '@medora/shared-types';
import { ApiError, currentUser, refreshSession, signOut } from './client';
export function useAuth() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const check = useCallback(async () => {
    try {
      setUser(await currentUser());
      setError('');
    } catch (cause) {
      setUser(null);
      setError(
        cause instanceof ApiError && cause.status === 401
          ? ''
          : 'Unable to verify your session. Please retry.',
      );
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    const expired = () => {
      setUser(null);
      setError('');
    };
    const refreshed = (event: Event) =>
      setUser((event as CustomEvent<PublicUser>).detail);
    window.addEventListener('medora-session-expired', expired);
    window.addEventListener('medora-session', refreshed);
    return () => {
      window.removeEventListener('medora-session-expired', expired);
      window.removeEventListener('medora-session', refreshed);
    };
  }, []);
  useEffect(() => {
    let active = true;
    currentUser()
      .then((account) => {
        if (active) setUser(account);
      })
      .catch((cause) => {
        if (active && !(cause instanceof ApiError && cause.status === 401))
          setError('Unable to verify your session. Please retry.');
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    const focus = () => {
      void check();
    };
    window.addEventListener('focus', focus);
    const timer = window.setInterval(
      () => {
        void refreshSession()
          .then(setUser)
          .catch(() => {
            setUser(null);
          });
      },
      12 * 60 * 1000,
    );
    return () => {
      window.removeEventListener('focus', focus);
      window.clearInterval(timer);
    };
  }, [user, check]);
  const logout = async () => {
    try {
      await signOut();
      setUser(null);
      setError('');
      window.location.hash = '/login';
    } catch {
      setError(
        'Sign out could not be confirmed. Check your connection and retry.',
      );
    }
  };
  return { user, checking, error, check, logout, setUser };
}
