import { Patient } from './patient.js';
import { Doctor } from './doctor.js';
import { Hospital } from './hospital.js';
import { Pharmacy } from './pharmacy.js';
export { Patient, Doctor, Hospital, Pharmacy };
export async function initializeDomainModels() {
  await Promise.all([
    Patient.init(),
    Doctor.init(),
    Hospital.init(),
    Pharmacy.init(),
  ]);
}
