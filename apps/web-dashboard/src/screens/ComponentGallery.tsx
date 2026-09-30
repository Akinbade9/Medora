import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  Select,
  StatusBadge,
} from '../components/ui';
export function ComponentGallery() {
  const [open, setOpen] = useState(false);
  const [retryMessage, setRetryMessage] = useState('');
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Design system</p>
          <h1>Small details. A consistent experience.</h1>
          <p className="page-description">
            Interactive component previews. Values stay on this screen.
          </p>
        </div>
      </div>
      <div className="component-grid">
        <Card>
          <h2>Buttons</h2>
          <p className="muted">Clear actions, with room to breathe.</p>
          <div className="component-row">
            <Button onClick={() => setOpen(true)}>
              <Plus size={18} aria-hidden="true" />
              Open modal
            </Button>
            <Button variant="secondary" onClick={() => setOpen(true)}>
              Secondary
            </Button>
            <Button variant="ghost" onClick={() => setOpen(true)}>
              Text action
            </Button>
            <Button disabled>Disabled</Button>
            <Button loading>Loading</Button>
          </div>
        </Card>
        <Card>
          <h2>Labels & status</h2>
          <p className="muted">
            Status is communicated with text as well as color.
          </p>
          <div className="component-row">
            <Badge>Default</Badge>
            <Badge tone="info">Information</Badge>
            <StatusBadge status="Active" />
            <StatusBadge status="Pending" />
            <StatusBadge status="Inactive" />
            <StatusBadge status="Error" />
          </div>
        </Card>
        <Card>
          <h2>Form fields</h2>
          <div className="field-stack">
            <Input
              label="Display name"
              placeholder="Enter a name"
              hint="Preview only. Nothing is saved."
            />
            <Select label="Example preference" defaultValue="standard">
              <option value="standard">Standard</option>
              <option value="compact">Compact</option>
            </Select>
            <Input
              label="Field with error"
              defaultValue="Example"
              error="Example error: please review this value."
            />
            <Input
              label="Disabled field"
              placeholder="Not available"
              disabled
            />
          </div>
        </Card>
        <Card>
          <h2>Empty state</h2>
          <EmptyState
            title="A fresh start"
            description="Useful information will appear here when it is available."
          />
        </Card>
        <Card>
          <h2>Loading state</h2>
          <LoadingState label="Loading preview…" />
        </Card>
        <Card>
          <h2>Error state</h2>
          <ErrorState
            description="This is an example of a recoverable error."
            onRetry={() =>
              setRetryMessage('Preview reset. No request was sent.')
            }
          />
          <p role="status" className="small-text muted">
            {retryMessage}
          </p>
        </Card>
      </div>
      <Modal title="A little focus" open={open} onClose={() => setOpen(false)}>
        <p className="modal-copy">
          Dialogs keep one task in focus. Try Tab, Shift+Tab, Escape, or the
          close button.
        </p>
        <div className="field-stack">
          <Input label="Example field" placeholder="Try keyboard navigation" />
          <div className="component-row">
            <Button onClick={() => setOpen(false)}>Done</Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
