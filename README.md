# Medora

Phase 1 foundation only. [The Medora specification](docs/MEDORA_SPEC.md) is the source of truth. Later phases require separate implementation work.

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
- Expo Go compatible with SDK 57 on a device, or an Android emulator, to view the mobile app. The iOS simulator requires macOS and Xcode.

Run commands from the repository root. On Windows PowerShell use `npm.cmd` (as below) if execution policy blocks `npm.ps1`. On other shells, `npm` works instead.

```powershell
npm.cmd ci
```

No secrets, external services, or environment files are required. To override API defaults, copy `apps/api/.env.example` to `apps/api/.env`. The API loads that file when launched using the workspace commands. Default settings: `HOST=127.0.0.1`, `PORT=3000`, `NODE_ENV=development`.

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
- Mobile: scan the terminal QR code with compatible Expo Go, or press `a` for an installed Android emulator. Device and computer should share a network. No API connection is needed by the Phase 1 placeholders.

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

`check` runs ESLint, Prettier verification, TypeScript checks for all five workspaces, and the initial API integration tests. Tests cover health, unknown routes, malformed JSON, body limits, and unexpected errors. Individual commands are `lint`, `format:check`, `typecheck`, and `test`; `format` applies formatting.

`build` compiles the API and produces the Vite bundle. To start the built API:

```powershell
npm.cmd run start --workspace @medora/api
```

To verify native JavaScript bundling without an emulator:

```powershell
npm.cmd exec --workspace @medora/patient-mobile -- expo export --platform android --platform ios
```

Generated `dist`, Expo caches, dependencies, local environment files, and credentials are ignored by Git. Shared types are type-only; validation intentionally has no runtime/domain implementation yet.

## Phase 1 limits

The web and mobile apps contain only a welcome screen. Authentication, databases, prescriptions, pharmacy operations, matching, payments, the design system, and all other later-phase features are not implemented. Mobile JavaScript bundling and Metro startup do not replace testing on a real device or emulator. No native app binaries are built in this phase.
