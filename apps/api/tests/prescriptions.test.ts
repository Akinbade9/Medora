import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User, AuthSession } from '../src/auth/models.js';
import { AuthService } from '../src/auth/service.js';
import {
  Patient,
  Doctor,
  Hospital,
  initializeDomainModels,
} from '../src/domain/index.js';
import {
  Medicine,
  MedicineProduct,
  initializeCatalogueModels,
} from '../src/catalogue/models.js';
import {
  Prescription,
  isPrescriptionActive,
} from '../src/prescriptions/model.js';
import { generatePrescriptionCode } from '../src/prescriptions/code.js';
import { issuePrescription } from '../src/prescriptions/service.js';
import type { IssueInput } from '../src/prescriptions/validation.js';
import { testConfig } from './config.js';

let database: MongoMemoryServer;
const app = createApp(testConfig);
let doctorAuth: Awaited<ReturnType<AuthService['register']>>;
let patientAuth: typeof doctorAuth;
let otherDoctor: typeof doctorAuth;
let otherPatient: typeof doctorAuth;
let doctorId: mongoose.Types.ObjectId;
let hospitalId: mongoose.Types.ObjectId;
let productId: string;
let otherMedicineId: string;
let input: IssueInput;
const auth = (
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
  token = doctorAuth.accessToken,
) =>
  request(app)[method](`/api/${path}`).set('Authorization', `Bearer ${token}`);
const issue = (body: object = input) =>
  auth('post', 'doctor/prescriptions').send(body);
const cancel = (id: string, token = doctorAuth.accessToken) =>
  auth('post', `doctor/prescriptions/${id}/cancel`, token).send({
    cancellationReason: 'Issued in error; fictional test only.',
  });
before(
  async () => {
    database = await MongoMemoryServer.create({
      instance: { launchTimeout: 60000 },
    });
    await mongoose.connect(database.getUri());
    await Promise.all([
      User.init(),
      AuthSession.init(),
      initializeDomainModels(),
      initializeCatalogueModels(),
      Prescription.init(),
    ]);
    const service = new AuthService(testConfig);
    const createUser = (email: string) =>
      service.register({
        displayName: 'Fictional test account',
        email,
        password: 'prescription test-only password',
      });
    doctorAuth = await createUser('rx-doctor@example.test');
    patientAuth = await createUser('rx-patient@example.test');
    otherDoctor = await createUser('rx-other-doctor@example.test');
    otherPatient = await createUser('rx-other-patient@example.test');
    await User.updateMany(
      { _id: { $in: [doctorAuth.user.id, otherDoctor.user.id] } },
      { role: 'DOCTOR' },
    );
  },
  { timeout: 300000 },
);
beforeEach(async () => {
  await Promise.all([
    Prescription.deleteMany({}),
    Patient.deleteMany({}),
    Doctor.deleteMany({}),
    Hospital.deleteMany({}),
    Medicine.deleteMany({}),
    MedicineProduct.deleteMany({}),
  ]);
  const hospital = await Hospital.create({
    name: 'Fictional hospital',
    address: {
      line1: '1 Example Road',
      city: 'Example',
      state: 'Example',
      countryCode: 'NG',
    },
    phone: '+2340000000001',
    email: 'hospital@example.test',
  });
  hospitalId = hospital._id;
  const doctor = await Doctor.create({
    userId: doctorAuth.user.id,
    hospitalId,
    professionalRegistrationNumber: 'TEST-RX-DOCTOR',
    specialty: 'General practice',
    verificationStatus: 'VERIFIED',
  });
  doctorId = doctor._id;
  await Doctor.create({
    userId: otherDoctor.user.id,
    hospitalId,
    professionalRegistrationNumber: 'TEST-RX-OTHER',
    specialty: 'General practice',
    verificationStatus: 'VERIFIED',
  });
  const patient = await Patient.create({
    userId: patientAuth.user.id,
    dateOfBirth: new Date('2000-01-01'),
    gender: 'PREFER_NOT_TO_SAY',
  });
  await Patient.create({
    userId: otherPatient.user.id,
    dateOfBirth: new Date('2000-01-01'),
    gender: 'PREFER_NOT_TO_SAY',
  });
  const medicine = await Medicine.create({
    genericName: 'Fictional test compound',
    activeIngredient: 'Fictional ingredient',
    strength: 5,
    strengthUnit: 'mg',
    dosageForm: 'tablet',
    category: 'Software fixture',
  });
  const otherMedicine = await Medicine.create({
    genericName: 'Other fictional compound',
    activeIngredient: 'Other fictional ingredient',
    strength: 10,
    strengthUnit: 'mg',
    dosageForm: 'tablet',
    category: 'Software fixture',
  });
  otherMedicineId = otherMedicine._id.toString();
  const product = await MedicineProduct.create({
    medicineId: medicine._id,
    brandName: 'Fictional Brand',
    manufacturer: 'Example',
    packSize: '10 tablets',
    productCode: 'RX-TEST',
  });
  productId = product._id.toString();
  input = {
    patientId: patient._id.toString(),
    medications: [
      {
        medicineId: medicine._id.toString(),
        strength: 5,
        dosageForm: 'Tablet',
        quantity: 10,
        dosageInstructions: 'Software test instructions only',
        frequency: 'Software test frequency',
        duration: 'Software test duration',
        substitutionRule: 'GENERIC_ALLOWED',
      },
    ],
  };
});
after(async () => {
  await mongoose.disconnect();
  await database?.stop();
});

test('verified doctor issues prescriptions with secure unique codes, snapshots and scoped pagination', async () => {
  const first = await issue({
    ...input,
    medications: [
      input.medications[0],
      { ...input.medications[0], medicineId: otherMedicineId, strength: 10 },
    ],
  }).expect(201);
  assert.equal(first.body.medications.length, 2);
  const second = await issue().expect(201);
  assert.match(first.body.publicCode, /^RX-\d{2}-[2-9A-HJ-NP-Z]{8}$/);
  assert.notEqual(first.body.publicCode, second.body.publicCode);
  assert.equal(first.body.doctorId, doctorId.toString());
  assert.equal(first.body.hospitalId, hospitalId.toString());
  assert.equal(first.body.status, 'ISSUED');
  assert.equal(first.body.isActive, true);
  assert.equal(first.body.viewedAt, null);
  assert.equal(first.body.medications[0].quantityDispensed, 0);
  assert.equal(first.body.medications[0].strengthUnit, 'mg');
  assert.ok(
    first.body.createdAt && first.body.updatedAt && first.body.issuedAt,
  );
  const listed = await auth(
    'get',
    'doctor/prescriptions?limit=1&page=1',
  ).expect(200);
  assert.equal(listed.body.total, 2);
  assert.equal(listed.body.items.length, 1);
  await auth('get', 'doctor/prescriptions?limit=101').expect(400);
  assert.match(generatePrescriptionCode(new Date('2026-01-01')), /^RX-26-/);
});

test('unverified doctors, inactive hospitals and broken hospital relationships cannot issue', async () => {
  const doctor = await Doctor.findById(doctorId).orFail();
  for (const status of ['PENDING', 'SUSPENDED', 'REJECTED'] as const) {
    doctor.verificationStatus = status;
    await doctor.save();
    await issue().expect(403);
  }
  doctor.verificationStatus = 'VERIFIED';
  await doctor.save();
  const hospital = await Hospital.findById(hospitalId).orFail();
  hospital.verificationStatus = 'SUSPENDED';
  await hospital.save();
  await issue().expect(403);
  await Hospital.deleteMany({});
  await issue().expect(403);
  assert.equal(await Prescription.countDocuments(), 0);
});

test('missing patients, inactive medicines, bad snapshots and server-owned field injection fail', async () => {
  await issue({
    ...input,
    patientId: new mongoose.Types.ObjectId().toString(),
  }).expect(400);
  for (const injected of [
    { publicCode: 'RX-26-AAAAAAAA' },
    { doctorId: otherDoctor.user.id },
    { hospitalId: hospitalId.toString() },
    { status: 'VIEWED' },
    { issuedAt: new Date().toISOString() },
  ])
    await issue({ ...input, ...injected }).expect(400);
  for (const change of [
    { quantity: 0 },
    { quantity: 1.2 },
    { strength: 10 },
    { dosageForm: 'capsule' },
    { dosageInstructions: '' },
    { quantityDispensed: 1 },
    { refillCount: 1 },
    { medicineId: new mongoose.Types.ObjectId().toString() },
  ])
    await issue({
      ...input,
      medications: [{ ...input.medications[0], ...change }],
    }).expect(400);
  await issue({ ...input, medications: [] }).expect(400);
  await issue({ ...input, expiresAt: '2020-01-01T00:00:00Z' }).expect(400);
  const medicine = await Medicine.findById(
    input.medications[0]!.medicineId,
  ).orFail();
  medicine.status = 'INACTIVE';
  await medicine.save();
  await issue().expect(400);
});

test('all substitution rules are accepted with valid generic or linked brand selection', async () => {
  for (const substitutionRule of [
    'GENERIC_ALLOWED',
    'BRAND_SPECIFIC',
    'DO_NOT_SUBSTITUTE',
  ] as const) {
    const entry = {
      ...input.medications[0]!,
      substitutionRule,
      ...(substitutionRule === 'BRAND_SPECIFIC'
        ? { medicineProductId: productId }
        : {}),
    };
    const result = await issue({ ...input, medications: [entry] }).expect(201);
    assert.equal(result.body.medications[0].substitutionRule, substitutionRule);
  }
  await issue({
    ...input,
    medications: [
      {
        ...input.medications[0],
        substitutionRule: 'DO_NOT_SUBSTITUTE',
        medicineProductId: productId,
      },
    ],
  }).expect(201);
});

test('brand-specific entries require an active product linked to the selected medicine', async () => {
  const base = { ...input.medications[0], substitutionRule: 'BRAND_SPECIFIC' };
  await issue({ ...input, medications: [base] }).expect(400);
  await issue({
    ...input,
    medications: [
      { ...base, medicineProductId: new mongoose.Types.ObjectId().toString() },
    ],
  }).expect(400);
  await issue({
    ...input,
    medications: [
      {
        ...base,
        medicineProductId: productId,
        medicineId: otherMedicineId,
        strength: 10,
      },
    ],
  }).expect(400);
  await issue({
    ...input,
    medications: [{ ...input.medications[0], medicineProductId: productId }],
  }).expect(400);
  const product = await MedicineProduct.findById(productId).orFail();
  product.status = 'INACTIVE';
  await product.save();
  await issue({
    ...input,
    medications: [{ ...base, medicineProductId: productId }],
  }).expect(400);
});

test('patients view only their own records; viewing is idempotent and lists do not mark viewed', async () => {
  const created = await issue().expect(201);
  const id = created.body._id;
  const list = await auth(
    'get',
    'patient/prescriptions',
    patientAuth.accessToken,
  ).expect(200);
  assert.equal(list.body.items[0].status, 'ISSUED');
  const viewed = await auth(
    'get',
    `patient/prescriptions/${id}`,
    patientAuth.accessToken,
  ).expect(200);
  assert.equal(viewed.body.status, 'VIEWED');
  assert.ok(viewed.body.viewedAt);
  const again = await auth(
    'get',
    `patient/prescriptions/${id}`,
    patientAuth.accessToken,
  ).expect(200);
  assert.equal(again.body.viewedAt, viewed.body.viewedAt);
  await auth(
    'get',
    `patient/prescriptions/${id}`,
    otherPatient.accessToken,
  ).expect(404);
  assert.equal(
    (
      await auth(
        'get',
        'patient/prescriptions',
        otherPatient.accessToken,
      ).expect(200)
    ).body.total,
    0,
  );
  await auth(
    'get',
    `doctor/prescriptions/${id}`,
    otherDoctor.accessToken,
  ).expect(404);
  assert.equal(
    (
      await auth('get', 'doctor/prescriptions', otherDoctor.accessToken).expect(
        200,
      )
    ).body.total,
    0,
  );
  await cancel(id, otherDoctor.accessToken).expect(404);
});

test('patients cannot issue, cancel or edit clinical fields; unauthenticated requests fail', async () => {
  const created = await issue().expect(201);
  const id = created.body._id;
  await request(app).post('/api/doctor/prescriptions').send(input).expect(401);
  await request(app).get('/api/patient/prescriptions').expect(401);
  await auth('post', 'doctor/prescriptions', patientAuth.accessToken)
    .send(input)
    .expect(403);
  await cancel(id, patientAuth.accessToken).expect(403);
  await auth('patch', `patient/prescriptions/${id}`, patientAuth.accessToken)
    .send({ medications: [] })
    .expect(404);
  await auth('patch', `doctor/prescriptions/${id}`)
    .send({ medications: [] })
    .expect(404);
  await auth(
    'delete',
    `patient/prescriptions/${id}`,
    patientAuth.accessToken,
  ).expect(404);
  const persisted = await Prescription.findById(id).orFail();
  assert.equal(persisted.medications[0]!.quantity, 10);
  persisted.medications[0]!.quantity = 999;
  await assert.rejects(persisted.save(), /cannot be changed/);
});

test('unique index rejects duplicate public codes and allocator retries prechecked and racing collisions', async () => {
  const code = 'RX-26-AAAAAAAA';
  const original = await issuePrescription(
    doctorAuth.user.id,
    input,
    () => code,
  );
  await assert.rejects(
    Prescription.create({
      ...original.toObject(),
      _id: new mongoose.Types.ObjectId(),
    }),
    (error: unknown) =>
      error instanceof mongoose.mongo.MongoServerError && error.code === 11000,
  );
  let calls = 0;
  const retried = await issuePrescription(doctorAuth.user.id, input, () =>
    ++calls === 1 ? code : 'RX-26-BBBBBBBB',
  );
  assert.equal(retried.publicCode, 'RX-26-BBBBBBBB');
  assert.equal(calls, 2);
  await assert.rejects(
    issuePrescription(doctorAuth.user.id, input, () => code),
    /allocate/,
  );
  const factory = () => {
    let count = 0;
    return () =>
      ++count === 1 ? 'RX-26-CCCCCCCC' : generatePrescriptionCode();
  };
  const results = await Promise.all([
    issuePrescription(doctorAuth.user.id, input, factory()),
    issuePrescription(doctorAuth.user.id, input, factory()),
  ]);
  assert.notEqual(results[0].publicCode, results[1].publicCode);
});

test('cancellation before dispensing is terminal and concurrent viewing cannot reactivate it', async () => {
  const created = await issue().expect(201);
  const id = created.body._id;
  await Promise.all([
    cancel(id).expect(200),
    auth('get', `patient/prescriptions/${id}`, patientAuth.accessToken).expect(
      200,
    ),
  ]);
  const result = await auth(
    'get',
    `patient/prescriptions/${id}`,
    patientAuth.accessToken,
  ).expect(200);
  assert.equal(result.body.status, 'CANCELLED');
  assert.equal(result.body.isActive, false);
  assert.ok(result.body.cancelledAt && result.body.cancellationReason);
  const persisted = await Prescription.findById(id).orFail();
  assert.equal(isPrescriptionActive(persisted), false);
  persisted.status = 'ISSUED';
  await assert.rejects(persisted.save(), /Terminal prescription status/);
  await cancel(id).expect(409);
});

test('any dispensed quantity prevents cancellation', async () => {
  const created = await issue().expect(201);
  // Simulate a future trusted dispensing writer; no dispensing endpoint exists.
  await Prescription.collection.updateOne(
    { _id: new mongoose.Types.ObjectId(created.body._id) },
    { $set: { 'medications.0.quantityDispensed': 1 }, $inc: { __v: 1 } },
  );
  await cancel(created.body._id).expect(409);
  assert.equal(
    (await Prescription.findById(created.body._id))?.status,
    'ISSUED',
  );
});

test('expired prescriptions are inactive before materialization and cannot be viewed into active state or cancelled', async () => {
  const created = await issue({
    ...input,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  }).expect(201);
  // Move time-bound fixture into the past without waiting or exposing an edit API.
  await Prescription.collection.updateOne(
    { _id: new mongoose.Types.ObjectId(created.body._id) },
    { $set: { expiresAt: new Date(Date.now() - 1000) } },
  );
  assert.equal(
    isPrescriptionActive((await Prescription.findById(created.body._id))!),
    false,
  );
  await cancel(created.body._id).expect(409);
  const result = await auth(
    'get',
    `patient/prescriptions/${created.body._id}`,
    patientAuth.accessToken,
  ).expect(200);
  assert.equal(result.body.status, 'EXPIRED');
  assert.equal(result.body.isActive, false);
  assert.equal(result.body.viewedAt, null);
});

test('historical prescriptions retain snapshots after catalogue deactivation and edits', async () => {
  const created = await issue().expect(201);
  const medicine = await Medicine.findById(
    input.medications[0]!.medicineId,
  ).orFail();
  medicine.genericName = 'Changed catalogue name';
  medicine.strength = 99;
  medicine.status = 'INACTIVE';
  await medicine.save();
  const viewed = await auth(
    'get',
    `patient/prescriptions/${created.body._id}`,
    patientAuth.accessToken,
  ).expect(200);
  assert.equal(
    viewed.body.medications[0].genericName,
    'fictional test compound',
  );
  assert.equal(viewed.body.medications[0].strength, 5);
  await cancel(created.body._id).expect(200);
});

test('doctor patient search exposes only valid profile summaries and enforces verified doctor access', async () => {
  await request(app).get('/api/doctor/patients?q=Fictional').expect(401);
  await auth(
    'get',
    'doctor/patients?q=Fictional',
    patientAuth.accessToken,
  ).expect(403);
  const result = await auth(
    'get',
    'doctor/patients?q=Fictional&limit=1',
  ).expect(200);
  assert.equal(result.body.total, 2);
  assert.equal(result.body.items.length, 1);
  assert.deepEqual(Object.keys(result.body.items[0]).sort(), [
    '_id',
    'dateOfBirth',
    'displayName',
    'patientCode',
  ]);
  assert.notEqual(result.body.items[0]._id, patientAuth.user.id);
  await auth('get', `doctor/patients/${input.patientId}`).expect(200);
  await auth('get', `doctor/patients/${new mongoose.Types.ObjectId()}`).expect(
    404,
  );
  await auth('get', 'doctor/patients?q=x').expect(400);
  assert.equal(
    (await auth('get', 'doctor/patients?q=.*').expect(200)).body.total,
    0,
  );
  const profile = await auth('get', 'doctor/profile').expect(200);
  assert.equal(profile.body.canIssue, true);
  assert.equal(profile.body.hospital.name, 'Fictional hospital');
  const doctor = await Doctor.findById(doctorId).orFail();
  doctor.verificationStatus = 'PENDING';
  await doctor.save();
  await auth('get', 'doctor/patients?q=Fictional').expect(403);
  await auth('get', `doctor/patients/${input.patientId}`).expect(403);
  assert.equal(
    (await auth('get', 'doctor/profile').expect(200)).body.canIssue,
    false,
  );
});
