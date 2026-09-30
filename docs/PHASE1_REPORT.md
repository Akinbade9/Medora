# Phase 1 completion report

Implemented only the project foundation described in `MEDORA_SPEC.md`. The existing specification was read completely and left unchanged. All repository files listed below are newly created; no existing project files were modified.

## Verification

- Dependencies installed with npm; `package-lock.json` records the resolved versions. `npm ls --depth=0` passes without invalid dependencies.
- ESLint and Prettier checks pass.
- TypeScript checks pass for all five workspaces.
- All five API integration tests pass: health, JSON 404, malformed JSON, oversized body, and safe internal-error response.
- API TypeScript build and Vite production build pass.
- Built API starts and `GET /api/health` returns HTTP 200 with the expected JSON.
- Vite starts at port 5173, serves the HTML page, and transforms the React entry module successfully.
- Expo Metro starts at port 8081 and its status endpoint returns `packager-status:running`.
- Expo exports both Android and iOS Hermes bundles successfully.

The sandbox prevented the test runner from accessing Windows user information and prevented Hermes compiler execution. Both checks passed when rerun with approved permissions. Metro used its fallback React Native DevTools because the sandbox blocked the optional DevTools cache download. A physical device/emulator and native app binaries were not tested.

`npm audit` reports 10 moderate findings, all tracing to the `uuid` bounds-check advisory through Expo's Xcode/config tooling. No high or critical findings were reported. npm proposes a breaking downgrade to Expo 46; this was not applied to the compatible Expo 57 setup. No forced dependency overrides were added.

## Exact source/configuration file list

```text
.env.example
.gitignore
.prettierignore
.prettierrc.json
README.md
eslint.config.mjs
package.json
package-lock.json
tsconfig.base.json
apps/api/.env.example
apps/api/package.json
apps/api/tsconfig.json
apps/api/tsconfig.build.json
apps/api/src/app.ts
apps/api/src/server.ts
apps/api/src/middleware/error-handler.ts
apps/api/tests/app.test.ts
apps/web-dashboard/.env.example
apps/web-dashboard/package.json
apps/web-dashboard/tsconfig.json
apps/web-dashboard/vite.config.ts
apps/web-dashboard/index.html
apps/web-dashboard/src/App.tsx
apps/web-dashboard/src/main.tsx
apps/web-dashboard/src/styles.css
apps/patient-mobile/.env.example
apps/patient-mobile/package.json
apps/patient-mobile/tsconfig.json
apps/patient-mobile/app.json
apps/patient-mobile/index.ts
apps/patient-mobile/App.tsx
packages/shared-types/package.json
packages/shared-types/tsconfig.json
packages/shared-types/src/index.ts
packages/validation/package.json
packages/validation/tsconfig.json
packages/validation/src/index.ts
docs/PHASE1_REPORT.md
```

Generated artifacts are ignored: `node_modules/` (including workspace dependency links), the three apps' `dist/` directories, Expo's `.expo/` cache, and temporary verification files in `.tmp/`. No secrets or local `.env` files were created. Nothing was committed.

## Commands for the developer

Dependencies are already installed. To use the apps, open separate terminals at the repository root:

```powershell
npm.cmd run dev:api
npm.cmd run dev:web
npm.cmd run dev:mobile
```

Open <http://127.0.0.1:3000/api/health> and <http://127.0.0.1:5173>. For mobile, scan the Expo QR code using Expo Go compatible with SDK 57, or press `a` with an Android emulator installed. iOS simulator use requires macOS. The mobile welcome screen still needs your device/emulator check.

To repeat validation:

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd exec --workspace @medora/patient-mobile -- expo export --platform android --platform ios
```

Use `npm.cmd ci` on a fresh checkout. No environment configuration is required for the defaults. See the root README for optional settings. On shells other than Windows PowerShell, `npm` may be used instead of `npm.cmd`.
