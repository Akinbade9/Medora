import { useEffect, useId, useRef } from 'react';
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import { AlertCircle, Inbox, LoaderCircle, X } from 'lucide-react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
};
export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`button button--${variant} ${className}`}
    >
      {loading && (
        <LoaderCircle className="spin" size={18} aria-hidden="true" />
      )}
      {children}
    </button>
  );
}
type FieldProps = { label: string; hint?: string; error?: string };
export function Input({
  label,
  hint,
  error,
  id,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & FieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const describedBy =
    [
      props['aria-describedby'],
      hint && `${fieldId}-hint`,
      error && `${fieldId}-error`,
    ]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <div className={`field ${className}`}>
      <label htmlFor={fieldId}>
        {label}
        {props.required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        {...props}
        id={fieldId}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={describedBy}
      />
      {hint && (
        <p className="field-hint" id={`${fieldId}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={`${fieldId}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
export function Select({
  label,
  hint,
  error,
  id,
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & FieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const describedBy =
    [
      props['aria-describedby'],
      hint && `${fieldId}-hint`,
      error && `${fieldId}-error`,
    ]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <div className={`field ${className}`}>
      <label htmlFor={fieldId}>
        {label}
        {props.required && <span aria-hidden="true"> *</span>}
      </label>
      <select
        {...props}
        id={fieldId}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={describedBy}
      >
        {children}
      </select>
      {hint && (
        <p className="field-hint" id={`${fieldId}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={`${fieldId}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
export function Card({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={`card ${className}`}>
      {children}
    </div>
  );
}
type Tone = 'neutral' | 'success' | 'info' | 'warning' | 'danger';
export function Badge({
  tone = 'neutral',
  children,
  className = '',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span {...props} className={`badge badge--${tone} ${className}`}>
      {children}
    </span>
  );
}
const statusTones = {
  Active: 'success',
  Pending: 'warning',
  Inactive: 'neutral',
  Error: 'danger',
} as const;
export function StatusBadge({ status }: { status: keyof typeof statusTones }) {
  return (
    <Badge tone={statusTones[status]}>
      <span className="status-dot" aria-hidden="true" />
      {status}
    </Badge>
  );
}
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.target === event.currentTarget &&
          (event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom)
        )
          onClose();
      }}
    >
      <div className="modal-header">
        <h2 id={titleId}>{title}</h2>
        <Button
          variant="ghost"
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} aria-hidden="true" />
        </Button>
      </div>
      {children}
    </dialog>
  );
}
type StateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
};
export function EmptyState({ title, description, icon, action }: StateProps) {
  return (
    <div className="empty-state">
      <span className="state-icon" aria-hidden="true">
        {icon ?? <Inbox size={28} />}
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle size={22} className="spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
export function ErrorState({
  title = 'Something went wrong',
  description = 'Please try again.',
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={22} aria-hidden="true" />
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
