import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PublicUser } from '@medora/shared-types';
import { AppText, PatientLayout } from '../PatientLayout';
import { theme } from '../theme';
import {
  ApiError,
  currentUser,
  dashboardUrl,
  refreshSession,
  signIn,
  signOut,
} from './client';

export function AuthGate() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [connectionError, setConnectionError] = useState(false);
  const check = useCallback(async () => {
    try {
      setUser(await currentUser());
      setConnectionError(false);
      setError('');
    } catch (cause) {
      setUser(null);
      const unavailable = !(cause instanceof ApiError && cause.status === 401);
      setConnectionError(unavailable);
      setError(
        unavailable
          ? 'Unable to verify your session. Check your connection and retry.'
          : '',
      );
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    currentUser()
      .then((account) => {
        if (active) setUser(account);
      })
      .catch((cause) => {
        if (active && !(cause instanceof ApiError && cause.status === 401)) {
          setConnectionError(true);
          setError(
            'Unable to verify your session. Check your connection and retry.',
          );
        }
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
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    const interval = setInterval(
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
      subscription.remove();
      clearInterval(interval);
    };
  }, [user, check]);
  async function logout() {
    setBusy(true);
    setError('');
    try {
      await signOut();
      setUser(null);
      setConnectionError(false);
      setPassword('');
      setConfirmation('');
    } catch {
      setError(
        'Sign out could not be confirmed. Please check your connection and retry.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function professionalHandoff() {
    if (Platform.OS === 'web') {
      window.location.replace(dashboardUrl);
      return;
    }
    setBusy(true);
    try {
      await signOut();
      setUser(null);
      await Linking.openURL(dashboardUrl);
    } catch {
      setError(
        'Open the professional web dashboard to sign in. Please retry if the browser did not open.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (
      !email.trim() ||
      !password ||
      (mode === 'register' &&
        (!displayName.trim() ||
          password.length < 12 ||
          password !== confirmation))
    ) {
      setError(
        'Enter all required fields. For registration, use at least 12 password characters and matching passwords.',
      );
      return;
    }
    setBusy(true);
    setError('');
    try {
      const account = await signIn(mode, {
        email,
        password,
        ...(mode === 'register' ? { displayName } : {}),
      });
      setPassword('');
      setConfirmation('');
      setUser(account);
      if (account.role !== 'PATIENT') {
        if (Platform.OS === 'web') window.location.replace(dashboardUrl);
        else await professionalHandoff();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }
  if (checking)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
        <AppText>Checking your session…</AppText>
      </View>
    );
  if (connectionError)
    return (
      <SafeAreaView style={styles.center}>
        <AppText accessibilityRole="alert">{error}</AppText>
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          onPress={() => {
            void check();
          }}
        >
          <AppText style={styles.buttonText}>Retry</AppText>
        </Pressable>
      </SafeAreaView>
    );
  if (user?.role === 'PATIENT')
    return (
      <View style={styles.full}>
        {error ? (
          <AppText accessibilityRole="alert" style={styles.error}>
            {error}
          </AppText>
        ) : null}
        <PatientLayout
          user={user}
          onLogout={() => {
            void logout();
          }}
          signingOut={busy}
        />
      </View>
    );
  if (user)
    return (
      <SafeAreaView style={styles.center}>
        <AppText weight="semibold">
          Your professional workspace is on the web.
        </AppText>
        <AppText>
          For native-to-web handoff, sign in again in your browser.
        </AppText>
        {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          style={styles.button}
          onPress={() => {
            void professionalHandoff();
          }}
        >
          <AppText style={styles.buttonText}>Open web dashboard</AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          style={styles.linkButton}
          onPress={() => {
            void logout();
          }}
        >
          <AppText>Sign out</AppText>
        </Pressable>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={styles.full}>
      <KeyboardAvoidingView
        style={styles.full}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <AppText weight="bold" style={styles.brand}>
            medora.
          </AppText>
          <AppText
            accessibilityRole="header"
            weight="semibold"
            style={styles.title}
          >
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </AppText>
          <AppText style={styles.description}>
            {mode === 'login'
              ? 'Sign in to stay connected to your care.'
              : 'Create a patient account. Professional access is provided by your organization.'}
          </AppText>
          {mode === 'register' && (
            <>
              <AppText weight="medium">Full name</AppText>
              <TextInput
                accessibilityLabel="Full name"
                autoComplete="name"
                value={displayName}
                onChangeText={setDisplayName}
                editable={!busy}
                maxLength={100}
                style={styles.input}
              />
            </>
          )}
          <AppText weight="medium">Email</AppText>
          <TextInput
            accessibilityLabel="Email"
            autoComplete="email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            maxLength={254}
            editable={!busy}
            style={styles.input}
          />
          <AppText weight="medium">Password</AppText>
          <TextInput
            accessibilityLabel="Password"
            autoComplete={
              mode === 'register' ? 'new-password' : 'current-password'
            }
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            value={password}
            onChangeText={setPassword}
            maxLength={128}
            editable={!busy}
            style={styles.input}
          />
          {mode === 'register' && (
            <>
              <AppText style={styles.description}>
                Use a unique passphrase of 12–128 characters.
              </AppText>
              <AppText weight="medium">Confirm password</AppText>
              <TextInput
                accessibilityLabel="Confirm password"
                autoComplete="new-password"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                value={confirmation}
                onChangeText={setConfirmation}
                maxLength={128}
                editable={!busy}
                style={styles.input}
              />
            </>
          )}
          {error ? (
            <AppText accessibilityRole="alert" style={styles.error}>
              {error}
            </AppText>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            onPress={() => {
              void submit();
            }}
            style={[styles.button, busy && styles.disabled]}
          >
            {busy ? (
              <ActivityIndicator color={theme.colors.card} />
            ) : (
              <AppText weight="semibold" style={styles.buttonText}>
                {mode === 'login' ? 'Sign in' : 'Create patient account'}
              </AppText>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            style={styles.linkButton}
            onPress={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
              setPassword('');
              setConfirmation('');
            }}
          >
            <AppText style={styles.linkText}>
              {mode === 'login'
                ? 'New to Medora? Create an account'
                : 'Already have an account? Sign in'}
            </AppText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const { colors: c, space: s, radius: r } = theme;
const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: c.background },
  center: {
    flex: 1,
    padding: s.xxl,
    gap: s.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: s.xxl,
    gap: s.md,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  brand: {
    fontSize: 32,
    lineHeight: 40,
    color: c.primary,
    marginBottom: s.xxl,
  },
  title: { fontSize: 28, lineHeight: 36 },
  description: { color: c.muted, fontSize: 14, marginBottom: s.sm },
  input: {
    borderWidth: 1,
    borderColor: c.muted,
    borderRadius: r.small,
    minHeight: 48,
    padding: s.md,
    color: c.text,
    backgroundColor: c.card,
    fontSize: 16,
    fontFamily: theme.font.regular,
  },
  button: {
    minHeight: 48,
    backgroundColor: c.primary,
    borderRadius: r.small,
    padding: s.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: s.sm,
  },
  buttonText: { color: c.card },
  linkButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    padding: s.sm,
  },
  linkText: { color: c.primaryDark, fontSize: 14 },
  error: { color: c.danger, padding: s.sm, fontSize: 14 },
  disabled: { opacity: 0.6 },
});
