# Phase 6 — Prescription Engine

Backend-only implementation following `MEDORA_SPEC.md`. No Phase 7 dashboard, patient search UI, matching, inventory, dispensing workflow, reservations, orders, payments, or verification administration was added.

## Model and authorization

Prescription stores `_id`, unique `publicCode`, Patient/Doctor/Hospital references, status, issuedAt, nullable expiresAt/viewedAt/cancelledAt/cancellationReason, medications, createdAt, and updatedAt. Public codes use `RX-YY-XXXXXXXX`: UTC issue year plus eight securely sampled random symbols (40 random bits), with no patient data. The allocator checks for collisions, retries duplicate-key races, and stops after ten attempts. MongoDB enforces a unique index. Codes are display identifiers, not credentials or public access links; detail routes use the internal `_id` and require ownership.

Only an authenticated DOCTOR with a VERIFIED Doctor profile and active User can issue. The server derives doctorId and hospitalId from that profile. The Hospital must exist and cannot be SUSPENDED or REJECTED; PENDING hospital verification alone does not prevent issuance by a verified doctor. The Patient must exist and reference an active PATIENT User. The server revalidates relationships during creation. These are application-level checks, not cross-collection transactional locks against external administrative mutations.

Doctor read/list/cancel operations are restricted to that doctor's profile. A doctor who later becomes unverified can still read and cancel their own active, undispensed records; they cannot issue new ones. Patients can list/view only their own prescriptions. Foreign ownership returns 404, with no admin or pharmacy access bypass. All responses use no-store caching. No endpoint edits issued clinical fields or deletes prescriptions.

Medication entries store medicineId, nullable medicineProductId, strength, strengthUnit, dosageForm, integer quantity (individual medicine units, not product packs), dosageInstructions, frequency, duration, substitutionRule, and quantityDispensed (initially zero). Generic name, active ingredient, and optional brand name are snapshots, so later catalogue edits do not rewrite an issued prescription. Medicine and optional product must exist and be ACTIVE at issuance; a product must belong to that medicine. Strength/form are populated from the catalogue; optional client-supplied values must match. Issued clinical data is also protected against changes through document saves.

- GENERIC_ALLOWED: no product reference; selects the generic definition.
- BRAND_SPECIFIC: requires a matching active product reference.
- DO_NOT_SUBSTITUTE: preserves the exact selected medicine, plus the product if specified. No substitution/matching execution exists in this phase.

Request schemas reject unknown and server-owned fields, including publicCode, doctorId, hospitalId, status, quantityDispensed, and refillCount. Refills are not supported. Requests support 1–50 medication entries. Quantity is a positive integer, at most 100,000; instructions/frequency/duration are required bounded text. This validates software structure and catalogue consistency, not clinical appropriateness or dosing safety.

## Lifecycle and concurrency

States: ISSUED, VIEWED, CANCELLED, EXPIRED. Issuance is immediate (no draft API). Expiry is optional and must follow issuance; no universal expiry period is assumed. First patient detail retrieval changes an active ISSUED prescription to VIEWED and records viewedAt. Lists and doctor reads do not mark viewed. Repeat patient views preserve the timestamp. Cancelled and expired reads cannot reactivate records.

`isPrescriptionActive()` checks both status and expiry on every use, even before EXPIRED is persisted. Expiry is materialized on scoped detail/list reads or cancellation attempts. No background scheduler or TTL deletion is introduced. Cancelled status takes precedence over later expiry. Responses include `isActive`.

Cancellation requires the issuing doctor, a nonblank reason, an active unexpired prescription, and zero quantityDispensed on every line. It records cancelledAt and cancellationReason. Already cancelled/expired/dispensed records return 409. Document version checks and bounded retries prevent concurrent viewing from overwriting cancellation. No dispensing endpoint exists; future trusted dispensing writers must participate in version/concurrency control. Raw database writes bypass model protections and are used only in tests to simulate elapsed time/dispensed records.

Indexes cover unique public code, doctor + issue date + ID, patient + issue date + ID, and status + expiry. Startup awaits index initialization. Both lists use page (default 1, maximum 10,000) and limit (default 20, maximum 100), ordered newest issuedAt then _id, returning `{ items, page, limit, total }`.

## Postman setup and exact endpoints

Use `baseUrl=http://127.0.0.1:3000` or your configured host/port. Start the API using `npm.cmd run dev:api`.

For each account, `POST {{baseUrl}}/api/auth/login` with headers `Content-Type: application/json` and `X-Medora-Client: native`, no Origin header, and raw JSON:

```json
{ "email": "YOUR_ACCOUNT_EMAIL", "password": "YOUR_PASSWORD" }
```

Store returned accessToken locally as `doctorToken` or `patientToken`. Use Authorization → Bearer Token with the appropriate token below. Do not submit a role in login/registration bodies.

| Method | Exact endpoint                                                   | Token        | Expected                              |
| ------ | ---------------------------------------------------------------- | ------------ | ------------------------------------- |
| POST   | `{{baseUrl}}/api/doctor/prescriptions`                           | doctorToken  | 201 ISSUED                            |
| GET    | `{{baseUrl}}/api/doctor/prescriptions?page=1&limit=20`           | doctorToken  | 200; own issued records               |
| GET    | `{{baseUrl}}/api/doctor/prescriptions/{{prescriptionId}}`        | doctorToken  | 200; own record                       |
| POST   | `{{baseUrl}}/api/doctor/prescriptions/{{prescriptionId}}/cancel` | doctorToken  | 200 CANCELLED if active/undispensed   |
| GET    | `{{baseUrl}}/api/patient/prescriptions?page=1&limit=20`          | patientToken | 200; own records                      |
| GET    | `{{baseUrl}}/api/patient/prescriptions/{{prescriptionId}}`       | patientToken | 200; first active view records VIEWED |

Issue sample, raw JSON (software test text only, not medical instructions):

```json
{
  "patientId": "{{patientId}}",
  "medications": [
    {
      "medicineId": "{{medicineId}}",
      "quantity": 10,
      "dosageInstructions": "Development fixture instructions only",
      "frequency": "Development test frequency",
      "duration": "Development test duration",
      "substitutionRule": "GENERIC_ALLOWED"
    }
  ]
}
```

`patientId` is a Patient profile `_id`, not a User ID. Obtain it from your authorized development database tooling; no patient search endpoint is added early. Obtain an ACTIVE `medicineId` using the authenticated Phase 5 catalogue APIs. Save the issue response `_id` as `prescriptionId`; `publicCode` is the human-readable code. To specify expiry, add `"expiresAt":"{{futureIsoTimestamp}}"` with a future ISO date/time including timezone. Omit it when expiry is not applicable.

For BRAND_SPECIFIC, set the line's `substitutionRule` to `BRAND_SPECIFIC` and add `"medicineProductId":"{{medicineProductId}}"`. Obtain that ID from `GET {{baseUrl}}/api/medicines/{{medicineId}}/products`. DO_NOT_SUBSTITUTE may include the product when retaining a specific brand. For optional `strength` and `dosageForm`, copy the exact catalogue values; they must match.

Cancel sample:

```json
{ "cancellationReason": "Fictional development prescription issued in error" }
```

Manual negative checks: no token → 401; patient issuing/cancelling via doctor routes → 403; unverified doctor issuing → 403; another patient's/doctor's detail ID → 404; attempted PATCH/DELETE → 404 (no such API); injected clinical/server-owned fields or invalid medicine/product reference → 400; missing BRAND_SPECIFIC product → 400; mismatched product → 400; cancellation after expiry/cancellation/any dispensing → 409. A cancelled record must remain CANCELLED with isActive=false after patient viewing. All fictional examples are development-only.

## Seed and development verification prerequisites

The existing development seed is unchanged. It creates PENDING doctors deliberately; this phase does not silently grant professional verification or insert prescriptions. Use an authorized development-only database session to mark a fictional Doctor fixture VERIFIED before testing successful issuance. This is manual fixture preparation, not an application verification workflow. Never use real patient data for this demonstration.

If using the existing seeded account, this mongosh statement in your dedicated development database verifies only its fictional Doctor profile:

```javascript
const demoDoctor = db.users.findOne({ email: 'doctor@medora.example.test' });
if (!demoDoctor) throw new Error('Seeded doctor account missing');
db.doctors.updateOne(
  { userId: demoDoctor._id },
  { $set: { verificationStatus: 'VERIFIED' } },
);
```

This fixture preparation was not run against your configured database. Tests create verified fictional fixtures in disposable MongoDB. No permanent seed/database changes are needed for automated verification.

## Files and dependencies

Created:

- `apps/api/src/prescriptions/code.ts`
- `apps/api/src/prescriptions/validation.ts`
- `apps/api/src/prescriptions/model.ts`
- `apps/api/src/prescriptions/service.ts`
- `apps/api/src/prescriptions/routes.ts`
- `apps/api/tests/prescriptions.test.ts`
- `docs/PHASE6_REPORT.md`

Modified:

- `apps/api/src/app.ts` — mount prescription routes.
- `apps/api/src/server.ts` — initialize prescription indexes.
- `README.md` — Phase 6 scope and testing guide.

No new dependencies or environment variables; uses existing Mongoose, Zod, Express, test tooling, and Node crypto. No frontend or unrelated files changed.

## Verification

- `npm.cmd test` — 53/53 tests passed, including 12 new prescription tests. Coverage includes multiple medications, verified-doctor issuance, invalid references and injected fields, all substitution rules, ownership, no patient editing, unique-index enforcement, collision retries, terminal cancellation, concurrent viewing/cancellation, dispensing guard, expiry, and immutable catalogue snapshots.
- `npm.cmd run lint` — passed without warnings.
- `npm.cmd run typecheck` — passed across all five workspaces.
- `npm.cmd run format:check` — passed.
- `npm.cmd run build --workspace @medora/api` — passed.
- Built API startup smoke test using disposable MongoDB — passed: prescription indexes initialize, health responds HTTP 200, account/login persistence across restart works, and authenticated access and role restrictions continue to work. Temporary server/database processes were stopped afterward.
- `git diff --check` — passed. No existing development seed, actual environment files, permanent database, or unrelated files were modified.
