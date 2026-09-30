import { useEffect, useSyncExternalStore } from 'react';
import { DashboardLayout } from './layouts/DashboardLayout';
import { parseRoute, workspaces } from './layouts/navigation';
import { ComponentGallery } from './screens/ComponentGallery';
import { WorkspaceScreen } from './screens/WorkspaceScreen';
function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}
export default function App() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  const { role, page } = parseRoute(hash);
  useEffect(() => {
    const workspace = workspaces[role];
    const title =
      workspace.items.find((item) => item.id === page)?.label ??
      'UI components';
    document.title = `${title} · ${workspace.shortLabel} · Medora`;
    document.getElementById('main-content')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [role, page]);
  return (
    <DashboardLayout key={role} role={role} page={page}>
      {page === 'components' ? (
        <ComponentGallery />
      ) : (
        <WorkspaceScreen role={role} page={page} />
      )}
    </DashboardLayout>
  );
}
