import { model, Schema } from 'mongoose';
import { domainOptions, text, validatedWritesOnly } from '../domain/common.js';
import { Doctor, Hospital, Patient } from '../domain/index.js';
import { User } from '../auth/models.js';
import { Medicine, MedicineProduct } from '../catalogue/models.js';
import { prescriptionStatuses, substitutionRules } from './validation.js';
import { generatePrescriptionCode } from './code.js';

const medicationSchema = new Schema(
  {
    medicineId: {
      type: Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
    },
    medicineProductId: {
      type: Schema.Types.ObjectId,
      ref: 'MedicineProduct',
      default: null,
    },
    genericName: text(160),
    activeIngredient: text(200),
    brandName: { type: String, default: null, maxlength: 160 },
    strength: {
      type: Number,
      required: true,
      min: Number.MIN_VALUE,
      validate: Number.isFinite,
    },
    strengthUnit: text(30),
    dosageForm: text(80),
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 100000,
      validate: Number.isInteger,
    },
    dosageInstructions: text(2000),
    frequency: text(200),
    duration: text(200),
    substitutionRule: { type: String, enum: substitutionRules, required: true },
    quantityDispensed: {
      type: Number,
      default: 0,
      required: true,
      min: 0,
      validate: Number.isInteger,
    },
  },
  { _id: true, strict: 'throw' },
);
medicationSchema.pre('validate', function () {
  if (this.quantityDispensed > this.quantity)
    this.invalidate(
      'quantityDispensed',
      'Dispensed quantity exceeds prescribed quantity',
    );
  if (this.substitutionRule === 'BRAND_SPECIFIC' && !this.medicineProductId)
    this.invalidate('medicineProductId', 'Product required');
  if (this.substitutionRule === 'GENERIC_ALLOWED' && this.medicineProductId)
    this.invalidate(
      'medicineProductId',
      'Generic medication cannot lock a product',
    );
});
const schema = new Schema(
  {
    publicCode: {
      ...text(20),
      match: /^RX-\d{2}-[2-9A-HJ-NP-Z]{8}$/,
      unique: true,
      default: () => generatePrescriptionCode(),
    },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: 'Hospital',
      required: true,
    },
    status: {
      type: String,
      enum: prescriptionStatuses,
      default: 'ISSUED',
      required: true,
    },
    issuedAt: { type: Date, default: Date.now, required: true },
    expiresAt: { type: Date, default: null },
    viewedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },
    medications: {
      type: [medicationSchema],
      required: true,
      validate: (value: unknown[]) => value.length >= 1 && value.length <= 50,
    },
  },
  domainOptions,
);
schema.index({ patientId: 1, issuedAt: -1, _id: -1 });
schema.index({ doctorId: 1, issuedAt: -1, _id: -1 });
schema.index({ status: 1, expiresAt: 1 });
schema.plugin(validatedWritesOnly);
schema.post('init', function (document) {
  document.$locals.statusAtRead = document.status;
});
schema.post('save', function (document) {
  document.$locals.statusAtRead = document.status;
});
schema.pre('validate', async function () {
  if (!this.isNew) {
    const previous: unknown = this.$locals.statusAtRead;
    if (
      this.isModified('status') &&
      (previous === 'CANCELLED' || previous === 'EXPIRED')
    ) {
      this.invalidate(
        'status',
        'Terminal prescription status cannot be changed',
      );
    }
    if (previous === 'VIEWED' && this.status === 'ISSUED') {
      this.invalidate('status', 'Viewed prescriptions cannot return to issued');
    }
    for (const path of [
      'publicCode',
      'patientId',
      'doctorId',
      'hospitalId',
      'issuedAt',
      'expiresAt',
      'medications',
    ]) {
      if (this.isModified(path))
        this.invalidate(path, 'Issued prescription details cannot be changed');
    }
    return;
  }
  if (
    this.status !== 'ISSUED' ||
    this.viewedAt ||
    this.cancelledAt ||
    this.cancellationReason
  )
    this.invalidate('status', 'New prescriptions must be issued');
  if (this.expiresAt && this.expiresAt <= this.issuedAt)
    this.invalidate('expiresAt', 'Expiry must follow issuance');
  const [doctor, patient, hospital] = await Promise.all([
    Doctor.findById(this.doctorId),
    Patient.findById(this.patientId),
    Hospital.findById(this.hospitalId),
  ]);
  if (
    !doctor ||
    doctor.verificationStatus !== 'VERIFIED' ||
    !doctor.hospitalId.equals(this.hospitalId) ||
    !(await User.exists({ _id: doctor.userId, role: 'DOCTOR', active: true }))
  )
    this.invalidate('doctorId', 'Verified authorized doctor required');
  if (
    !hospital ||
    ['SUSPENDED', 'REJECTED'].includes(hospital.verificationStatus)
  )
    this.invalidate('hospitalId', 'Valid hospital required');
  if (
    !patient ||
    !(await User.exists({ _id: patient.userId, role: 'PATIENT', active: true }))
  )
    this.invalidate('patientId', 'Valid patient required');
  for (const entry of this.medications) {
    const medicine = await Medicine.findById(entry.medicineId);
    if (
      !medicine ||
      medicine.status !== 'ACTIVE' ||
      medicine.strength !== entry.strength ||
      medicine.strengthUnit !== entry.strengthUnit ||
      medicine.dosageForm !== entry.dosageForm ||
      medicine.genericName !== entry.genericName ||
      medicine.activeIngredient !== entry.activeIngredient
    )
      this.invalidate(
        'medications',
        'Medication must match an active catalogue definition',
      );
    if (entry.quantityDispensed !== 0)
      this.invalidate('medications', 'New medications must be undispensed');
    if (entry.medicineProductId) {
      const product = await MedicineProduct.findById(entry.medicineProductId);
      if (
        !product ||
        product.status !== 'ACTIVE' ||
        !product.medicineId.equals(entry.medicineId) ||
        product.brandName !== entry.brandName
      )
        this.invalidate(
          'medications',
          'Product must match the active medicine',
        );
    } else if (entry.brandName)
      this.invalidate('medications', 'Brand requires a product');
  }
});
export const Prescription = model('Prescription', schema);

export function isPrescriptionActive(
  value: { status: string; expiresAt?: Date | null },
  now = new Date(),
) {
  return (
    ['ISSUED', 'VIEWED'].includes(value.status) &&
    (!value.expiresAt || value.expiresAt > now)
  );
}
