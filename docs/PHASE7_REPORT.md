# Phase 7 — Doctor Dashboard

Implements the Phase 7 doctor web screens using the existing Medora tokens, Inter, Lucide, reusable components, sidebar, and authentication. No inventory, matching, reservations, orders, payments, patient prescription screens, or working feedback features were added. The specification and unrelated files were not modified.

## Screens and workflows

- Home: five recent prescriptions, real statuses, recent cancelled/expired items, verification eligibility, and feedback placeholder. No charts or analytics.
- Patient Search: paginated name/code search, minimum two characters, explicit selection with name, patient code, and date of birth.
- Patient Details: minimal identity summary and a prescription action preselecting the Patient profile `_id` (never the User ID).
- Create Prescription: patient selection; paginated catalogue search; up to 50 medicines; quantity, instructions, frequency, duration, substitution rule, paginated linked brand selection, and optional local expiry date/time.
- Review: full patient and medication summary, brand/rule/quantity/directions, expiry, back-to-edit, and explicit issuance.
- Prescription Details: prominent public code, patient summary, statuses and timestamps, medication snapshots, and eligible cancellation with reason/confirmation. Successful cancellation replaces the displayed record immediately and persists after reload.
- Prescription History: server pagination, newest first, links to details, ISSUED/VIEWED/CANCELLED/EXPIRED badges.
- Profile: current account, professional registration, specialty, hospital, and verification status. No profile editing or verification workflow.
- Feedback: placeholder only.

The prominent sidebar New Prescription action opens the real form. Routes use the existing hash navigation, including direct detail links and history pagination. Responsive layouts use existing theme tokens and labelled controls. Detail cancellation eligibility updates with time; the backend remains authoritative.

## API integration and request safety

Uses the existing Phase 6 APIs:

- `POST /api/doctor/prescriptions`
- `GET /api/doctor/prescriptions?page=1&limit=10`
- `GET /api/doctor/prescriptions/:id`
- `POST /api/doctor/prescriptions/:id/cancel`

Catalogue selection uses `GET /api/medicines/search?q=...` and `GET /api/medicines/:id/products`, with pagination. Inactive choices are disabled. The issue payload contains only patientId, medications (medicineId, optional medicineProductId, quantity, dosageInstructions, frequency, duration, substitutionRule), and optional expiresAt. Strength/form are displayed from the catalogue and filled by the server. Blank optional fields are omitted; no null, refillCount, User IDs, draft keys, or display-only fields are sent. Optional expiry is converted from local input time to ISO UTC. BRAND_SPECIFIC requires a matching active product; GENERIC_ALLOWED clears any product selection.

Validation runs before review and again before issuance. Server errors remain visible. Submission has an immediate in-memory lock against double clicks. Ambiguous network/5xx outcomes disable another issuance and link to history instead of automatically retrying. Drafts are not stored in localStorage or sessionStorage; leaving/refreshing discards them, as stated on the form. There is no resumable draft service or server idempotency feature.

The existing in-memory bearer token and HttpOnly refresh cookie are reused. A 401 triggers one shared refresh and a single retry; failed authentication returns to sign-in, and refreshed role data updates the existing role gate. Non-doctors are redirected to their existing workspace. No new authentication system or token persistence was introduced.

## Backend additions and justification

The prior API required Patient profile IDs but offered no doctor patient lookup or profile endpoint. Added read-only routes:

| Endpoint                                         | Purpose/access                                                                                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/doctor/profile`                        | DOCTOR only; own professional details, hospital summary, and computed canIssue. Also works for pending doctors so the UI can explain the restriction. |
| `GET /api/doctor/patients?q=...&page=1&limit=10` | Verified DOCTOR only; case-insensitive literal name/code search. Query length 2–100; bounded existing pagination.                                     |
| `GET /api/doctor/patients/:id`                   | Verified DOCTOR only; minimal active Patient summary for selection/details.                                                                           |

Patient responses contain exactly `_id` (Patient profile), displayName, patientCode, dateOfBirth. No User ID, email, password hash, address, preferences, or unrelated clinical records are returned. Search requires an existing active PATIENT User and uses an explicit projection. Responses use no-store caching. Search escapes regex input and has a five-second database limit. These routes provide identity selection, not an EHR or general account directory. Existing Phase 6 ownership and issuance rules are unchanged.

Extended API integration tests cover these routes, role/verification restrictions, projection, profile eligibility, pagination, literal search, and missing patients. The browser fixture server is test-only, uses disposable MongoDB, never reads `.env`, and adds no fixture setup routes to production.

## Dependencies and commands

Added **@playwright/test** as a web development dependency for real-browser workflow tests; Chromium was installed in the user test-browser cache. No production dependencies or new environment variables. Existing API test tooling supplies disposable MongoDB. The lockfile includes Playwright and its transitive packages.

```powershell
npm.cmd run dev:api
npm.cmd run dev:web
npm.cmd run lint --workspace @medora/web-dashboard
npm.cmd run typecheck --workspace @medora/web-dashboard
npm.cmd test --workspace @medora/api
npm.cmd exec --workspace @medora/web-dashboard -- playwright install chromium
npm.cmd test --workspace @medora/web-dashboard
```

For normal use, existing API/web environment settings must point to each other with a trusted WEB_ORIGINS entry. A real Doctor account needs a VERIFIED profile and eligible hospital to issue; existing development seed doctors remain PENDING. Follow the Phase 6 development-only fixture instructions if needed. Actual `.env` files, existing verification statuses, and the configured database were left untouched.

Browser tests use local ports 5299 (Vite) and 3299 (API), refusing reuse of already-running servers. Test artifacts/screenshots live under ignored `.tmp`. They test the real Express implementation and database for patient search, issuance, persistence, cancellation, history, and profile. Selected HTTP responses are intercepted only for deterministic invalid-session, token-refresh, and server-error UI checks. Verification is against an isolated API instance, not your configured live data.

## Changed files

Created:

- `apps/api/src/doctor/routes.ts`
- `apps/api/tests/doctor-browser-server.ts`
- `apps/web-dashboard/src/doctor/types.ts`
- `apps/web-dashboard/src/doctor/draft.ts`
- `apps/web-dashboard/src/doctor/resource.ts`
- `apps/web-dashboard/src/doctor/common.tsx`
- `apps/web-dashboard/src/doctor/Patients.tsx`
- `apps/web-dashboard/src/doctor/PrescriptionForm.tsx`
- `apps/web-dashboard/src/doctor/DoctorWorkspace.tsx`
- `apps/web-dashboard/src/doctor/doctor.css`
- `apps/web-dashboard/tests/doctor.spec.ts`
- `apps/web-dashboard/playwright.config.ts`
- `docs/PHASE7_REPORT.md`

Modified:

- `apps/api/src/app.ts`
- `apps/api/tests/prescriptions.test.ts`
- `apps/web-dashboard/src/App.tsx`
- `apps/web-dashboard/src/auth/client.ts`
- `apps/web-dashboard/src/auth/useAuth.ts`
- `apps/web-dashboard/src/layouts/DashboardLayout.tsx`
- `apps/web-dashboard/src/layouts/navigation.ts`
- `apps/web-dashboard/package.json`
- `apps/web-dashboard/tsconfig.json`
- `package-lock.json`
- `README.md`

The working tree was clean at task start. No unrelated pre-existing edits were changed or reverted.

## Verification

- API tests: **54 passed**, including the new doctor lookup/access tests and existing Phase 6 prescription tests.
- Web tests: **6 passed**, covering payload validation, real issuance/cancellation, patient identity selection, server errors, pagination, profile, responsive layout, role restrictions, session expiry/refresh, and unverified doctors.
- Repository lint, all workspace TypeScript checks, and repository formatting check: passed.
- Web production build and `git diff --check`: passed.
- API and Vite dashboard startup: confirmed through the browser test servers. Actual prescription API/database integration was exercised with disposable fictional data; the configured database was not used.
- Desktop detail/review and mobile dashboard screenshots were visually inspected.
