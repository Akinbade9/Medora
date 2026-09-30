import { Types } from 'mongoose';
import { z } from 'zod';
import { User } from '../auth/models.js';
import { hashPassword } from '../auth/password.js';
import {
  Patient,
  Doctor,
  Hospital,
  Pharmacy,
  initializeDomainModels,
} from './index.js';

const id = (suffix: number) =>
  new Types.ObjectId(
    `0000000000000000000000${suffix.toString(16).padStart(2, '0')}`,
  );
const accounts = [
  {
    _id: id(1),
    email: 'patient@medora.example.test',
    displayName: 'Fictional Patient',
    role: 'PATIENT',
  },
  {
    _id: id(2),
    email: 'doctor@medora.example.test',
    displayName: 'Fictional Doctor',
    role: 'DOCTOR',
  },
  {
    _id: id(3),
    email: 'pharmacy@medora.example.test',
    displayName: 'Fictional Pharmacy Admin',
    role: 'PHARMACY_ADMIN',
  },
  {
    _id: id(4),
    email: 'admin@medora.example.test',
    displayName: 'Fictional Platform Admin',
    role: 'PLATFORM_ADMIN',
  },
] as const;
const address = {
  line1: '1 Fictional Example Road',
  city: 'Example City',
  state: 'Example State',
  countryCode: 'NG',
};

// Inserts only: reruns preserve passwords, profile edits, and verification decisions.
export async function seedDevelopmentData(
  password: string,
  environment: string | undefined,
) {
  if (environment !== 'development')
    throw new Error('Seed requires NODE_ENV=development');
  z.string().min(12).max(128).parse(password);
  await Promise.all([User.init(), initializeDomainModels()]);
  for (const account of accounts) {
    const existing = await User.findOne({
      $or: [{ _id: account._id }, { email: account.email }],
    });
    if (
      existing &&
      (!existing._id.equals(account._id) ||
        existing.email !== account.email ||
        existing.role !== account.role)
    ) {
      throw new Error('Seed account conflicts with existing data');
    }
  }
  for (const account of accounts) {
    if (!(await User.exists({ _id: account._id }))) {
      await User.create({
        ...account,
        passwordHash: await hashPassword(password),
      });
    }
  }
  if (!(await Hospital.exists({ _id: id(5) }))) {
    await Hospital.create({
      _id: id(5),
      name: 'Fictional Example Hospital',
      address,
      phone: '+2340000000001',
      email: 'hospital@medora.example.test',
    });
  }
  if (!(await Patient.exists({ _id: id(6) }))) {
    await Patient.create({
      _id: id(6),
      userId: id(1),
      patientCode: 'PT-DEMO-0001',
      dateOfBirth: new Date('1995-06-15T00:00:00Z'),
      gender: 'PREFER_NOT_TO_SAY',
      savedAddresses: [{ label: 'Fictional home', address }],
    });
  }
  if (!(await Doctor.exists({ _id: id(7) }))) {
    await Doctor.create({
      _id: id(7),
      userId: id(2),
      hospitalId: id(5),
      professionalRegistrationNumber: 'DEMO-DOCTOR-0001',
      specialty: 'General practice',
    });
  }
  if (!(await Pharmacy.exists({ _id: id(8) }))) {
    await Pharmacy.create({
      _id: id(8),
      adminUserId: id(3),
      name: 'Fictional Example Pharmacy',
      licenceNumber: 'DEMO-PHARMACY-0001',
      address,
      location: { type: 'Point', coordinates: [3.39, 6.45] },
      phone: '+2340000000002',
      email: 'pharmacy@medora.example.test',
      timeZone: 'Africa/Lagos',
      pickupAvailable: true,
      deliveryAvailable: false,
      operatingHours: Array.from({ length: 7 }, (_, day) =>
        day === 0
          ? { day, closed: true }
          : { day, closed: false, opensAt: '09:00', closesAt: '17:00' },
      ),
    });
  }
}
