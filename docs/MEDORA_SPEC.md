# MEDORA — CODEX IMPLEMENTATION SEQUENCE

Use the Medora master specification as the source of truth for every task.

Do not implement future phases early unless required for a clean interface or placeholder.

After every phase:

- run tests
- run lint
- run TypeScript checks
- confirm affected apps start successfully
- summarize changed files
- report any limitation
- do not commit secrets
- do not make unrelated changes

---

## PHASE 1 — Project Foundation

Create the Medora monorepo.

Required structure:

apps/
- api
- web-dashboard
- patient-mobile

packages/
- shared-types
- validation

docs/

Configure:

API:
- Node.js
- Express
- TypeScript

Web:
- React
- Vite
- TypeScript

Mobile:
- React Native
- Expo
- TypeScript

Set up shared scripts from the repository root where practical.

Add:
- ESLint
- formatting configuration
- environment-variable examples
- sensible .gitignore
- root README
- basic health endpoint
- basic error middleware

Do not implement Medora business features yet.

Acceptance criteria:

1. API starts.
2. Web app starts.
3. Expo app starts.
4. GET /api/health returns a successful response.
5. Type checks pass.
6. Initial tests pass.

---

## PHASE 2 — Design System and Base Layouts

Implement Medora’s base visual system according to the master specification.

Use:
- teal-led theme
- neutral backgrounds
- Inter typography
- consistent spacing
- accessible contrast
- Lucide icons where appropriate

Build reusable primitives such as:
- Button
- Input
- Select
- Card
- Modal
- Badge
- StatusBadge
- EmptyState
- LoadingState
- ErrorState

Create base layouts for:
- Doctor
- Pharmacy
- Admin
- Patient mobile

Do not build business functionality yet.

Patient bottom navigation:

Home
Prescriptions
Orders
Profile

Professional web navigation should use role-specific sidebars.

---

## PHASE 3 — Authentication and RBAC

Implement authentication and authorization.

Roles:

PATIENT
DOCTOR
PHARMACY_ADMIN
PHARMACY_STAFF
PLATFORM_ADMIN

Implement:

- User model
- registration
- login
- password hashing
- access token
- refresh token
- logout
- authentication middleware
- role middleware
- ownership/authorization utilities
- protected frontend routes

Use secure patterns.

Never trust role information sent by the frontend.

Add automated tests proving unauthorized roles cannot access protected functionality.

---

## PHASE 4 — Core Domain Models

Add models and validation for:

- Patient
- Doctor
- Hospital
- Pharmacy

Include verification/account status concepts where appropriate.

Create relationships between users and their role profiles.

Do not implement full hospital management or EHR features.

Create development seed data for fictional users representing:

- patient
- doctor
- pharmacy admin
- platform admin

---

## PHASE 5 — Medicine Catalogue

Implement:

Medicine
MedicineProduct

Medicine should represent structured prescribing information such as:

- generic name
- active ingredient
- strength
- strength unit
- dosage form

MedicineProduct should contain:

- medicine reference
- brand
- manufacturer
- pack size where needed

Add search APIs.

Create admin CRUD functionality for catalogue management.

Seed realistic fictional/example medicine catalogue data suitable for development.

Do not scrape external medicine databases.

---

## PHASE 6 — Prescription Engine

Implement the prescription model and doctor prescription workflow.

Support:

- selecting a patient
- adding one or multiple medications
- quantity
- instructions
- frequency
- duration
- substitution rule

Rules:

GENERIC_ALLOWED
BRAND_SPECIFIC
DO_NOT_SUBSTITUTE

Generate prescription IDs automatically on the backend.

Public format similar to:

RX-26-X7K92P

Requirements:

- no patient identifying data in code
- secure random component
- uniqueness check
- unique database index

Patients must never be able to modify prescriptions.

Add tests for role restrictions and prescription ID uniqueness.

---

## PHASE 7 — Doctor Dashboard

Build:

- Doctor Home
- Patient Search
- Patient Details
- Create Prescription
- Review Prescription
- Prescription Details
- Prescription History
- Feedback placeholder
- Profile

Keep:

+ New Prescription

prominent.

Doctor Home should prioritize actionable information rather than unnecessary analytics.

Do not implement full electronic medical records.

---

## PHASE 8 — Patient Prescription Experience

Build patient mobile prescription functionality.

Patient can:

- see new prescription
- view active prescriptions
- view prescription history
- view doctor/hospital
- view medication details
- see prescription status

Patient cannot edit anything clinical.

Add:

Find My Medication

button for eligible active prescriptions.

Do not implement matching yet beyond connecting the UI to a placeholder API contract.

---

## PHASE 9 — Pharmacy Inventory

Implement inventory management.

Fields:

- pharmacy
- medicine product
- quantity in stock
- reserved quantity
- safety stock
- price
- status
- last updated

Calculate reservable stock server-side.

Build pharmacy screens:

- Inventory List
- Add Item
- Edit Item
- Low Stock

Do not implement CSV import yet.

Add tests for stock calculation.

---

## PHASE 10 — Matching Engine

Implement the Medora matching service.

Process:

- validate prescription
- validate ownership
- ensure prescription active
- apply substitution rules
- query verified pharmacies
- calculate reservable quantity
- reject incompatible products
- find complete matches
- generate split matches if required
- rank results

Safety compatibility must happen before ranking.

V1 split matching:

maximum two pharmacies.

Return match categories:

COMPLETE
MULTIPLE_COMPLETE
SPLIT
PARTIAL
NO_MATCH
APPROVAL_REQUIRED

Add extensive automated tests.

---

## PHASE 11 — Patient Matching UI

Connect Find My Medication to the real matching API.

Create:

- matching loading state
- results page
- pharmacy match cards
- recommended label
- lowest price
- closest
- fastest where data exists
- full prescription availability
- split fulfillment display
- partial/no-match states

Allow product/brand selection only where substitution rules permit.

Clearly explain why a pharmacy is recommended.

Do not claim clinical superiority.

---

## PHASE 12 — Reservation Engine

Implement reservation logic.

Before reserving:

- recheck stock
- perform atomic inventory operation
- prevent double reservation

Reservation states:

PENDING
AWAITING_PHARMACY_CONFIRMATION
CONFIRMED
EXPIRED
CANCELLED
CONVERTED_TO_ORDER

Add configurable reservation expiry.

Introduce Redis if appropriate for expiry/timing, while MongoDB remains the durable record.

Low-stock items may require pharmacy confirmation.

Add concurrency tests proving the final unit cannot be reserved by two online users.

---

## PHASE 13 — Orders

Implement order creation after valid reservation.

Support:

PICKUP
DELIVERY

Pickup states:

AWAITING_PAYMENT
PAID
CONFIRMED
PREPARING
READY_FOR_PICKUP
COMPLETED

Delivery states:

AWAITING_PAYMENT
PAID
CONFIRMED
PREPARING
READY_FOR_DISPATCH
OUT_FOR_DELIVERY
COMPLETED

Additional:

CANCELLED
REFUND_PENDING
REFUNDED

Implement server-side transition validation.

Build patient Order screens and pharmacy Order screens.

---

## PHASE 14 — Pharmacy Operations Dashboard

Build:

- Pharmacy Home
- New Orders
- Confirmed Orders
- Preparing
- Ready
- Completed
- Order Details

Home should emphasize:

- new orders
- preparing
- ready
- low-stock issues
- confirmation requests

Pharmacy sees relevant prescription, doctor, hospital and patient name only.

Do not expose unrelated patient data.

---

## PHASE 15 — Pickup Verification

Implement secure pickup handoff.

When READY_FOR_PICKUP:

- create one-time code
- optionally represent as QR
- store securely
- show only to patient

Pharmacy must never have an endpoint that retrieves the patient's secret.

Create:

Verify Pickup

workflow.

Rate-limit failed attempts.

Only valid verification should allow completion.

Add tests.

---

## PHASE 16 — Delivery Flow

Implement simple delivery support.

Patient:
- chooses delivery
- selects address
- tracks delivery status

Pharmacy:
- prepares
- marks ready for dispatch
- marks dispatched or integrates placeholder logistics workflow

Support:

WAITING
ASSIGNED
PICKED_UP
OUT_FOR_DELIVERY
DELIVERED
FAILED

Keep logistics modular for future third-party courier integration.

Do not build a full delivery fleet platform.

---

## PHASE 17 — Paystack Test Integration

Integrate Paystack using TEST credentials only.

Implement backend:

- initialize payment
- verify payment
- webhook handling
- payment records
- refund-ready architecture

Rules:

- backend verifies payment
- frontend cannot declare success
- secrets never go to browser/mobile app
- no live credentials
- serviceFee = 0
- pharmacyCommission = 0
- platformDeliveryMargin = 0

Design fees so they can be enabled later without schema redesign.

---

## PHASE 18 — Notifications

Implement notification infrastructure.

Support:

IN_APP
PUSH
EMAIL

Initially prioritize:

PRESCRIPTION_ISSUED
PRESCRIPTION_CANCELLED
ORDER_CONFIRMED
ORDER_PREPARING
READY_FOR_PICKUP
OUT_FOR_DELIVERY
DELIVERED

Avoid sending email for every minor state change.

Push and in-app notifications handle routine progress.

---

## PHASE 19 — Patient Feedback

Implement structured feedback from patient to prescribing doctor.

Categories:

MEDICATION_QUESTION
SIDE_EFFECT_CONCERN
COULD_NOT_OBTAIN_MEDICATION
OTHER

Build:

Patient feedback form

Doctor feedback inbox

Doctor feedback detail

Do not build unrestricted live chat.

---

## PHASE 20 — Admin Verification

Build admin functionality for:

- hospitals
- doctors
- pharmacies
- account status
- medicine catalogue
- basic order monitoring
- complaints placeholder

Only verified pharmacies can participate in matching.

Only appropriately verified doctors can issue live prescriptions.

Log sensitive admin actions.

---

## PHASE 21 — Audit System

Implement audit logging for significant events.

Never log:

- passwords
- raw authentication tokens
- pickup secrets
- payment secrets

Build admin audit viewer with filtering.

---

## PHASE 22 — Inventory Import

Add CSV/Excel pharmacy inventory import.

Requirements:

- preview before import
- validate catalogue/product mappings
- clearly display rejected rows
- do not silently create unsafe medicine matches
- transaction/batch safety where practical
- update inventory timestamps

---

## PHASE 23 — Swagger and Postman

Create comprehensive OpenAPI documentation.

Expose development API docs.

Create/export a Postman collection covering key workflows.

Document test users and local setup.

---

## PHASE 24 — Seeded End-to-End Demo

Create a complete development demo flow:

1. Doctor logs in
2. Doctor issues prescription
3. Prescription ID generated
4. Patient receives prescription
5. Patient finds medication
6. Matching results returned
7. Patient chooses pharmacy
8. Stock reserved
9. Test payment succeeds
10. Pharmacy receives order
11. Pharmacy prepares it
12. Pickup or delivery completes
13. Prescription/order marked completed

Use fictional data only.

---

## PHASE 25 — End-to-End Automated Testing

Implement high-value end-to-end tests.

Cover at least:

- doctor prescription journey
- patient matching journey
- pharmacy fulfillment
- pickup verification
- role restrictions
- stock collision
- cancelled prescription
- payment verification behavior

Do not aim for meaningless 100% coverage.

Prioritize critical workflows.

---

## PHASE 26 — Security and Quality Review

Perform a focused review of:

- authentication
- authorization
- ownership checks
- data exposure
- mass assignment
- validation
- race conditions
- reservations
- payment verification
- sensitive logging
- environment variables
- error responses
- rate limits
- CORS
- dependency vulnerabilities

Fix verified issues.

Do not make speculative architecture rewrites.

---

## PHASE 27 — UX Polish

Review each role.

Patient:
Can the user always tell what they need to do next?

Doctor:
Can a prescription be issued efficiently?

Pharmacy:
Can orders be fulfilled without unnecessary navigation?

Admin:
Are verification and operational problems easy to locate?

Improve:

- empty states
- loading states
- errors
- mobile responsiveness
- accessibility
- form validation
- consistent terminology
- status labels

Preserve the Medora theme.

---

## PHASE 28 — Final Development Documentation

Update README with:

- architecture
- prerequisites
- installation
- environment variables
- development commands
- test commands
- seed command
- API documentation
- mobile setup
- Paystack test setup
- Firebase setup if implemented
- known MVP limitations

Add a concise architecture document explaining:

Prescription
→ Matching
→ Reservation
→ Order
→ Payment
→ Fulfillment

Do not include secrets.