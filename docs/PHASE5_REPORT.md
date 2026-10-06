# Phase 5 — Medicine Catalogue

Implements only the backend medicine catalogue described in `MEDORA_SPEC.md` and the Phase 5 request. No prescription, inventory, matching, external medicine API, AI search, or later-phase functionality was added. Frontend screens remain unchanged.

## Models

`Medicine`: genericName, activeIngredient, positive finite numeric strength (maximum 1,000,000), strengthUnit, dosageForm, category, ACTIVE/INACTIVE status, createdAt, updatedAt. Clinical strings are trimmed, whitespace-collapsed, and lowercased. A compound unique index on genericName + strength + strengthUnit + dosageForm prevents duplicate definitions, including concurrent inserts. Active ingredient and category edits cannot create a second copy of the same definition. No unit conversion or clinical synonym inference is performed.

`MedicineProduct`: required existing medicineId reference, brandName, manufacturer, packSize (a descriptive string such as `10 tablets`), normalized unique productCode, ACTIVE/INACTIVE status, createdAt, updatedAt. Brand/manufacturer/pack text retains case with normalized spacing. Codes are trimmed and uppercased. Products are indexed by medicineId + brandName + _id. Future pharmacy inventory must reference MedicineProduct IDs; inventory does not exist yet.

Both models use strict schemas, validation on document saves, optimistic concurrency, and existing safeguards against query/bulk updates bypassing document validation. API startup awaits catalogue index initialization. Application-level reference validation is not a database foreign-key constraint; direct database mutations remain outside it. No deletion endpoints are provided; use status INACTIVE to retire an entry while preserving references.

## API contracts

All endpoints require a valid bearer access token. The stored User role determines write authorization.

| Method | Endpoint                           | Access/result                                        |
| ------ | ---------------------------------- | ---------------------------------------------------- |
| GET    | `/api/medicines`                   | Any authenticated role; paginated medicines          |
| GET    | `/api/medicines/search?q=...`      | Any authenticated role; paginated matching medicines |
| GET    | `/api/medicines/:id`               | Any authenticated role; one medicine                 |
| GET    | `/api/medicines/:id/products`      | Any authenticated role; paginated linked products    |
| POST   | `/api/admin/medicines`             | PLATFORM_ADMIN; creates medicine, HTTP 201           |
| PATCH  | `/api/admin/medicines/:id`         | PLATFORM_ADMIN; updates supplied fields, HTTP 200    |
| POST   | `/api/admin/medicine-products`     | PLATFORM_ADMIN; creates product, HTTP 201            |
| PATCH  | `/api/admin/medicine-products/:id` | PLATFORM_ADMIN; updates supplied fields, HTTP 200    |

POST bodies contain the model's editable fields; status is optional and defaults to ACTIVE. IDs/timestamps are server-owned. PATCH accepts a nonempty subset of editable fields. Unknown fields, malformed IDs, invalid references, empty patches, or invalid values return 400. Missing records return 404; duplicate identities/codes and stale document saves return 409. Authentication failures return 401; non-admin writes return 403. Errors do not expose database details. CORS now allows PATCH for existing trusted origins.

Lists return `{ items, page, limit, total }`; records include MongoDB `_id`. Page defaults to 1 (maximum 10,000); limit defaults to 20 (maximum 100). Medicine ordering is genericName then _id; product ordering is brandName then _id. Both statuses are returned explicitly, including INACTIVE; future prescribing/inventory workflows must enforce their own eligibility rules.

Search requires 1–100 nonblank characters, normalizes whitespace, escapes regex metacharacters, and performs case-insensitive literal substring matching on generic name, active ingredient, and linked product brand. Results are distinct medicines with stable sorting, not a product list or clinical ranking. A MongoDB lookup avoids an unbounded product-ID list. Search has a five-second database execution limit. Substring search may scan records and is intended for the initial catalogue, not a large production search engine.

## Postman testing walkthrough

Set `baseUrl` to `http://127.0.0.1:3000` (adjust for your configured host/port). Start with `npm.cmd run dev:api`. Log in using `POST {{baseUrl}}/api/auth/login`, headers `Content-Type: application/json` and `X-Medora-Client: native`, and raw JSON `{"email":"YOUR_ACCOUNT_EMAIL","password":"YOUR_PASSWORD"}`. Do not send an Origin header for this Postman native-client login. Store the returned `accessToken` locally as `token`. Set Authorization → Bearer Token → `{{token}}` for catalogue requests. Use an existing PLATFORM_ADMIN account for writes; public registration never grants that role.

| Method | Exact Postman URL                                                            | Expected success                |
| ------ | ---------------------------------------------------------------------------- | ------------------------------- |
| GET    | `{{baseUrl}}/api/medicines?page=1&limit=20`                                  | 200; paginated medicines        |
| GET    | `{{baseUrl}}/api/medicines/search?q=paracetamol&page=1&limit=20`             | 200; generic-name match         |
| GET    | `{{baseUrl}}/api/medicines/search?q=ascorbic&page=1&limit=20`                | 200; Vitamin C ingredient match |
| GET    | `{{baseUrl}}/api/medicines/search?q=Fictional%20amoxicillin&page=1&limit=20` | 200; linked-brand match         |
| GET    | `{{baseUrl}}/api/medicines/{{medicineId}}`                                   | 200; selected medicine          |
| GET    | `{{baseUrl}}/api/medicines/{{medicineId}}/products?page=1&limit=20`          | 200; linked products            |
| POST   | `{{baseUrl}}/api/admin/medicines`                                            | 201; created medicine           |
| PATCH  | `{{baseUrl}}/api/admin/medicines/{{medicineId}}`                             | 200; updated medicine           |
| POST   | `{{baseUrl}}/api/admin/medicine-products`                                    | 201; created product            |
| PATCH  | `{{baseUrl}}/api/admin/medicine-products/{{productId}}`                      | 200; updated product            |

For creation and updates use raw JSON with `Content-Type: application/json`. Create a deliberately fictional test medicine so it does not collide with the seed:

```json
{
  "genericName": "Fictional Postman Test Compound",
  "activeIngredient": "Fictional Test Ingredient",
  "strength": 1,
  "strengthUnit": "mg",
  "dosageForm": "Tablet",
  "category": "Software test fixture",
  "status": "ACTIVE"
}
```

Save the returned `_id` as `medicineId`. Create a linked product:

```json
{
  "medicineId": "{{medicineId}}",
  "brandName": "Fictional Postman Brand",
  "manufacturer": "Fictional Test Manufacturer",
  "packSize": "10 tablets",
  "productCode": "POSTMAN-DEMO-001",
  "status": "ACTIVE"
}
```

Save its `_id` as `productId`. Either PATCH endpoint accepts `{"status":"INACTIVE"}`. These manual fixtures are not clinical data. For seeded products, instead use a medicine `_id` returned by the relevant search request.

Expected negative checks: omitted/invalid token → 401; non-admin writes → 403; duplicate definition (including case/spacing variants) or product code → 409; zero/negative strength, empty PATCH, invalid ID or nonexistent product medicine reference → 400; well-formed nonexistent detail ID → 404. Repeating the above POST bodies should return 409. Search with `q=.*` is a literal substring search, not a wildcard. Lists return `{ items, page, limit, total }`; limits above 100 and pages below 1 return 400. Deactivated entries remain visible with explicit status.

## Development seed command

Run from the repository root:

```powershell
npm.cmd run seed:catalogue --workspace @medora/api
```

Uses the existing `apps/api/.env` values `NODE_ENV=development` and `MONGODB_URI`; no new environment variables or dependencies. It does not create accounts or change passwords. The existing `seed:dev` also calls the catalogue seed after its account/profile seed.

Examples: Paracetamol 500 mg Tablet, Amoxicillin 500 mg Capsule, Vitamin C 1000 mg Tablet (active ingredient ascorbic acid), with two explicitly fictional brand products each. These are software fixtures, **not a complete or authoritative drug database**. Reruns preserve existing records and edits; product-code relationship conflicts fail. The seed is sequential, so interrupted runs can be rerun.

The catalogue-only development seed was executed successfully against the configured development database. Environment files and credentials were not displayed or modified.

## Changed files

Created:

- `apps/api/src/catalogue/models.ts`
- `apps/api/src/catalogue/validation.ts`
- `apps/api/src/catalogue/routes.ts`
- `apps/api/src/catalogue/seed-data.ts`
- `apps/api/src/catalogue/seed.ts`
- `apps/api/tests/catalogue.test.ts`
- `docs/PHASE5_REPORT.md`

Modified:

- `apps/api/src/app.ts` — mount catalogue routers and allow PATCH in CORS.
- `apps/api/src/server.ts` — initialize catalogue indexes.
- `apps/api/src/domain/seed.ts` — include catalogue in full development seed.
- `apps/api/package.json` — catalogue seed command; serialize test files to avoid simultaneous MongoDB startup resource contention (concurrency tests inside suites remain intact).
- `README.md` — catalogue scope, seed command, report link.

No new dependencies, lockfile changes, frontend changes, or specification changes.

## Verification

Reverification on 2026-10-06 changed only `apps/api/src/catalogue/seed-data.ts` (explicit development-only comment) and this report (Postman walkthrough and results). The pre-existing unrelated change in `apps/web-dashboard/src/App.tsx` was left untouched; no unrelated changes were reverted. The original Phase 5 file list above describes the implementation already present in the workspace.

The full suite passed again: 41/41 tests. The first attempt encountered a MongoDB startup timeout in the existing authentication suite while other checks were running; retrying after those checks finished passed. Lint, all five workspace TypeScript checks, API build, and formatting of the two edited files passed. The catalogue development seed was rerun successfully against the configured development database without changing environment files. No dependencies or later-phase functionality were added.

- `npm.cmd test` — 41 tests passed (33 existing, 8 new catalogue tests). An initial concurrent run hit the existing authentication test database's ten-second startup timeout; serializing test files resolved the resource contention. Concurrent-write assertions within test cases still execute concurrently.
- `npm.cmd run lint` — passed without warnings.
- `npm.cmd run typecheck` — passed across all five workspaces.
- `npm.cmd run build --workspace @medora/api` — passed.
- `npm.cmd run seed:catalogue --workspace @medora/api` — completed successfully against the configured development database after granting access outside the Windows sandbox.
- Built API startup smoke test against disposable MongoDB — passed: health HTTP 200, persistence across restart, login, authenticated `/me`, and role authorization. Smoke-test processes and temporary database were stopped afterward.
- Formatting and final diff checks are recorded in the completion summary.
