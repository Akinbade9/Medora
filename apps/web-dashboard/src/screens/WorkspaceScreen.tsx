import { ArrowRight, HeartPulse } from 'lucide-react';
import { Badge, Card, EmptyState } from '../components/ui';
import { workspaces } from '../layouts/navigation';
import type { WorkspaceRole } from '../layouts/navigation';
export function WorkspaceScreen({
  role,
  page,
}: {
  role: WorkspaceRole;
  page: string;
}) {
  const workspace = workspaces[role];
  const current =
    workspace.items.find((item) => item.id === page) ?? workspace.items[0]!;
  const isHome = current.id === workspace.items[0]!.id;
  const Icon = current.icon;
  const shortcuts = workspace.items.slice(1, 4);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{workspace.label}</p>
          <h1>{isHome ? 'Welcome to your workspace' : current.label}</h1>
          <p className="page-description">
            {isHome ? workspace.intro : current.description}
          </p>
        </div>
        <Badge>Preview</Badge>
      </div>
      {isHome ? (
        <>
          <div className="home-grid">
            <Card className="welcome-card">
              <span className="welcome-symbol">
                <HeartPulse size={32} aria-hidden="true" />
              </span>
              <div>
                <p className="eyebrow">Connected care, made simple</p>
                <h2>
                  Everything in its place.
                  <br />
                  People at the heart.
                </h2>
                <p>One calm, considered space for the work that matters.</p>
              </div>
              <div className="welcome-footer">
                <span className="status-dot" aria-hidden="true" />
                Your Medora workspace
              </div>
            </Card>
            <Card className="guide-card">
              <span className="eyebrow">Your workspace</span>
              <h2>Take a look around</h2>
              <p>Explore the spaces designed around your day.</p>
              <div className="guide-links">
                {shortcuts.map(({ id, label, icon: ShortcutIcon }) => (
                  <a href={`#/${role}/${id}`} key={id}>
                    <span className="small-icon">
                      <ShortcutIcon size={19} aria-hidden="true" />
                    </span>
                    <span>{label}</span>
                    <ArrowRight size={17} aria-hidden="true" />
                  </a>
                ))}
              </div>
            </Card>
          </div>
          <section className="section-block" aria-labelledby="explore-title">
            <div className="section-heading">
              <h2 id="explore-title">A place for every part of your day</h2>
              <span className="muted small-text">Explore your workspace</span>
            </div>
            <div className="shortcut-grid">
              {shortcuts.map(
                ({ id, label, icon: ShortcutIcon, description }) => (
                  <a
                    className="card shortcut-card"
                    key={id}
                    href={`#/${role}/${id}`}
                  >
                    <span className="small-icon">
                      <ShortcutIcon size={21} aria-hidden="true" />
                    </span>
                    <h3>{label}</h3>
                    <p>{description}</p>
                    <span className="text-link">
                      Explore <ArrowRight size={16} aria-hidden="true" />
                    </span>
                  </a>
                ),
              )}
            </div>
          </section>
        </>
      ) : (
        <Card className="placeholder-card">
          <div className="card-heading">
            <h2>{current.label}</h2>
            <Badge tone="info">Coming soon</Badge>
          </div>
          <EmptyState
            icon={<Icon size={30} />}
            title={`Your ${current.label.toLowerCase()} space`}
            description="This screen is ready to take shape. No records or actions are connected in this layout preview."
          />
        </Card>
      )}
    </>
  );
}
