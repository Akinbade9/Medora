import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { buildIssueBody } from '../src/doctor/draft';
import type { DraftLine, Patient } from '../src/doctor/types';

async function login(page: Page, email = 'doctor@medora.example.test') {
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('browser test password only');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
test('payload uses patient profile ID, omits absent optional fields, validates brands and expiry', () => {
  const patient = {
    _id: 'profile-id',
    displayName: 'Fictional',
    patientCode: 'PT-TEST',
    dateOfBirth: '2000-01-01',
  } satisfies Patient;
  const line: DraftLine = {
    key: 'line',
    medicine: {
      _id: 'medicine',
      genericName: 'test',
      activeIngredient: 'test',
      strength: 1,
      strengthUnit: 'mg',
      dosageForm: 'tablet',
      status: 'ACTIVE',
    },
    quantity: '1',
    dosageInstructions: 'test',
    frequency: 'test',
    duration: 'test',
    substitutionRule: 'GENERIC_ALLOWED',
  };
  const body = buildIssueBody(patient, [line], '');
  expect(body.patientId).toBe('profile-id');
  expect(body).not.toHaveProperty('expiresAt');
  expect(body.medications[0]).not.toHaveProperty('medicineProductId');
  expect(body.medications[0]).not.toHaveProperty('refillCount');
  expect(() => buildIssueBody(null, [line], '')).toThrow('patient');
  expect(() =>
    buildIssueBody(patient, [{ ...line, quantity: '1.5' }], ''),
  ).toThrow('whole number');
  expect(() =>
    buildIssueBody(
      patient,
      [{ ...line, substitutionRule: 'BRAND_SPECIFIC' }],
      '',
    ),
  ).toThrow('brand');
  expect(() => buildIssueBody(patient, [line], '2000-01-01T00:00')).toThrow(
    'future',
  );
});

test('doctor searches patients, reviews and issues a brand prescription, then confirms cancellation against the API', async ({
  page,
}) => {
  const clientErrors: string[] = [];
  page.on('pageerror', (error) => clientErrors.push(error.message));
  await login(page);
  await expect(
    page.getByRole('heading', { name: 'Recently issued' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Patients', exact: true }).click();
  await page.getByLabel('Patient name or patient code').fill('PT-DEMO');
  const search = page.waitForResponse((response) =>
    response.url().includes('/api/doctor/patients?'),
  );
  await page.getByRole('button', { name: 'Search patients' }).click();
  const patientData = await (await search).json();
  expect(Object.keys(patientData.items[0]).sort()).toEqual([
    '_id',
    'dateOfBirth',
    'displayName',
    'patientCode',
  ]);
  await page.getByRole('link', { name: 'View patient', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Fictional Patient', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'New prescription for this patient' })
    .click();
  await page.getByLabel('Search medicine catalogue').fill('paracetamol');
  await page.getByRole('button', { name: 'Search medicines' }).click();
  await page.getByRole('button', { name: 'Add medicine', exact: true }).click();
  await page.getByLabel('Quantity').fill('2');
  await page
    .getByLabel('Dosage instructions')
    .fill('Browser test instructions only');
  await page.getByLabel('Frequency').fill('Test frequency');
  await page.getByLabel('Duration').fill('Test duration');
  await page.getByLabel('Substitution rule').selectOption('BRAND_SPECIFIC');
  await page
    .getByRole('button', { name: 'Review prescription', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'select the required brand',
  );
  await page.getByLabel('Brand product').selectOption({
    label:
      'Fictional paracetamol A · Fictional Example Laboratories · 10 units',
  });
  await page
    .getByRole('button', { name: 'Review prescription', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Review prescription', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Browser test instructions only', { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: '../../.tmp/doctor-review.png',
    fullPage: true,
  });
  await page.route(
    '**/api/doctor/prescriptions',
    (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: '{"error":{"message":"Medicine must be active and exist."}}',
      }),
    { times: 1 },
  );
  await page
    .getByRole('button', { name: 'Issue prescription', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'Medicine must be active and exist.',
  );
  const response = page.waitForResponse(
    (value) =>
      value.url().endsWith('/api/doctor/prescriptions') &&
      value.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Issue prescription', exact: true })
    .click();
  const issued = await response;
  expect(issued.status()).toBe(201);
  const payload = issued.request().postDataJSON();
  expect(payload.patientId).toBe(patientData.items[0]._id);
  expect(payload).not.toHaveProperty('expiresAt');
  expect(payload.medications[0]).not.toHaveProperty('refillCount');
  const prescription = await issued.json();
  await expect(
    page.getByRole('heading', { name: prescription.publicCode, exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Cancel prescription', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Confirm cancellation', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'Enter a cancellation reason',
  );
  await page
    .getByLabel('Cancellation reason')
    .fill('Fictional browser test cancellation');
  await page
    .getByRole('button', { name: 'Confirm cancellation', exact: true })
    .click();
  await expect(page.getByText('CANCELLED', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Cancel prescription', exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('CANCELLED', { exact: true })).toBeVisible();
  await page.screenshot({
    path: '../../.tmp/doctor-details.png',
    fullPage: true,
  });
  expect(clientErrors).toEqual([]);
});

test('history pagination, profile, feedback, mobile layout and session rejection', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('link', { name: 'Prescriptions', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText(/Page 2 of/)).toBeVisible();
  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await expect(page.getByText('VERIFIED', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Feedback', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Patient feedback is not connected yet',
    }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/doctor/home');
  await expect(
    page.getByRole('heading', { name: 'Recently issued' }),
  ).toBeVisible();
  await expect(page.locator('.doctor-list .card')).toHaveCount(5);
  await expect(page.getByText('Checking profile…')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: '../../.tmp/doctor-mobile.png',
    fullPage: true,
  });
  // Simulate a revoked session at the network boundary; no production test-only routes.
  await page.route('**/api/doctor/**', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: '{"error":{"message":"Authentication required."}}',
    }),
  );
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: '{"error":{"message":"Please sign in again."}}',
    }),
  );
  await page.goto('/#/doctor/profile');
  await expect(
    page.getByRole('button', { name: 'Sign in', exact: true }),
  ).toBeVisible();
});

test('non-doctor stays in their own workspace even when changing the hash', async ({
  page,
}) => {
  await login(page, 'pharmacy@medora.example.test');
  await expect(page).toHaveURL(/#\/pharmacy\//);
  await page.goto('/#/doctor/new-prescription');
  await expect(page).toHaveURL(/#\/pharmacy\//);
  await expect(
    page.getByRole('heading', { name: 'Create prescription' }),
  ).toHaveCount(0);
});

test('expired access token refreshes once and returns to the real API', async ({
  page,
}) => {
  await login(page);
  await expect(page.locator('.doctor-list .card')).toHaveCount(5);
  await page.route(
    '**/api/doctor/profile',
    (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: '{"error":{"message":"Authentication required."}}',
      }),
    { times: 1 },
  );
  const refresh = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/auth/refresh') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  expect((await refresh).status()).toBe(200);
  await expect(page.getByText('VERIFIED', { exact: true })).toBeVisible();
});

test('unverified doctor sees a clear issuance block and cannot search patients', async ({
  page,
}) => {
  await login(page, 'pending-doctor@medora.example.test');
  await page
    .getByRole('button', { name: 'New Prescription', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Issuance is unavailable', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Search medicine catalogue')).toHaveCount(0);
  await page.getByRole('link', { name: 'Patients', exact: true }).click();
  await page.getByLabel('Patient name or patient code').fill('PT-DEMO');
  await page.getByRole('button', { name: 'Search patients' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'verified doctor profile',
  );
});
