import { useEffect, useSyncExternalStore } from 'react';
import { DashboardLayout } from './layouts/DashboardLayout';
import { parseRoute, workspaces } from './layouts/navigation';
import { ComponentGallery } from './screens/ComponentGallery';
import { WorkspaceScreen } from './screens/WorkspaceScreen';
import type { PublicUser } from '@medora/shared-types';
import { AuthScreen } from './auth/AuthScreen';
import { useAuth } from './auth/useAuth';
import { patientAppUrl } from './auth/client';
import { Button, ErrorState, LoadingState } from './components/ui';
import { DoctorWorkspace } from './doctor/DoctorWorkspace';

function workspaceFor(user: PublicUser) {
  if (user.role === 'DOCTOR') return 'doctor';
  if (user.role === 'PHARMACY_ADMIN' || user.role === 'PHARMACY_STAFF')
    return 'pharmacy';
  if (user.role === 'PLATFORM_ADMIN') return 'admin';
  return null;
}
function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}
export default function App() {
  const auth = useAuth();
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  const { role, page } = parseRoute(hash);
  const allowedRole = auth.user ? workspaceFor(auth.user) : null;
  useEffect(() => {
    if (!auth.user) return;
    if (auth.user.role === 'PATIENT') {
      window.location.replace(patientAppUrl);
      return;
    }
    if (
      allowedRole &&
      (role !== allowedRole || !hash.startsWith(`#/${allowedRole}/`))
    )
      window.location.hash = `/${allowedRole}/${workspaces[allowedRole].items[0]!.id}`;
  }, [auth.user, allowedRole, role, hash]);
  useEffect(() => {
    const workspace = workspaces[role];
    const title =
      workspace.items.find((item) => item.id === page)?.label ??
      (page === 'new-prescription' ? 'New prescription' : 'UI components');
    document.title = `${title} · ${workspace.shortLabel} · Medora`;
    document.getElementById('main-content')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [role, page, hash]);
  if (auth.checking) return <LoadingState label="Checking your session…" />;
  if (auth.error)
    return (
      <div className="session-message">
        <ErrorState
          description={auth.error}
          onRetry={() => {
            void auth.check();
          }}
        />
        {auth.user && (
          <Button
            onClick={() => {
              void auth.logout();
            }}
          >
            Retry sign out
          </Button>
        )}
      </div>
    );
  if (!auth.user) return <AuthScreen onAuthenticated={auth.setUser} />;
  if (!allowedRole)
    return (
      <div className="session-message">
        <LoadingState label="Opening your patient experience…" />
        <a href={patientAppUrl}>Open patient app</a>
        <Button
          variant="ghost"
          onClick={() => {
            void auth.logout();
          }}
        >
          Sign out
        </Button>
      </div>
    );
  if (role !== allowedRole)
    return <LoadingState label="Opening your workspace…" />;
  return (
    <DashboardLayout
      key={role}
      role={allowedRole}
      page={page}
      user={auth.user}
      onLogout={() => {
        void auth.logout();
      }}
    >
      {page === 'components' ? (
        <ComponentGallery />
      ) : role === 'doctor' ? (
        <DoctorWorkspace key={auth.user.id} hash={hash} user={auth.user} />
      ) : (
        <WorkspaceScreen role={role} page={page} />
      )}
    </DashboardLayout>
  );
}
