import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  Bell,
  ChevronRight,
  HeartPulse,
  Menu,
  Plus,
  Shapes,
} from 'lucide-react';
import { Badge, Button, EmptyState, Modal } from '../components/ui';
import type { PublicUser } from '@medora/shared-types';
import { workspaces } from './navigation';
import type { WorkspaceRole } from './navigation';
export function DashboardLayout({
  role,
  page,
  children,
  user,
  onLogout,
}: {
  role: WorkspaceRole;
  page: string;
  children: ReactNode;
  user: PublicUser;
  onLogout: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<'notifications' | 'prescription' | null>(
    null,
  );
  const workspace = workspaces[role];
  const pageLabel =
    workspace.items.find((item) => item.id === page)?.label ?? 'UI components';
  return (
    <div className="dashboard">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}>
        <a
          href={`#/${role}/${workspace.items[0]!.id}`}
          className="brand"
          aria-label="Medora home"
        >
          <span className="brand-mark">
            <HeartPulse size={24} aria-hidden="true" />
          </span>
          medora<span className="brand-dot">.</span>
        </a>
        <div id="workspace-navigation" className="sidebar-content">
          <p className="eyebrow sidebar-label">{workspace.shortLabel}</p>
          {role === 'doctor' && (
            <Button
              className="new-prescription"
              onClick={() => {
                setMenuOpen(false);
                setDialog('prescription');
              }}
            >
              <Plus size={18} aria-hidden="true" />
              New Prescription
            </Button>
          )}
          <nav aria-label={`${workspace.shortLabel} navigation`}>
            {workspace.items.map(({ id, label, icon: Icon }) => (
              <a
                key={id}
                href={`#/${role}/${id}`}
                className={`nav-item ${page === id ? 'is-active' : ''}`}
                aria-current={page === id ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
              >
                <Icon size={20} aria-hidden="true" />
                <span>{label}</span>
                {page === id && (
                  <span className="nav-indicator" aria-hidden="true" />
                )}
              </a>
            ))}
          </nav>
        </div>
        <div id="workspace-tools" className="sidebar-footer">
          <a
            className={`nav-item ${page === 'components' ? 'is-active' : ''}`}
            href={`#/${role}/components`}
            aria-current={page === 'components' ? 'page' : undefined}
            onClick={() => setMenuOpen(false)}
          >
            <Shapes size={19} aria-hidden="true" />
            UI components
          </a>
          <div className="preview-note">
            <Badge tone="info">Layout preview</Badge>
            <p>A foundation for better care.</p>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="top-header">
          <div className="header-location">
            <Button
              variant="ghost"
              className="icon-button menu-toggle"
              aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={menuOpen}
              aria-controls="workspace-navigation workspace-tools"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Menu size={22} aria-hidden="true" />
            </Button>
            <span className="header-workspace">{workspace.shortLabel}</span>
            <ChevronRight size={15} aria-hidden="true" />
            <span>{pageLabel}</span>
          </div>
          <div className="header-actions">
            <span className="account-name">{user.displayName}</span>
            <Button variant="secondary" onClick={onLogout}>
              Sign out
            </Button>
            <Button
              variant="ghost"
              className="icon-button notification-button"
              aria-label="Notifications"
              onClick={() => setDialog('notifications')}
            >
              <Bell size={21} aria-hidden="true" />
            </Button>
            <span className="avatar" aria-hidden="true">
              {role === 'doctor' ? 'D' : role === 'pharmacy' ? 'P' : 'A'}
            </span>
          </div>
        </header>
        <main id="main-content" className="main-content" tabIndex={-1}>
          {children}
          <footer className="workspace-footer">
            <span>Thoughtfully connected care.</span>
            <span>Medora · Workspace preview</span>
          </footer>
        </main>
      </div>
      <Modal
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog === 'prescription' ? 'New prescription' : 'Notifications'}
      >
        <EmptyState
          title={
            dialog === 'prescription'
              ? 'A space for your next prescription'
              : 'Your updates, all together'
          }
          description={
            dialog === 'prescription'
              ? 'This is a layout preview. Prescription creation is not available yet.'
              : 'Notifications will appear here. There are no connected updates in this preview.'
          }
          icon={
            dialog === 'notifications' ? <Bell size={28} /> : <Plus size={28} />
          }
          action={
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Back to workspace
            </Button>
          }
        />
      </Modal>
    </div>
  );
}
