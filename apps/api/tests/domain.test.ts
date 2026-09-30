import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import mongoose from 'mongoose';
import type { Role } from '@medora/shared-types';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { User } from '../src/auth/models.js';
import { verifyPassword } from '../src/auth/password.js';
import {
  Patient,
  Doctor,
  Hospital,
  Pharmacy,
  initializeDomainModels,
} from '../src/domain/index.js';
import { seedDevelopmentData } from '../src/domain/seed-data.js';
import { assertCompatibleProfileRole } from '../src/domain/relationships.js';

let database: MongoMemoryServer;
const address = {
  line1: '1 Test Street',
  city: 'Test City',
  state: 'Test State',
  countryCode: 'NG',
};
const hospitalInput = {
  name: 'Test Hospital',
  address,
  phone: '+2340000000001',
  email: 'hospital@example.test',
};
let sequence = 0;
const user = (role: Role = 'PATIENT') =>
  User.create({
    displayName: 'Test User',
    email: `test-${sequence++}@example.test`,
    passwordHash: 'not-a-login-fixture',
    role,
  });
const patientInput = (userId: mongoose.Types.ObjectId) => ({
  userId,
  dateOfBirth: new Date('2000-01-01'),
  gender: 'OTHER' as const,
});
const pharmacyInput = (adminUserId: mongoose.Types.ObjectId) => ({
  adminUserId,
  name: 'Test Pharmacy',
  licenceNumber: 'LIC-123',
  address,
  location: { type: 'Point' as const, coordinates: [3.39, 6.45] },
  phone: '+2340000000002',
  email: 'pharmacy@example.test',
  timeZone: 'Africa/Lagos',
});
const invalid = (promise: PromiseLike<unknown>) =>
  assert.rejects(Promise.resolve(promise), { name: 'ValidationError' });
const duplicate = (promise: PromiseLike<unknown>) =>
  assert.rejects(
    Promise.resolve(promise),
    (error: unknown) =>
      error instanceof Error && 'code' in error && error.code === 11000,
  );

before(
  async () => {
    database = await MongoMemoryServer.create();
    await mongoose.connect(database.getUri());
    await Promise.all([User.init(), initializeDomainModels()]);
  },
  { timeout: 300_000 },
);
beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Patient.deleteMany({}),
    Doctor.deleteMany({}),
    Hospital.deleteMany({}),
    Pharmacy.deleteMany({}),
  ]);
});
after(async () => {
  await mongoose.disconnect();
  await database?.stop();
});

test('patient saves preferences, addresses and generated unique patient code', async () => {
  const account = await user();
  const patient = await Patient.create({
    ...patientInput(account._id),
    savedAddresses: [{ label: 'Home', address }],
  });
  assert.match(patient.patientCode, /^PT-[A-F0-9]{20}$/);
  assert.equal(patient.notificationPreferences.sms, false);
  assert.equal(patient.savedAddresses[0]?.address.city, 'Test City');
  assert.equal(patient.createdAt instanceof Date, true);
  await duplicate(Patient.create(patientInput(account._id)));
  await duplicate(
    Patient.create({
      ...patientInput((await user())._id),
      patientCode: patient.patientCode.toLowerCase(),
    }),
  );
});

test('patient rejects missing, invalid and future birth dates, invalid gender and nested addresses', async () => {
  const input = patientInput((await user())._id);
  for (const change of [
    { dateOfBirth: undefined },
    { dateOfBirth: 'bad' },
    { dateOfBirth: new Date(Date.now() + 86_400_000) },
    { gender: 'UNKNOWN' },
    { savedAddresses: [{ label: 'Home', address: { city: 'Incomplete' } }] },
    {
      savedAddresses: Array.from({ length: 11 }, () => ({
        label: 'Home',
        address,
      })),
    },
  ]) {
    await invalid(new Patient({ ...input, ...change }).validate());
  }
  assert.throws(
    () => new Patient({ ...input, unexpected: true }),
    /not in schema/,
  );
});

test('profiles require existing users of the correct role', async () => {
  const hospital = await Hospital.create(hospitalInput);
  const wrong = await user('PLATFORM_ADMIN');
  for (const userId of [wrong._id, new mongoose.Types.ObjectId()]) {
    await invalid(new Patient(patientInput(userId)).validate());
    await invalid(
      new Doctor({
        userId,
        hospitalId: hospital._id,
        professionalRegistrationNumber: 'REG-1',
        specialty: 'General practice',
      }).validate(),
    );
    await invalid(new Pharmacy(pharmacyInput(userId)).validate());
  }
  await invalid(
    new Patient({ ...patientInput(wrong._id), userId: undefined }).validate(),
  );
});

test('doctor requires an existing hospital and unique registration and user references', async () => {
  const account = await user('DOCTOR');
  const hospital = await Hospital.create(hospitalInput);
  const input = {
    userId: account._id,
    hospitalId: hospital._id,
    professionalRegistrationNumber: ' reg-123 ',
    specialty: 'General practice',
  };
  await invalid(
    new Doctor({
      ...input,
      hospitalId: new mongoose.Types.ObjectId(),
    }).validate(),
  );
  await invalid(new Doctor({ ...input, specialty: '' }).validate());
  const doctor = await Doctor.create(input);
  assert.equal(doctor.professionalRegistrationNumber, 'REG-123');
  assert.equal(doctor.verificationStatus, 'PENDING');
  await duplicate(
    Doctor.create({
      ...input,
      userId: (await user('DOCTOR'))._id,
      professionalRegistrationNumber: 'REG-123',
    }),
  );
  await duplicate(
    Doctor.create({ ...input, professionalRegistrationNumber: 'REG-456' }),
  );
});

test('hospital validates contact data, document metadata and verification statuses', async () => {
  for (const change of [
    { name: ' ' },
    { email: 'bad' },
    { phone: 'bad' },
    { verificationStatus: 'APPROVED' },
    {
      verificationDocuments: [
        {
          kind: 'LICENCE',
          fileName: 'test.pdf',
          storageKey: 'private/test.pdf',
          mimeType: 'application/pdf',
          sizeBytes: -1,
          uploadedAt: new Date(),
        },
      ],
    },
  ]) {
    await invalid(new Hospital({ ...hospitalInput, ...change }).validate());
  }
  const hospital = await Hospital.create({
    ...hospitalInput,
    verificationDocuments: [
      {
        kind: 'REGISTRATION',
        fileName: 'test.pdf',
        storageKey: 'private/test.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 100,
        uploadedAt: new Date(),
      },
    ],
  });
  const ordinaryRead = await Hospital.findById(hospital._id).lean();
  assert.equal(ordinaryRead?.verificationDocuments, undefined);
  assert.equal(
    (await Hospital.findById(hospital._id).select('+verificationDocuments'))
      ?.verificationDocuments.length,
    1,
  );
  for (const status of [
    'PENDING',
    'VERIFIED',
    'SUSPENDED',
    'REJECTED',
  ] as const) {
    hospital.verificationStatus = status;
    await hospital.save();
  }
});

test('pharmacy enforces normalized unique licences, including simultaneous inserts', async () => {
  const input = pharmacyInput((await user('PHARMACY_ADMIN'))._id);
  const outcomes = await Promise.allSettled([
    Pharmacy.create({ ...input, licenceNumber: ' lic-123 ' }),
    Pharmacy.create(input),
  ]);
  assert.equal(
    outcomes.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  const failure = outcomes.find((result) => result.status === 'rejected');
  assert.equal(failure?.status === 'rejected' && failure.reason.code, 11000);
  const pharmacy = await Pharmacy.findOne().orFail();
  assert.equal(pharmacy.licenceNumber, 'LIC-123');
  assert.equal(pharmacy.inventoryLastUpdatedAt, null);
  assert.equal(pharmacy.pickupAvailable, false);
});

test('pharmacy rejects invalid coordinates, time zones, hours and inventory timestamps', async () => {
  const input = pharmacyInput((await user('PHARMACY_ADMIN'))._id);
  for (const coordinates of [[181, 0], [0, -91], [0], [0, 0, 0]]) {
    await invalid(
      new Pharmacy({
        ...input,
        location: { type: 'Point', coordinates },
      }).validate(),
    );
  }
  for (const change of [
    { timeZone: 'Not/AZone' },
    { inventoryLastUpdatedAt: new Date(Date.now() + 86_400_000) },
    { operatingHours: [{ day: 0, closed: false }] },
    { operatingHours: [{ day: 7, closed: true }] },
    {
      operatingHours: [
        { day: 0, closed: true },
        { day: 0, closed: true },
      ],
    },
    {
      operatingHours: [
        { day: 1, closed: false, opensAt: '17:00', closesAt: '09:00' },
      ],
    },
    { operatingHours: [{ day: 1, closed: true, opensAt: '09:00' }] },
    {
      operatingHours: [
        { day: 1, closed: false, opensAt: '25:00', closesAt: '26:00' },
      ],
    },
  ])
    await invalid(new Pharmacy({ ...input, ...change }).validate());
  const pharmacy = await Pharmacy.create({
    ...input,
    operatingHours: [
      {
        day: 1,
        closed: false,
        opensAt: '20:00',
        closesAt: '08:00',
        closesNextDay: true,
      },
    ],
  });
  assert.equal(pharmacy.operatingHours[0]?.closesNextDay, true);
  const nearby = await Pharmacy.find({
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [3.39, 6.45] },
        $maxDistance: 100,
      },
    },
  });
  assert.equal(nearby.length, 1);
});

test('document updates revalidate role references; query and bulk updates cannot bypass validation', async () => {
  const patient = await Patient.create(patientInput((await user())._id));
  patient.userId = (await user('DOCTOR'))._id;
  await invalid(patient.save());
  await assert.rejects(
    Patient.updateOne({ _id: patient._id }, { gender: 'INVALID' }),
    /document.save/,
  );
  await assert.rejects(
    Patient.findByIdAndUpdate(patient._id, { gender: 'INVALID' }),
    /document.save/,
  );
  await assert.rejects(
    Patient.bulkWrite([
      {
        updateOne: {
          filter: { _id: patient._id },
          update: { $set: { gender: 'MALE' } },
        },
      },
    ]),
    /document.save/,
  );
});

test('role assignment helper prevents profile conflicts for all linked roles', async () => {
  const patientUser = await user();
  await Patient.create(patientInput(patientUser._id));
  await assertCompatibleProfileRole(patientUser._id, 'PATIENT');
  await assert.rejects(
    assertCompatibleProfileRole(patientUser._id, 'DOCTOR'),
    /conflicts/,
  );
  const pharmacyUser = await user('PHARMACY_ADMIN');
  await Pharmacy.create(pharmacyInput(pharmacyUser._id));
  await assert.rejects(
    assertCompatibleProfileRole(pharmacyUser._id, 'PATIENT'),
    /conflicts/,
  );
  const doctorUser = await user('DOCTOR');
  await Doctor.create({
    userId: doctorUser._id,
    hospitalId: (await Hospital.create(hospitalInput))._id,
    professionalRegistrationNumber: 'REG-1',
    specialty: 'General practice',
  });
  await assert.rejects(
    assertCompatibleProfileRole(doctorUser._id, 'PATIENT'),
    /conflicts/,
  );
});

test('seed is development-only, repeatable and preserves accounts, hashes and profile edits', async () => {
  const password = 'unique seed test password';
  await assert.rejects(seedDevelopmentData(password, 'production'), /NODE_ENV/);
  await assert.rejects(seedDevelopmentData('short', 'development'));
  assert.equal(await User.countDocuments(), 0);
  await seedDevelopmentData(password, 'development');
  const account = await User.findOne({ role: 'PATIENT' })
    .select('+passwordHash')
    .orFail();
  assert.equal(await verifyPassword(password, account.passwordHash), true);
  assert.equal('passwordHash' in account.toJSON(), false);
  const patient = await Patient.findOne().orFail();
  patient.notificationPreferences.sms = true;
  await patient.save();
  await seedDevelopmentData('another seed test password', 'development');
  assert.equal(await User.countDocuments(), 4);
  assert.equal(await Hospital.countDocuments(), 1);
  assert.equal(await Doctor.countDocuments(), 1);
  assert.equal(await Patient.countDocuments(), 1);
  assert.equal(await Pharmacy.countDocuments(), 1);
  assert.equal((await Patient.findOne())?.notificationPreferences.sms, true);
  assert.equal(
    (await User.findById(account._id).select('+passwordHash'))?.passwordHash,
    account.passwordHash,
  );
  assert.deepEqual((await User.find().distinct('role')).sort(), [
    'DOCTOR',
    'PATIENT',
    'PHARMACY_ADMIN',
    'PLATFORM_ADMIN',
  ]);
});

test('seed refuses conflicting accounts instead of changing their roles or passwords', async () => {
  await User.create({
    displayName: 'Existing',
    email: 'doctor@medora.example.test',
    passwordHash: 'untouched',
    role: 'PATIENT',
  });
  await assert.rejects(
    seedDevelopmentData('unique seed test password', 'development'),
    /conflicts/,
  );
  assert.equal(await User.countDocuments(), 1);
  assert.equal(
    (await User.findOne().select('+passwordHash'))?.passwordHash,
    'untouched',
  );
});
