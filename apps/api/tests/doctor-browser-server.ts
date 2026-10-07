// Isolated browser-test fixture server. Never reads .env or exposes fixture setup routes.
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { randomBytes } from 'node:crypto';
import { createApp } from '../src/app.js';
import { seedDevelopmentData } from '../src/domain/seed-data.js';
import { seedCatalogue } from '../src/catalogue/seed-data.js';
import { Doctor, Patient } from '../src/domain/index.js';
import { User, AuthSession } from '../src/auth/models.js';
import { Prescription } from '../src/prescriptions/model.js';
import { Medicine } from '../src/catalogue/models.js';
import { issuePrescription } from '../src/prescriptions/service.js';

const database = await MongoMemoryServer.create({
  instance: { launchTimeout: 60000 },
});
await mongoose.connect(database.getUri());
await seedDevelopmentData('browser test password only', 'development');
await seedCatalogue('development');
await Promise.all([AuthSession.init(), Prescription.init()]);
const doctor = await Doctor.findOne().orFail();
doctor.verificationStatus = 'VERIFIED';
await doctor.save();
const user = await User.findOne({ role: 'DOCTOR' }).orFail();
const sourceUser = await User.findById(user._id)
  .select('+passwordHash')
  .orFail();
const pending = await User.create({
  displayName: 'Fictional Pending Doctor',
  email: 'pending-doctor@medora.example.test',
  passwordHash: sourceUser.passwordHash,
  role: 'DOCTOR',
});
await Doctor.create({
  userId: pending._id,
  hospitalId: doctor.hospitalId,
  professionalRegistrationNumber: 'BROWSER-PENDING-ONLY',
  specialty: 'General practice',
});
const patient = await Patient.findOne().orFail();
const medicine = await Medicine.findOne({
  genericName: 'paracetamol',
}).orFail();
for (let index = 0; index < 11; index++)
  await issuePrescription(user.id, {
    patientId: patient.id,
    medications: [
      {
        medicineId: medicine.id,
        quantity: 1,
        dosageInstructions: 'Fictional browser fixture',
        frequency: 'Test frequency',
        duration: 'Test duration',
        substitutionRule: 'GENERIC_ALLOWED',
      },
    ],
  });
const config = {
  mongoUri: database.getUri(),
  jwtKey: randomBytes(32),
  origins: ['http://127.0.0.1:5299'],
  secureCookies: false,
  accessSeconds: 900,
  refreshSeconds: 604800,
};
const server = createApp(config).listen(3299, '127.0.0.1');
async function shutdown() {
  server.close();
  await mongoose.disconnect();
  await database.stop();
  process.exit(0);
}
process.on('SIGTERM', () => {
  void shutdown();
});
process.on('SIGINT', () => {
  void shutdown();
});
