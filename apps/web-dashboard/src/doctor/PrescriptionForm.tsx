import { useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ApiError, apiRequest } from '../auth/client';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Select,
} from '../components/ui';
import type {
  DraftLine,
  Medicine,
  Page,
  Patient,
  Prescription,
  Product,
  Profile,
  Rule,
} from './types';
import { useResource } from './resource';
import { buildIssueBody, ruleLabels } from './draft';
import { Heading, Pager } from './common';
import { PatientSearch } from './Patients';

function ProductPicker({
  line,
  onChange,
}: {
  line: DraftLine;
  onChange: (line: DraftLine) => void;
}) {
  const [page, setPage] = useState(1);
  const result = useResource<Page<Product>>(
    `medicines/${line.medicine._id}/products?page=${page}&limit=20`,
  );
  if (result.loading) return <LoadingState label="Loading brands…" />;
  if (result.error)
    return <ErrorState description={result.error} onRetry={result.reload} />;
  const products = [
    ...new Map(
      [
        ...(line.product ? [line.product] : []),
        ...(result.data?.items ?? []),
      ].map((product) => [product._id, product]),
    ).values(),
  ];
  return (
    <>
      <Select
        label="Brand product"
        value={line.product?._id ?? ''}
        required={line.substitutionRule === 'BRAND_SPECIFIC'}
        onChange={(event) =>
          onChange({
            ...line,
            product: products.find(
              (product) => product._id === event.target.value,
            ),
          })
        }
      >
        <option value="">
          {line.substitutionRule === 'BRAND_SPECIFIC'
            ? 'Select a required brand'
            : 'No specific brand'}
        </option>
        {products.map((product) => (
          <option
            key={product._id}
            value={product._id}
            disabled={product.status !== 'ACTIVE'}
          >
            {product.brandName} · {product.manufacturer} · {product.packSize}
            {product.status !== 'ACTIVE' ? ' (inactive)' : ''}
          </option>
        ))}
      </Select>
      {result.data && result.data.total > result.data.limit && (
        <Pager data={result.data} onPage={setPage} />
      )}
      {result.data?.total === 0 && (
        <p>No products are available for this medicine.</p>
      )}
    </>
  );
}
function MedicineSearch({
  onAdd,
  disabled,
}: {
  onAdd: (medicine: Medicine) => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState({ q: '', page: 1 });
  const result = useResource<Page<Medicine>>(
    search.q
      ? `medicines/search?q=${encodeURIComponent(search.q)}&page=${search.page}&limit=10`
      : null,
  );
  return (
    <section aria-label="Medicine catalogue">
      <form
        className="doctor-search"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch({ q: query.trim(), page: 1 });
        }}
      >
        <Input
          label="Search medicine catalogue"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          required
          maxLength={100}
          hint="Search generic name, active ingredient, or brand."
        />
        <Button type="submit" loading={result.loading}>
          Search medicines
        </Button>
      </form>
      {result.loading && <LoadingState label="Searching medicines…" />}
      {result.error && (
        <ErrorState description={result.error} onRetry={result.reload} />
      )}
      {result.data && (
        <>
          {!result.data.items.length && (
            <EmptyState title="No medicines found" />
          )}
          <div className="doctor-results">
            {result.data.items.map((medicine) => (
              <Card key={medicine._id}>
                <h3>
                  {medicine.genericName} {medicine.strength}{' '}
                  {medicine.strengthUnit}
                </h3>
                <p>
                  {medicine.dosageForm} · {medicine.activeIngredient}
                </p>
                <Button
                  variant="secondary"
                  disabled={disabled || medicine.status !== 'ACTIVE'}
                  onClick={() => onAdd(medicine)}
                >
                  <Plus size={16} aria-hidden="true" />
                  {medicine.status === 'ACTIVE'
                    ? 'Add medicine'
                    : 'Inactive medicine'}
                </Button>
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
export function PrescriptionForm({
  initialPatient,
  profile,
}: {
  initialPatient: Patient | null;
  profile: Profile;
}) {
  const [patient, setPatient] = useState(initialPatient);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [expiry, setExpiry] = useState('');
  const [review, setReview] = useState(false);
  const [error, setError] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const locked = useRef(false);
  function update(line: DraftLine) {
    setLines((current) =>
      current.map((item) => (item.key === line.key ? line : item)),
    );
  }
  function reviewDraft() {
    try {
      buildIssueBody(patient, lines, expiry);
      setError('');
      setReview(true);
      window.scrollTo(0, 0);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  async function issue() {
    if (locked.current) return;
    locked.current = true;
    setIssuing(true);
    setError('');
    try {
      const body = buildIssueBody(patient, lines, expiry);
      const result = await apiRequest<Prescription>(
        'doctor/prescriptions',
        body,
      );
      window.location.hash = `/doctor/prescriptions/${result._id}`;
    } catch (cause) {
      setError((cause as Error).message);
      if (
        cause instanceof ApiError &&
        (cause.status === 0 || cause.status >= 500)
      )
        setUncertain(true);
    } finally {
      locked.current = false;
      setIssuing(false);
    }
  }
  if (!profile.canIssue)
    return (
      <>
        <Heading title="New prescription" />
        <ErrorState
          title="Issuance is unavailable"
          description="Your doctor profile must be verified and linked to an eligible hospital. Contact your administrator."
        />
        <a href="#/doctor/profile">View profile</a>
      </>
    );
  if (review)
    return (
      <>
        <Heading
          title="Review prescription"
          description="Check the patient and every medication before issuing."
        />
        {error && <ErrorState description={error} />}
        <Card>
          <Badge tone="info">Not issued yet</Badge>
          <h2>{patient?.displayName}</h2>
          <p>
            {patient?.patientCode} · Born {patient?.dateOfBirth.slice(0, 10)}
          </p>
          <p>
            Expiry:{' '}
            {expiry ? new Date(expiry).toLocaleString() : 'No expiry set'}
          </p>
        </Card>
        {lines.map((line, index) => (
          <Card key={line.key}>
            <h2>
              {index + 1}. {line.medicine.genericName} {line.medicine.strength}{' '}
              {line.medicine.strengthUnit} · {line.medicine.dosageForm}
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
                <dd>{line.product?.brandName ?? 'No specific brand'}</dd>
              </div>
            </dl>
          </Card>
        ))}
        <div className="doctor-actions">
          <Button
            variant="secondary"
            disabled={issuing || uncertain}
            onClick={() => setReview(false)}
          >
            Back to edit
          </Button>
          <Button
            loading={issuing}
            disabled={uncertain}
            onClick={() => void issue()}
          >
            Issue prescription
          </Button>
          <a href="#/doctor/prescriptions">
            {uncertain
              ? 'Check history before creating another prescription'
              : 'Prescription history'}
          </a>
        </div>
      </>
    );
  return (
    <>
      <Heading
        title="Create prescription"
        description="Select a patient, add medicines, then review before issuing."
      />
      {error && <ErrorState description={error} />}
      <Card>
        <h2>1. Patient</h2>
        {patient ? (
          <div>
            <h3>{patient.displayName}</h3>
            <p>
              {patient.patientCode} · Born {patient.dateOfBirth.slice(0, 10)}
            </p>
            <Button variant="secondary" onClick={() => setPatient(null)}>
              Change patient
            </Button>
          </div>
        ) : (
          <PatientSearch onSelect={setPatient} />
        )}
      </Card>
      <Card>
        <h2>2. Medicines</h2>
        <MedicineSearch
          disabled={lines.length >= 50}
          onAdd={(medicine) =>
            setLines((current) => [
              ...current,
              {
                key: crypto.randomUUID(),
                medicine,
                quantity: '',
                dosageInstructions: '',
                frequency: '',
                duration: '',
                substitutionRule: 'GENERIC_ALLOWED',
              },
            ])
          }
        />
      </Card>
      {lines.map((line, index) => (
        <Card key={line.key}>
          <fieldset className="doctor-medication">
            <legend>
              {index + 1}. {line.medicine.genericName} {line.medicine.strength}{' '}
              {line.medicine.strengthUnit} · {line.medicine.dosageForm}
            </legend>
            <div className="doctor-form-grid">
              <Input
                label="Quantity"
                type="number"
                min={1}
                max={100000}
                step={1}
                required
                value={line.quantity}
                onChange={(event) =>
                  update({ ...line, quantity: event.target.value })
                }
                hint="Individual medicine units, not packs."
              />
              <Select
                label="Substitution rule"
                value={line.substitutionRule}
                onChange={(event) =>
                  update({
                    ...line,
                    substitutionRule: event.target.value as Rule,
                    ...(event.target.value === 'GENERIC_ALLOWED'
                      ? { product: undefined }
                      : {}),
                  })
                }
              >
                {Object.entries(ruleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Input
                label="Dosage instructions"
                required
                maxLength={2000}
                value={line.dosageInstructions}
                onChange={(event) =>
                  update({ ...line, dosageInstructions: event.target.value })
                }
              />
              <Input
                label="Frequency"
                required
                maxLength={200}
                value={line.frequency}
                onChange={(event) =>
                  update({ ...line, frequency: event.target.value })
                }
              />
              <Input
                label="Duration"
                required
                maxLength={200}
                value={line.duration}
                onChange={(event) =>
                  update({ ...line, duration: event.target.value })
                }
              />
            </div>
            {line.substitutionRule !== 'GENERIC_ALLOWED' && (
              <ProductPicker line={line} onChange={update} />
            )}
            <Button
              variant="ghost"
              onClick={() =>
                setLines((current) =>
                  current.filter((item) => item.key !== line.key),
                )
              }
            >
              <Trash2 size={16} aria-hidden="true" />
              Remove medicine {index + 1}
            </Button>
          </fieldset>
        </Card>
      ))}
      <Card>
        <h2>3. Expiry and review</h2>
        <Input
          label="Expiry (optional)"
          type="datetime-local"
          value={expiry}
          onChange={(event) => setExpiry(event.target.value)}
          hint="Your local date and time. Leave blank when not applicable."
        />
        <p>
          Your draft stays in this page only. Leaving or refreshing discards it.
        </p>
        <Button onClick={reviewDraft}>Review prescription</Button>
      </Card>
    </>
  );
}
