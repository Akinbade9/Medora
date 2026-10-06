import mongoose from 'mongoose';
import { AuthError } from '../auth/validation.js';
import { Doctor, Hospital, Patient } from '../domain/index.js';
import { User } from '../auth/models.js';
import { Medicine, MedicineProduct } from '../catalogue/models.js';
import { normalizeText } from '../catalogue/validation.js';
import { Prescription, isPrescriptionActive } from './model.js';
import { generatePrescriptionCode } from './code.js';
import type { IssueInput } from './validation.js';

export async function doctorProfile(userId: string, issuing = false) {
  const doctor = await Doctor.findOne({ userId });
  if (!doctor || (issuing && doctor.verificationStatus !== 'VERIFIED'))
    throw new AuthError(
      403,
      'A verified doctor profile is required to issue prescriptions.',
    );
  return doctor;
}
export async function patientProfile(userId: string) {
  const patient = await Patient.findOne({ userId });
  if (!patient) throw new AuthError(403, 'Patient profile required.');
  return patient;
}
export async function issuePrescription(
  userId: string,
  input: IssueInput,
  codeFactory = generatePrescriptionCode,
) {
  const doctor = await doctorProfile(userId, true);
  const hospital = await Hospital.findById(doctor.hospitalId);
  if (
    !hospital ||
    ['SUSPENDED', 'REJECTED'].includes(hospital.verificationStatus)
  )
    throw new AuthError(403, 'Doctor hospital relationship is not valid.');
  const patient = await Patient.findById(input.patientId);
  if (
    !patient ||
    !(await User.exists({ _id: patient.userId, active: true, role: 'PATIENT' }))
  )
    throw new AuthError(400, 'Patient is not available.');
  const issuedAt = new Date();
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (expiresAt && expiresAt <= issuedAt)
    throw new AuthError(400, 'Expiry must be in the future.');
  const medications = await Promise.all(
    input.medications.map(async (entry) => {
      const medicine = await Medicine.findById(entry.medicineId);
      if (!medicine || medicine.status !== 'ACTIVE')
        throw new AuthError(400, 'Medicine must be active and exist.');
      if (
        (entry.strength !== undefined &&
          entry.strength !== medicine.strength) ||
        (entry.dosageForm !== undefined &&
          normalizeText(entry.dosageForm).toLowerCase() !== medicine.dosageForm)
      )
        throw new AuthError(
          400,
          'Strength and dosage form must match the medicine.',
        );
      const product = entry.medicineProductId
        ? await MedicineProduct.findById(entry.medicineProductId)
        : null;
      if (
        entry.medicineProductId &&
        (!product ||
          product.status !== 'ACTIVE' ||
          !product.medicineId.equals(medicine._id))
      )
        throw new AuthError(
          400,
          'Product must be active and belong to the medicine.',
        );
      return {
        ...entry,
        genericName: medicine.genericName,
        activeIngredient: medicine.activeIngredient,
        strength: medicine.strength,
        strengthUnit: medicine.strengthUnit,
        dosageForm: medicine.dosageForm,
        brandName: product?.brandName ?? null,
        quantityDispensed: 0,
      };
    }),
  );
  for (let attempt = 0; attempt < 10; attempt++) {
    const publicCode = codeFactory(issuedAt);
    if (await Prescription.exists({ publicCode })) continue;
    try {
      return await Prescription.create({
        publicCode,
        patientId: patient._id,
        doctorId: doctor._id,
        hospitalId: hospital._id,
        medications,
        issuedAt,
        expiresAt,
      });
    } catch (error) {
      // The unique index handles a collision between existence check and insert.
      if (
        error instanceof mongoose.mongo.MongoServerError &&
        error.code === 11000 &&
        error.keyPattern?.publicCode
      )
        continue;
      throw error;
    }
  }
  throw new AuthError(
    409,
    'Could not allocate a prescription code. Please retry.',
  );
}
export type Ownership =
  | { doctorId: mongoose.Types.ObjectId }
  | { patientId: mongoose.Types.ObjectId };
export async function readOrTransition(
  id: string,
  owner: Ownership,
  action: 'read' | 'view' | 'cancel',
  reason?: string,
) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const prescription = await Prescription.findOne({ _id: id, ...owner });
    if (!prescription) throw new AuthError(404, 'Prescription not found.');
    const now = new Date();
    if (
      ['ISSUED', 'VIEWED'].includes(prescription.status) &&
      !isPrescriptionActive(prescription, now)
    )
      prescription.status = 'EXPIRED';
    let conflict = false;
    if (action === 'cancel') {
      if (
        !isPrescriptionActive(prescription, now) ||
        prescription.medications.some((entry) => entry.quantityDispensed > 0)
      )
        conflict = true;
      else {
        prescription.status = 'CANCELLED';
        prescription.cancelledAt = now;
        prescription.cancellationReason = reason!;
      }
    } else if (
      action === 'view' &&
      isPrescriptionActive(prescription, now) &&
      !prescription.viewedAt
    ) {
      prescription.status = 'VIEWED';
      prescription.viewedAt = now;
    }
    try {
      if (prescription.isModified()) await prescription.save();
      if (conflict)
        throw new AuthError(
          409,
          'Only active, undispensed prescriptions can be cancelled.',
        );
      return {
        ...prescription.toObject(),
        isActive: isPrescriptionActive(prescription),
      };
    } catch (error) {
      if (error instanceof mongoose.Error.VersionError) continue;
      throw error;
    }
  }
  throw new AuthError(409, 'Prescription changed. Please retry.');
}
export async function listPrescriptions(
  owner: Ownership,
  page: number,
  limit: number,
) {
  const [records, total] = await Promise.all([
    Prescription.find(owner)
      .select('_id')
      .sort({ issuedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Prescription.countDocuments(owner),
  ]);
  const items = await Promise.all(
    records.map((record) =>
      readOrTransition(record._id.toString(), owner, 'read'),
    ),
  );
  return { items, page, limit, total };
}
