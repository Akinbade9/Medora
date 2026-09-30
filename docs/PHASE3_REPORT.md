# Phase 3: Authentication and RBAC

Only Phase 3 was implemented. `MEDORA_SPEC.md` is unchanged. The Phase 2 checkpoint already existed as commit `4987314` when this work began. Phase 3 changes are not committed.

## Behavior and security boundaries

- MongoDB stores only `User` and authentication-specific `AuthSession` documents. No Patient, Doctor, Hospital, Pharmacy, or clinical domain models were added.
- Public registration creates `PATIENT` accounts. Strict schemas reject role, account-state, and unknown input fields. Email is normalized and protected by a unique database index.
- The backend-only `user:role` command assigns one of the five supported roles to an existing account and revokes its previous sessions. No frontend or public role-assignment endpoint exists.
- Passwords use independently salted Node `crypto.scrypt` hashes with N=32768, r=8, p=3 and constant-time comparison. These parameters follow an [OWASP-recommended scrypt configuration](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Unknown-account login performs a dummy hash check and returns the same credential error.
- Access JWTs expire in 15 minutes. Verification restricts algorithm, issuer, audience, token purpose, and required claims. Every protected request checks the live session and loads the user's role/account state from MongoDB. Role claims and role headers cannot grant access.
- Refresh credentials contain a random session ID and a 256-bit random secret. Only SHA-256 token digests are stored in MongoDB. Atomic compare-and-swap rotation permits one use; reuse of a consumed token revokes the entire session family. This follows the reuse-detection principle in [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14). Guessed secrets do not revoke valid sessions.
- Sessions have a fixed seven-day lifetime. Expiry is checked in queries independently of MongoDB TTL cleanup. Logout revokes both refresh and access for that session immediately; other device sessions remain active.
- Browser access tokens live only in memory. Refresh tokens use an HttpOnly, SameSite=Strict cookie scoped to `/api/auth`; production adds Secure. Exact allowed origins, JSON requests, and a custom client header protect browser mutations against CSRF. Browser auth responses never contain refresh tokens.
- Native clients receive the intended access/refresh credentials only from successful authentication responses. The refresh credential is saved in Expo SecureStore with device-bound keychain settings; access tokens remain in memory. No tokens are put in AsyncStorage, localStorage, URLs, or logs. Native credential delivery is necessary for this explicit transport; hashes, signing keys, consumed-token history, and session database documents are never returned.
- Clients restore sessions, refresh in one in-flight operation per app, recheck on focus/resume, handle expiry, and confirm server logout. They prevent pending refresh results from restoring a session during sign-out.
- Role middleware and the reusable `assertOwner` helper fail closed. Ownership does not implicitly exempt admins; a caller must explicitly allow a bypass role.
- Credential attempts and session mutations are rate limited; auth responses have `Cache-Control: no-store`. Unexpected errors and startup failures do not print credentials or database URIs.

## API contracts

POST requests require JSON and `X-Medora-Client: web` or `native`. Browser requests must carry an allowed Origin (the browser supplies it). Native transport is rejected when an Origin header is present.

| Endpoint                        | Input / behavior                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `POST /api/auth/register`       | `{ displayName, email, password }`; password 12–128 characters; returns 201 and a session |
| `POST /api/auth/login`          | `{ email, password }`; returns 200 and a session                                          |
| `POST /api/auth/refresh`        | Browser: `{}` plus cookie. Native: `{ refreshToken }`. Rotates the refresh credential     |
| `POST /api/auth/logout`         | Same transport as refresh; revokes the session and returns 204; repeat logout is harmless |
| `GET /api/auth/me`              | Requires `Authorization: Bearer <access token>`; returns `{ user }`                       |
| `GET /api/auth/access/patient`  | Protected probe for PATIENT                                                               |
| `GET /api/auth/access/doctor`   | Protected probe for DOCTOR                                                                |
| `GET /api/auth/access/pharmacy` | Protected probe for PHARMACY_ADMIN and PHARMACY_STAFF                                     |
| `GET /api/auth/access/admin`    | Protected probe for PLATFORM_ADMIN                                                        |

The access probes verify authorization only; they do not implement domain functionality. A public user DTO contains only `id`, `displayName`, `email`, and `role`. Successful auth responses contain this DTO, `accessToken`, and `expiresIn`; native transport additionally receives its refresh credential. Errors use `{ error: { message } }`.

## Environment and setup required

Dependencies are installed. Use a running MongoDB instance for normal development; the disposable test database is not the application's permanent database. Copy examples only if the destination `.env` does not already exist, otherwise add the missing settings to it.

| File                       | Setting                         | Requirement / default                                                                                               |
| -------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `apps/api/.env`            | `MONGODB_URI`                   | Required. Example local URI: `mongodb://127.0.0.1:27017/medora`                                                     |
| `apps/api/.env`            | `JWT_ACCESS_SECRET`             | Required. A freshly generated 64-character random hexadecimal string                                                |
| `apps/api/.env`            | `WEB_ORIGINS`                   | Exact comma-separated browser origins. Default: `http://127.0.0.1:5173,http://127.0.0.1:8081`                       |
| `apps/api/.env`            | `HOST`, `PORT`, `NODE_ENV`      | Existing defaults: `127.0.0.1`, `3000`, `development`. Production requires HTTPS origins and enables Secure cookies |
| `apps/web-dashboard/.env`  | `VITE_API_URL`                  | Public API URL; default `http://127.0.0.1:3000`                                                                     |
| `apps/web-dashboard/.env`  | `VITE_PATIENT_APP_URL`          | Patient Expo web experience; default `http://127.0.0.1:8081`                                                        |
| `apps/patient-mobile/.env` | `EXPO_PUBLIC_API_URL`           | API URL reachable by the device; default `http://127.0.0.1:3000`                                                    |
| `apps/patient-mobile/.env` | `EXPO_PUBLIC_WEB_DASHBOARD_URL` | Professional browser handoff URL; default `http://127.0.0.1:5173`                                                   |

Generate the signing secret locally, then paste it into the API `.env`:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Never put that secret or MongoDB credentials in a `VITE_*` or `EXPO_PUBLIC_*` variable. No real `.env`, signing secret, persistent test account, or default password was created by this implementation.

Use consistent hostnames and schemes across browser apps and API; do not mix `localhost` with `127.0.0.1`. For physical-device development, set the public URLs to the computer's LAN address and the API host to `0.0.0.0` on a trusted development network. Android emulators normally use `10.0.2.2` to reach the host. Add the actual browser origin to `WEB_ORIGINS` if using different ports. Restart Vite/Expo after changing public environment variables. Production needs HTTPS and same-site browser/API deployment for Strict cookies.

Start in separate terminals:

```powershell
npm.cmd run dev:api
npm.cmd run dev:web
npm.cmd run dev:mobile
```

Press `w` in Expo for the browser patient experience or use a compatible SDK 57 Expo Go app/emulator. Browser patients are redirected there after authentication. Native professional users are handed off to the web dashboard and sign in again there; credentials are never passed through the handoff URL.

To grant a professional role, first register the account, then run from a trusted backend terminal:

```powershell
npm.cmd run user:role --workspace @medora/api -- account@example.com DOCTOR
```

Replace the email and role as appropriate. Supported values: `PATIENT`, `DOCTOR`, `PHARMACY_ADMIN`, `PHARMACY_STAFF`, `PLATFORM_ADMIN`. This is operational provisioning, not a public workflow or seeded domain data.

## New dependencies

| Package                                         | Purpose                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `mongoose`                                      | User/session schemas, persistence, unique email index, atomic refresh updates, TTL cleanup |
| `jose`                                          | JWT signing and verified algorithm/issuer/audience/expiry                                  |
| `zod`                                           | Strict authentication and configuration input validation                                   |
| `cors`                                          | Exact-origin credentialed browser access                                                   |
| `cookie-parser`                                 | Parse the browser refresh cookie                                                           |
| `express-rate-limit`                            | Credential/session abuse limits                                                            |
| `@types/cors`, `@types/cookie-parser`           | TypeScript definitions for middleware                                                      |
| `mongodb-memory-server-core` (development only) | Isolated real-MongoDB integration tests; downloads a test binary on first use              |
| `expo-secure-store`                             | OS-backed refresh-token storage on native devices                                          |

Both frontend workspaces now depend on the existing local `@medora/shared-types` workspace for auth DTOs. No password hashing dependency was needed because Node provides scrypt. Authentication schemas are server-local; no domain validation was added to `packages/validation`.

## Verification and limits

- All 22 automated tests passed, including the requested registration/login/authentication/role/refresh checks and additional security edge cases. Tests use an isolated MongoDB instance and never your development database.
- ESLint, Prettier, and TypeScript checks across all five workspaces passed. API and web production builds passed.
- Patient Android/iOS Hermes bundles and its web bundle exported successfully with the new authentication screens and SecureStore dependency.
- API startup was checked with an isolated MongoDB instance and an ephemeral signing key. Health, registration, login, `/me`, and restricted access worked. Account data survived restarting the built API. The backend role command changed the role and revoked existing sessions.
- Vite started on port 5181 and served the app and transformed login module with HTTP 200. Expo Metro started on port 8086 and returned `packager-status:running`. These ports avoided existing development servers.
- The normal API will require your MongoDB URI and signing secret before it starts. The isolated verification database is stopped and removed afterward.
- Browser inventory returned no available browsers. Native UI/SecureStore device behavior and browser interaction need a device/browser check; bundling and HTTP startup are not visual end-to-end verification.
- Email verification, password reset, MFA, invitations, account administration UI, clinical profiles, and all later-phase business features remain out of scope.
- Rate limits use a per-process memory store. Multi-instance deployment would need a shared limiter and an explicitly reviewed trusted-proxy configuration.
- Rotation is strict: replay revokes a session family. Clients coordinate refresh within each app instance, but simultaneous browser tabs may force reauthentication if they race the same cookie. Failed/lost refresh responses can also require signing in again.
- Dependency installation still reports the 10 moderate findings in the existing Expo toolchain. No unrelated forced upgrades were applied.

## Exact file list

Modified:

```text
.env.example
README.md
package-lock.json
packages/shared-types/src/index.ts
apps/api/.env.example
apps/api/package.json
apps/api/src/app.ts
apps/api/src/server.ts
apps/api/src/middleware/error-handler.ts
apps/api/tests/app.test.ts
apps/web-dashboard/.env.example
apps/web-dashboard/package.json
apps/web-dashboard/src/App.tsx
apps/web-dashboard/src/layouts/DashboardLayout.tsx
apps/patient-mobile/.env.example
apps/patient-mobile/package.json
apps/patient-mobile/app.json
apps/patient-mobile/App.tsx
apps/patient-mobile/src/PatientLayout.tsx
apps/patient-mobile/src/theme.ts
```

Created:

```text
apps/api/src/auth/config.ts
apps/api/src/auth/middleware.ts
apps/api/src/auth/models.ts
apps/api/src/auth/password.ts
apps/api/src/auth/routes.ts
apps/api/src/auth/service.ts
apps/api/src/auth/set-role.ts
apps/api/src/auth/validation.ts
apps/api/tests/auth.test.ts
apps/api/tests/config.ts
apps/web-dashboard/src/auth/AuthScreen.tsx
apps/web-dashboard/src/auth/auth.css
apps/web-dashboard/src/auth/client.ts
apps/web-dashboard/src/auth/useAuth.ts
apps/patient-mobile/src/auth/AuthGate.tsx
apps/patient-mobile/src/auth/client.ts
docs/PHASE3_REPORT.md
```

Generated dependency caches, app `dist` output, Expo caches, and `.tmp/phase3-startup.mjs` are ignored verification artifacts. Nothing under the existing specification or later-phase domain packages was changed.
