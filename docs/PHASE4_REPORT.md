# Phase 4 — Core Domain Models

Scope: Patient, Doctor, Hospital, Pharmacy, server-side schema validation, indexes, and fictional development data. No domain routes, UI changes, verification workflows, prescriptions, catalogue, inventory, matching, or payments were added. `MEDORA_SPEC.md` remains unchanged and authoritative.

## Models and relationships

- Patient: unique `userId` referencing a PATIENT User; unique normalized `patientCode` (generated `PT-` plus 20 random hexadecimal characters by default); required non-future `dateOfBirth` and `gender`; up to ten labelled `savedAddresses`; push/email/SMS `notificationPreferences`. Gender values are FEMALE, MALE, OTHER, PREFER_NOT_TO_SAY.
- Doctor: unique `userId` referencing a DOCTOR User; required indexed `hospitalId` referencing an existing Hospital; unique normalized `professionalRegistrationNumber`; required specialty; verification status.
- Hospital: name, structured address, international phone, normalized email, verification status, and up to twenty verification document metadata records. Metadata contains kind, file name, private storage key, MIME type, byte size, and upload timestamp. No files are uploaded or fabricated. Metadata is excluded from ordinary database reads; trusted future code must explicitly select it.
- Pharmacy: indexed `adminUserId` referencing a PHARMACY_ADMIN User; name; unique normalized `licenceNumber`; address; required GeoJSON `location`; international phone; email; verification status; pickup/delivery booleans; IANA `timeZone`; weekly `operatingHours`; nullable `inventoryLastUpdatedAt`. One administrator may own multiple pharmacies. Staff membership is deferred. No invented reliability scores are stored.

Doctor, Hospital, and Pharmacy verification statuses are PENDING (default), VERIFIED, SUSPENDED, REJECTED. They are indexed for future filtering. Existing `User.active` remains the authentication account switch; domain verification statuses do not implement access policy or verification workflows.

Address fields: line1, optional line2, city, state, optional postalCode, two-letter countryCode. Phones require international `+` format. Identifiers trim outer whitespace and uppercase; registration/licence identifiers allow letters, digits, `/`, and `-`.

Coordinates are `[longitude, latitude]`, bounded to ±180/±90, with a MongoDB `2dsphere` index. Hours use day 0 (Sunday) through 6 (Saturday), at most one entry per day. An empty schedule means unspecified. Open entries require `HH:mm` times; `closesNextDay` supports overnight intervals up to 24 hours. Closed entries cannot include times. Future inventory timestamps are rejected; no inventory logic exists.

All four collections have creation/update timestamps, strict unknown-field rejection, and optimistic concurrency for document saves. Unique indexes enforce duplicate protection in MongoDB, including simultaneous writes, and API startup awaits index initialization.

## Validation boundaries

Use `Model.create()` or load a document, edit it, and call `save()`. Mongoose schema validation checks fields, nested values, and referenced users/hospitals. Query updates/replacements and bulk writes are rejected for these domain models to avoid partial validation bypasses. [Mongoose documents these update-validation limitations](https://mongoosejs.com/docs/validation.html).

The trusted `user:role` command checks existing profiles before changing a role. MongoDB has no automatic foreign-key constraints: direct collection writes/deletions and concurrent external role changes can bypass application checks. No deletion or profile-management workflow is introduced. Future writers must preserve these relationships, and future API serializers must explicitly select public fields. Public registration continues to create a User only because required profile data is not collected yet.

## Development seed

Set these values in `apps/api/.env` (actual local environment files were not modified):

- `MONGODB_URI`: a dedicated development database.
- `NODE_ENV=development`: required; other environments are rejected.
- `SEED_PASSWORD`: a unique 12–128 character password, required only by the seed command. No default password exists.

From the repository root:

```powershell
npm.cmd run seed:dev --workspace @medora/api
```

Creates four fictional accounts: `patient@medora.example.test`, `doctor@medora.example.test`, `pharmacy@medora.example.test`, `admin@medora.example.test`. It also creates one Patient, Doctor, Hospital, and Pharmacy, with stable fixture IDs and clearly fictional names, addresses, and professional identifiers. Accounts use the supplied password through the existing secure password hasher. Professional verification stays PENDING; document metadata arrays and inventory timestamps start empty/null.

Reruns insert missing fixtures and preserve existing passwords and edits. Conflicting account identities or roles fail without overwriting them. The seed is sequential, not transactional; interrupted runs can be rerun. It is never executed automatically on API startup. Tests use disposable MongoDB; the configured user database was not seeded. Remove `SEED_PASSWORD` after use.

## Dependencies

No new dependencies or lockfile changes. Uses existing Mongoose, Zod, Node crypto, and MongoDB memory server test tooling.

## Changed files

Created:

- `apps/api/src/domain/common.ts`
- `apps/api/src/domain/patient.ts`
- `apps/api/src/domain/doctor.ts`
- `apps/api/src/domain/hospital.ts`
- `apps/api/src/domain/pharmacy.ts`
- `apps/api/src/domain/index.ts`
- `apps/api/src/domain/relationships.ts`
- `apps/api/src/domain/seed-data.ts`
- `apps/api/src/domain/seed.ts`
- `apps/api/tests/domain.test.ts`
- `docs/PHASE4_REPORT.md`

Modified:

- `apps/api/src/server.ts` — initialize domain indexes before listening.
- `apps/api/src/auth/set-role.ts` — reject role changes conflicting with profiles.
- `apps/api/package.json` — development seed command.
- `apps/api/.env.example` — seed setting; replace exposed connection credentials/JWT secret with safe placeholders.
- `README.md` — Phase 4 scope and seed instructions.

The tracked API environment example contained live-looking credentials. Replacing them does not remove earlier Git history; rotate the exposed MongoDB credentials and JWT signing secret. Actual `.env` files were left untouched.

## Verification

- `npm.cmd test` — 33 tests passed (22 existing and 11 new domain/seed tests). Covers required fields, nested validation, role/existence checks, doctor and pharmacy uniqueness, concurrent duplicate licences, GeoJSON index use, write validation, role compatibility, and repeatable seed behavior.
- `npm.cmd run lint` — passed with no warnings.
- `npm.cmd run typecheck` — passed in all five workspaces.
- `npm.cmd run format:check` — passed.
- `npm.cmd run build --workspace @medora/api` — passed.
- Built API startup smoke test against disposable MongoDB — passed: health HTTP 200 after domain index initialization, account persistence across restart, login, authenticated `/me`, trusted role assignment/session revocation, and role-restricted access.
- `git diff --check` — passed. Test database and smoke-test processes were stopped. No permanent database was changed; no frontend startup was required for this backend-only phase.
