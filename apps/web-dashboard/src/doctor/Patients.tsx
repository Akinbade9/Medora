import { useState } from 'react';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
} from '../components/ui';
import { useResource } from './resource';
import { Heading, Pager } from './common';
import type { Page, Patient } from './types';

export function PatientSearch({
  onSelect,
}: {
  onSelect?: (patient: Patient) => void;
}) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState({ q: '', page: 1 });
  const result = useResource<Page<Patient>>(
    search.q
      ? `doctor/patients?q=${encodeURIComponent(search.q)}&page=${search.page}&limit=10`
      : null,
  );
  return (
    <section aria-label="Patient search">
      <form
        className="doctor-search"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch({ q: query.trim(), page: 1 });
        }}
      >
        <Input
          label="Patient name or patient code"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          required
          minLength={2}
          maxLength={100}
          hint="Enter at least two characters. Confirm the patient’s code and date of birth."
        />
        <Button type="submit" loading={result.loading}>
          Search patients
        </Button>
      </form>
      {result.loading && <LoadingState label="Searching patients…" />}
      {result.error && (
        <ErrorState description={result.error} onRetry={result.reload} />
      )}
      {!search.q && (
        <EmptyState
          title="Find a patient"
          description="Search by name or patient code to select the right person."
        />
      )}
      {result.data && (
        <>
          {!result.data.items.length && (
            <EmptyState
              title="No patients found"
              description="Check the name or patient code and search again."
            />
          )}
          <div className="doctor-results">
            {result.data.items.map((patient) => (
              <Card key={patient._id}>
                <h3>{patient.displayName}</h3>
                <p>
                  {patient.patientCode} · Born{' '}
                  {patient.dateOfBirth.slice(0, 10)}
                </p>
                {onSelect ? (
                  <Button onClick={() => onSelect(patient)}>
                    Select {patient.displayName}
                  </Button>
                ) : (
                  <a href={`#/doctor/patients/${patient._id}`}>View patient</a>
                )}
              </Card>
            ))}
          </div>
          <Pager
            data={result.data}
            onPage={(page) => setSearch({ ...search, page })}
          />
        </>
      )}
    </section>
  );
}
export function PatientDetails({ id }: { id: string }) {
  const result = useResource<Patient>(`doctor/patients/${id}`);
  if (result.loading) return <LoadingState label="Loading patient…" />;
  if (result.error)
    return <ErrorState description={result.error} onRetry={result.reload} />;
  if (!result.data) return null;
  const patient = result.data;
  return (
    <>
      <Heading
        title={patient.displayName}
        description="Confirm these details before creating a prescription."
      />
      <Card>
        <dl className="doctor-facts">
          <div>
            <dt>Patient code</dt>
            <dd>{patient.patientCode}</dd>
          </div>
          <div>
            <dt>Date of birth</dt>
            <dd>{patient.dateOfBirth.slice(0, 10)}</dd>
          </div>
        </dl>
        <a
          className="button button--primary"
          href={`#/doctor/new-prescription?patient=${patient._id}`}
        >
          New prescription for this patient
        </a>
      </Card>
      <a href="#/doctor/patients">Back to patient search</a>
    </>
  );
}
