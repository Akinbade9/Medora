import { useEffect, useRef, useState } from 'react';
import type { PublicUser } from '@medora/shared-types';
import { apiRequest } from '../auth/client';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
} from '../components/ui';
import { Heading, Pager, PrescriptionStatus, displayDate } from './common';
import { ruleLabels } from './draft';
import { useResource } from './resource';
import type { Page, Patient, Prescription, Profile } from './types';
import { PatientDetails, PatientSearch } from './Patients';
import { PrescriptionForm } from './PrescriptionForm';
import './doctor.css';

function PrescriptionList({ items }: { items: Prescription[] }) {
  if (!items.length)
    return (
      <EmptyState
        title="No prescriptions yet"
        description="Start by selecting a patient and reviewing their prescription."
        action={
          <a
            className="button button--primary"
            href="#/doctor/new-prescription"
          >
            New Prescription
          </a>
        }
      />
    );
  return (
    <div className="doctor-list">
      {items.map((item) => (
        <Card key={item._id}>
          <div className="doctor-row">
            <h3>
              <a href={`#/doctor/prescriptions/${item._id}`}>
                {item.publicCode}
              </a>
            </h3>
            <PrescriptionStatus status={item.status} />
          </div>
          <p>
            {item.medications
              .map(
                (medicine) =>
                  `${medicine.genericName} ${medicine.strength} ${medicine.strengthUnit}`,
              )
              .join(' · ')}
          </p>
          <p className="doctor-muted">Issued {displayDate(item.issuedAt)}</p>
        </Card>
      ))}
    </div>
  );
}
function Home({ user }: { user: PublicUser }) {
  const prescriptions = useResource<Page<Prescription>>(
    'doctor/prescriptions?limit=5&page=1',
  );
  const profile = useResource<Profile>('doctor/profile');
  const attention =
    prescriptions.data?.items.filter(
      (item) => item.status === 'EXPIRED' || item.status === 'CANCELLED',
    ) ?? [];
  return (
    <>
      <Heading
        title={`Welcome, ${user.displayName}`}
        description="Your recent prescriptions and next steps, in one place."
      />
      <Card>
        <h2>Needs your attention</h2>
        {profile.loading && <LoadingState label="Checking profile…" />}
        {profile.error && (
          <ErrorState description={profile.error} onRetry={profile.reload} />
        )}
        {profile.data && !profile.data.canIssue && (
          <p>
            Your profile or hospital is not eligible for issuance.{' '}
            <a href="#/doctor/profile">Review your verification status</a>.
          </p>
        )}
        {attention.map((item) => (
          <p key={item._id}>
            <a href={`#/doctor/prescriptions/${item._id}`}>{item.publicCode}</a>{' '}
            is {item.status.toLowerCase()}.
          </p>
        ))}
        {profile.data?.canIssue && prescriptions.data && !attention.length && (
          <p>No issues identified among your recent prescriptions.</p>
        )}
        <a href="#/doctor/prescriptions">Open full prescription history</a>
      </Card>
      <section aria-label="Recent prescriptions">
        <div className="doctor-row">
          <h2>Recently issued</h2>
          <a href="#/doctor/new-prescription">+ New Prescription</a>
        </div>
        {prescriptions.loading && (
          <LoadingState label="Loading recent prescriptions…" />
        )}
        {prescriptions.error && (
          <ErrorState
            description={prescriptions.error}
            onRetry={prescriptions.reload}
          />
        )}
        {prescriptions.data && (
          <PrescriptionList items={prescriptions.data.items} />
        )}
      </section>
      <Card>
        <h2>Feedback</h2>
        <p>Patient feedback is not connected yet.</p>
        <a href="#/doctor/feedback">Open feedback placeholder</a>
      </Card>
    </>
  );
}
function History({ page }: { page: number }) {
  const result = useResource<Page<Prescription>>(
    `doctor/prescriptions?page=${page}&limit=10`,
  );
  return (
    <>
      <Heading
        title="Prescription history"
        description="Prescriptions issued by you, newest first."
      />
      {result.loading && <LoadingState />}
      {result.error && (
        <ErrorState description={result.error} onRetry={result.reload} />
      )}
      {result.data && (
        <>
          <PrescriptionList items={result.data.items} />
          <Pager
            data={result.data}
            onPage={(next) => {
              window.location.hash = `/doctor/prescriptions?page=${next}`;
            }}
          />
        </>
      )}
    </>
  );
}
function PatientSummary({ id }: { id: string }) {
  const patient = useResource<Patient>(`doctor/patients/${id}`);
  return (
    <div>
      <h2>Patient</h2>
      {patient.loading && <LoadingState label="Loading patient summary…" />}
      {patient.error && (
        <p>
          Patient summary is unavailable. The prescription remains available in
          your history.
        </p>
      )}
      {patient.data && (
        <>
          <p>
            <a href={`#/doctor/patients/${id}`}>{patient.data.displayName}</a>
          </p>
          <p>
            {patient.data.patientCode} · Born{' '}
            {patient.data.dateOfBirth.slice(0, 10)}
          </p>
        </>
      )}
    </div>
  );
}
function PrescriptionDetails({ id }: { id: string }) {
  const result = useResource<Prescription>(`doctor/prescriptions/${id}`);
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  async function cancel() {
    if (locked.current) return;
    if (
      !reason.trim() ||
      reason.trim().length > 1000 ||
      /\p{Cc}/u.test(reason)
    ) {
      setError('Enter a cancellation reason of 1–1,000 characters.');
      return;
    }
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      result.replace(
        await apiRequest<Prescription>(`doctor/prescriptions/${id}/cancel`, {
          cancellationReason: reason.trim(),
        }),
      );
      setConfirm(false);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  if (result.loading) return <LoadingState label="Loading prescription…" />;
  if (result.error)
    return <ErrorState description={result.error} onRetry={result.reload} />;
  if (!result.data) return null;
  const prescription = result.data;
  const displayedStatus =
    prescription.expiresAt &&
    new Date(prescription.expiresAt).getTime() <= now &&
    (prescription.status === 'ISSUED' || prescription.status === 'VIEWED')
      ? 'EXPIRED'
      : prescription.status;
  const eligible =
    prescription.isActive &&
    (!prescription.expiresAt ||
      new Date(prescription.expiresAt).getTime() > now) &&
    prescription.medications.every((item) => item.quantityDispensed === 0);
  return (
    <>
      <Heading
        title={prescription.publicCode}
        description="Prescription details"
      />
      <div className="doctor-row">
        <PrescriptionStatus status={displayedStatus} />
        <a href="#/doctor/prescriptions">Back to history</a>
      </div>
      <Card>
        <PatientSummary id={prescription.patientId} />
        <dl className="doctor-facts">
          <div>
            <dt>Issued</dt>
            <dd>{displayDate(prescription.issuedAt)}</dd>
          </div>
          <div>
            <dt>Expiry</dt>
            <dd>{displayDate(prescription.expiresAt)}</dd>
          </div>
          <div>
            <dt>Viewed</dt>
            <dd>{displayDate(prescription.viewedAt)}</dd>
          </div>
          {prescription.cancelledAt && (
            <>
              <div>
                <dt>Cancelled</dt>
                <dd>{displayDate(prescription.cancelledAt)}</dd>
              </div>
              <div>
                <dt>Cancellation reason</dt>
                <dd>{prescription.cancellationReason}</dd>
              </div>
            </>
          )}
        </dl>
      </Card>
      {prescription.medications.map((line, index) => (
        <Card key={line._id}>
          <h2>
            {index + 1}. {line.genericName} {line.strength} {line.strengthUnit}{' '}
            · {line.dosageForm}
          </h2>
          <dl className="doctor-facts">
            <div>
              <dt>Quantity</dt>
              <dd>{line.quantity}</dd>
            </div>
            <div>
              <dt>Instructions</dt>
              <dd>{line.dosageInstructions}</dd>
            </div>
            <div>
              <dt>Frequency</dt>
              <dd>{line.frequency}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{line.duration}</dd>
            </div>
            <div>
              <dt>Substitution</dt>
              <dd>{ruleLabels[line.substitutionRule]}</dd>
            </div>
            <div>
              <dt>Brand</dt>
              <dd>{line.brandName ?? 'No specific brand'}</dd>
            </div>
            <div>
              <dt>Quantity dispensed</dt>
              <dd>{line.quantityDispensed}</dd>
            </div>
          </dl>
        </Card>
      ))}
      {eligible && (
        <Button variant="danger" onClick={() => setConfirm(true)}>
          Cancel prescription
        </Button>
      )}
      <Modal
        open={confirm}
        onClose={() => {
          if (!busy) setConfirm(false);
        }}
        title="Confirm cancellation"
      >
        <p>Cancel {prescription.publicCode}? This cannot be undone.</p>
        <Input
          label="Cancellation reason"
          required
          maxLength={1000}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={busy}
        />
        {error && <ErrorState description={error} />}
        <div className="doctor-actions">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setConfirm(false)}
          >
            Keep prescription
          </Button>
          <Button variant="danger" loading={busy} onClick={() => void cancel()}>
            Confirm cancellation
          </Button>
        </div>
      </Modal>
    </>
  );
}
function DoctorProfile({ user }: { user: PublicUser }) {
  const result = useResource<Profile>('doctor/profile');
  return (
    <>
      <Heading
        title="Profile"
        description="Your professional details and verification status."
      />
      <Card>
        <h2>{user.displayName}</h2>
        <p>{user.email}</p>
        {result.loading && <LoadingState />}
        {result.error && (
          <ErrorState description={result.error} onRetry={result.reload} />
        )}
        {result.data && (
          <>
            <Badge
              tone={
                result.data.verificationStatus === 'VERIFIED'
                  ? 'success'
                  : 'warning'
              }
            >
              {result.data.verificationStatus}
            </Badge>
            <dl className="doctor-facts">
              <div>
                <dt>Registration number</dt>
                <dd>{result.data.professionalRegistrationNumber}</dd>
              </div>
              <div>
                <dt>Specialty</dt>
                <dd>{result.data.specialty}</dd>
              </div>
              <div>
                <dt>Hospital</dt>
                <dd>{result.data.hospital?.name ?? 'Unavailable'}</dd>
              </div>
              <div>
                <dt>Hospital status</dt>
                <dd>
                  {result.data.hospital?.verificationStatus ?? 'Unavailable'}
                </dd>
              </div>
            </dl>
          </>
        )}
        <p>
          Contact your administrator to correct professional or verification
          details.
        </p>
      </Card>
    </>
  );
}
function NewPrescription({ patientId }: { patientId: string | null }) {
  const profile = useResource<Profile>('doctor/profile');
  const patient = useResource<Patient>(
    patientId ? `doctor/patients/${patientId}` : null,
  );
  if (profile.loading || patient.loading)
    return <LoadingState label="Preparing prescription form…" />;
  if (profile.error)
    return <ErrorState description={profile.error} onRetry={profile.reload} />;
  if (patient.error)
    return (
      <>
        <ErrorState description={patient.error} onRetry={patient.reload} />
        <a href="#/doctor/new-prescription">Choose another patient</a>
      </>
    );
  return profile.data ? (
    <PrescriptionForm
      initialPatient={patient.data ?? null}
      profile={profile.data}
    />
  ) : null;
}
export function DoctorWorkspace({
  hash,
  user,
}: {
  hash: string;
  user: PublicUser;
}) {
  const [path, query = ''] = hash.replace(/^#\//, '').split('?');
  const [, page, id] = (path ?? '').split('/');
  const params = new URLSearchParams(query);
  const requestedPage = Number(params.get('page') ?? 1);
  const pageNumber =
    Number.isInteger(requestedPage) &&
    requestedPage > 0 &&
    requestedPage <= 10000
      ? requestedPage
      : 1;
  let screen;
  if (page === 'patients')
    screen = id ? (
      <PatientDetails key={id} id={id} />
    ) : (
      <>
        <Heading
          title="Patient search"
          description="Find the right patient before prescribing."
        />
        <Card>
          <PatientSearch />
        </Card>
      </>
    );
  else if (page === 'new-prescription')
    screen = (
      <NewPrescription
        key={params.get('patient') ?? 'new'}
        patientId={params.get('patient')}
      />
    );
  else if (page === 'prescriptions')
    screen = id ? (
      <PrescriptionDetails key={id} id={id} />
    ) : (
      <History page={pageNumber} />
    );
  else if (page === 'feedback')
    screen = (
      <>
        <Heading title="Feedback" />
        <Card>
          <EmptyState
            title="Patient feedback is not connected yet"
            description="This space will support questions and follow-up in a later phase."
          />
        </Card>
      </>
    );
  else if (page === 'profile') screen = <DoctorProfile user={user} />;
  else screen = <Home user={user} />;
  return <div className="doctor-content">{screen}</div>;
}
