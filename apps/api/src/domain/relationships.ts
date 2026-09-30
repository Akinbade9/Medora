import type { Role } from '@medora/shared-types';
import type { Types } from 'mongoose';
import { Patient, Doctor, Pharmacy } from './index.js';

export async function assertCompatibleProfileRole(
  userId: Types.ObjectId,
  role: Role,
) {
  const [patient, doctor, pharmacy] = await Promise.all([
    Patient.exists({ userId }),
    Doctor.exists({ userId }),
    Pharmacy.exists({ adminUserId: userId }),
  ]);
  if (
    (patient && role !== 'PATIENT') ||
    (doctor && role !== 'DOCTOR') ||
    (pharmacy && role !== 'PHARMACY_ADMIN')
  ) {
    throw new Error('Role conflicts with an existing domain profile');
  }
}
