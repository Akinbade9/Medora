# Medora

Phases 1–5: project foundation, design system/base layouts, authentication/RBAC, core domain models, and medicine catalogue. [The Medora specification](docs/MEDORA_SPEC.md) is the source of truth. Later phases require separate implementation work.

## Workspace

| Path                    | Purpose                                             |
| ----------------------- | --------------------------------------------------- |
| `apps/api`              | Node.js, Express, TypeScript API                    |
| `apps/web-dashboard`    | React, Vite, TypeScript web placeholder             |
| `apps/patient-mobile`   | React Native, Expo, TypeScript mobile placeholder   |
| `packages/shared-types` | Compile-time API response types                     |
| `packages/validation`   | Empty shared-validation workspace for future phases |
| `docs`                  | Project specification and documentation             |

## Requirements and installation

- Node.js 22.13+ in the 22.x line, or Node.js 24.3+; npm 10+.
- A running MongoDB instance or MongoDB connection URI for authentication and core domain collections. Tests start a separate disposable MongoDB instance automatically.
- Expo Go compatible with SDK 57 on a device, or an Android emulator, to view the mobile app. The iOS simulator requires macOS and Xcode.

Run commands from the repository root. On Windows PowerShell use `npm.cmd` (as below) if execution policy blocks `npm.ps1`. On other shells, `npm` works instead.

```powershell
npm.cmd ci
```

Copy `apps/api/.env.example` to `apps/api/.env` unless that file already exists, then set `MONGODB_URI` and `JWT_ACCESS_SECRET`. Generate a signing secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste its 64-character value into the API `.env`. Do not commit it. The API fails closed if required configuration is missing or MongoDB is unavailable. Default network settings are `HOST=127.0.0.1`, `PORT=3000`, and `NODE_ENV=development`.

Each app has an `.env.example`. Vite's `VITE_*` and Expo's `EXPO_PUBLIC_*` values are included in client bundles and must never contain secrets. The root `.env.example` documents where app settings belong.

## Start development

Run each command in a separate terminal:

```powershell
npm.cmd run dev:api
npm.cmd run dev:web
npm.cmd run dev:mobile
```

- API: <http://127.0.0.1:3000/api/health>
- Web: <http://127.0.0.1:5173>
- Mobile: scan the terminal QR code with compatible Expo Go, or press `a` for an installed Android emulator. Press `w` for the patient app's web rendering. Authentication requires the API. For a physical device, set `EXPO_PUBLIC_API_URL` to your computer's LAN address and configure the API's `HOST=0.0.0.0` on your trusted development network. Android emulators normally reach the host using `10.0.2.2`.

## Sign in and navigate

The web and patient apps open with login/registration screens. Registration always creates a `PATIENT`; submitted role fields are rejected. A trusted operator can assign a professional role to an existing account using the backend-only command below. This command requires the API's database configuration and revokes that user's existing sessions.

```powershell
npm.cmd run user:role --workspace @medora/api -- account@example.com DOCTOR
```

Supported roles are `PATIENT`, `DOCTOR`, `PHARMACY_ADMIN`, `PHARMACY_STAFF`, and `PLATFORM_ADMIN`. Role assignment rejects changes that conflict with an existing Patient, Doctor, or Pharmacy administrator relationship. No accounts or default passwords are created automatically.

Web login routes doctors to Doctor, pharmacy roles to Pharmacy, and platform admins to Admin. The old role preview selector is removed; manually changing the hash cannot select another role's layout. Patient users continue to the Expo patient app's web rendering at `VITE_PATIENT_APP_URL`. Keep the browser apps and API on the same site (including a consistent hostname and scheme) for HttpOnly cookie sessions. Native patient login opens the patient layout; professional users continue to the web dashboard and sign in there again without passing credentials in URLs.

Sidebar links still open placeholder screens. **UI components** opens the component gallery. **+ New Prescription** and notifications remain preview dialogs. Hash URLs support refresh and browser back/forward within the authenticated role's workspace.

The patient app has Home, Prescriptions, Orders, and Profile bottom tabs. Notifications open from the header bell. Sign out is available in the web header and patient Profile tab. User authentication is connected; clinical screens remain placeholders.

Theme tokens live in `apps/web-dashboard/src/theme.css` and `apps/patient-mobile/src/theme.ts`. Both platforms bundle Inter locally. See [the Phase 2 report](docs/PHASE2_REPORT.md) for the complete file list, dependency rationale, and verification limits.

See [the Phase 3 report](docs/PHASE3_REPORT.md) for auth endpoint contracts, token storage/rotation, environment variables, new dependencies, the exact change list, and verification limits.

`GET /api/health` returns HTTP 200:

```json
{ "status": "ok", "service": "medora-api" }
```

Unknown API routes return JSON 404. The error middleware returns safe JSON errors without exposing exception details, handles invalid/oversized request bodies, and delegates errors after headers have been sent.

## Checks and builds

```powershell
npm.cmd run check
npm.cmd run build
```

`check` runs ESLint, Prettier verification, TypeScript checks for all five workspaces, and API integration tests. Tests cover health/error responses plus registration, login, all five roles, password redaction, JWT validation, refresh rotation/reuse/concurrency, CSRF/cookies, ownership, rate limiting, expiry, and logout. The first test run downloads a MongoDB test binary; it does not use your configured database or `.env`. Individual commands are `lint`, `format:check`, `typecheck`, and `test`; `format` applies formatting.

`build` compiles the API and produces the Vite bundle. To start the built API:

```powershell
npm.cmd run start --workspace @medora/api
```

To verify native JavaScript bundling without an emulator:

```powershell
npm.cmd exec --workspace @medora/patient-mobile -- expo export --platform android --platform ios
```

Generated `dist`, Expo caches, dependencies, local environment files, and credentials are ignored by Git. Shared types are type-only; domain validation lives in the API's Mongoose schemas. The shared validation workspace remains a placeholder.

## Core models and development seed

Patient, Doctor, Hospital, and Pharmacy models include validated relationships, indexes, and verification statuses. They have no public CRUD or verification workflow yet. See [the Phase 4 report](docs/PHASE4_REPORT.md) for field contracts, validation boundaries, tests, and all changed files.

To add fictional development records, point `MONGODB_URI` in `apps/api/.env` at a dedicated development database, keep `NODE_ENV=development`, and set `SEED_PASSWORD` to a unique password of 12–128 characters. Then run:

```powershell
npm.cmd run seed:dev --workspace @medora/api
```

The seed creates `patient@medora.example.test`, `doctor@medora.example.test`, `pharmacy@medora.example.test`, and `admin@medora.example.test`, plus one patient profile, doctor profile, hospital, and pharmacy. All accounts initially use your supplied seed password, hashed using the existing authentication implementation. Reruns preserve existing passwords and edits. Professional verification statuses remain `PENDING`. This is a development fixture, not an account-provisioning or verification workflow. Remove `SEED_PASSWORD` from the environment after use.

## Current scope and limits

Authentication/RBAC, core domain models, and backend medicine catalogue are implemented. Prescriptions, inventory, matching, payments, and admin verification workflows are not implemented. Email verification, password reset, and MFA are not included. Registration still creates only a User; collecting and creating role profiles requires later workflows. Model verification statuses do not change the existing authentication rules. Mobile JavaScript bundling and Metro startup do not replace testing on a real device or emulator. No native app binaries are built in this phase.

## Medicine catalogue

Medicine holds a generic clinical definition; MedicineProduct holds a specific brand, manufacturer, pack size, and unique product code linked to a Medicine. Future inventory must reference MedicineProduct rather than accept arbitrary medicine names.

Authenticated users can list, search, and read catalogue entries. Only platform admins can create or edit them. Pagination uses `page` (default 1) and `limit` (default 20, maximum 100). Search is literal, case-insensitive substring matching across generic name, active ingredient, and linked brand names. Both ACTIVE and INACTIVE entries are returned with explicit status. This phase provides no clinical suitability or substitution decisions.

The existing `seed:dev` command now also loads catalogue examples. To load only catalogue examples without creating accounts:

```powershell
npm.cmd run seed:catalogue --workspace @medora/api
```

It requires `NODE_ENV=development` and `MONGODB_URI` in `apps/api/.env`, but no seed password. It creates three example definitions and six fictional products, preserving existing records on reruns. These examples are **software development fixtures, not a complete or authoritative drug database**. See [the Phase 5 report](docs/PHASE5_REPORT.md) for endpoint contracts, validation, verification, and the complete changed-file list.
