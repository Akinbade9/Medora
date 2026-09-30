import { useState } from 'react';
import type { FormEvent } from 'react';
import type { PublicUser } from '@medora/shared-types';
import { HeartPulse } from 'lucide-react';
import { Button, Card, Input } from '../components/ui';
import { signIn } from './client';
import './auth.css';
export function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (user: PublicUser) => void;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    if (mode === 'register' && password !== form.get('confirmPassword')) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      onAuthenticated(
        await signIn(mode, {
          email,
          password,
          ...(mode === 'register'
            ? { displayName: String(form.get('displayName') ?? '') }
            : {}),
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <Card className="auth-card">
        <div className="auth-brand">
          <HeartPulse size={28} aria-hidden="true" />
          <span>medora.</span>
        </div>
        <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="muted">
          {mode === 'login'
            ? 'Sign in to your Medora workspace.'
            : 'Create a patient account. Professional access is provided by your organization.'}
        </p>
        <form key={mode} className="field-stack" onSubmit={submit}>
          {mode === 'register' && (
            <Input
              label="Full name"
              name="displayName"
              autoComplete="name"
              maxLength={100}
              required
              disabled={busy}
            />
          )}
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="username"
            maxLength={254}
            required
            disabled={busy}
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete={
              mode === 'register' ? 'new-password' : 'current-password'
            }
            minLength={mode === 'register' ? 12 : undefined}
            maxLength={128}
            hint={
              mode === 'register'
                ? 'Use 12–128 characters. A long, unique passphrase works well.'
                : undefined
            }
            required
            disabled={busy}
          />
          {mode === 'register' && (
            <Input
              label="Confirm password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              maxLength={128}
              required
              disabled={busy}
            />
          )}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" loading={busy}>
            {mode === 'login' ? 'Sign in' : 'Create patient account'}
          </Button>
        </form>
        <Button
          className="auth-switch"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError('');
          }}
        >
          {mode === 'login'
            ? 'New to Medora? Create an account'
            : 'Already have an account? Sign in'}
        </Button>
      </Card>
    </main>
  );
}
