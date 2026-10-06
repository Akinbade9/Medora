import { model, Schema, Types } from 'mongoose';
import { domainOptions, text, validatedWritesOnly } from '../domain/common.js';
import { normalizeText, statuses } from './validation.js';

const label = (max: number) => ({
  ...text(max),
  set: normalizeText,
  match: /^[^\p{Cc}]+$/u,
});
const clinical = (max: number) => ({
  ...label(max),
  set: (value: string) => normalizeText(value).toLowerCase(),
});
const status = {
  type: String,
  enum: statuses,
  default: 'ACTIVE',
  required: true,
};
const medicineSchema = new Schema(
  {
    genericName: clinical(160),
    activeIngredient: clinical(200),
    strength: {
      type: Number,
      required: true,
      min: Number.MIN_VALUE,
      max: 1_000_000,
      validate: Number.isFinite,
    },
    strengthUnit: clinical(30),
    dosageForm: clinical(80),
    category: label(100),
    status,
  },
  domainOptions,
);
medicineSchema.index(
  { genericName: 1, strength: 1, strengthUnit: 1, dosageForm: 1 },
  { unique: true },
);
medicineSchema.index({ status: 1, genericName: 1, _id: 1 });
medicineSchema.plugin(validatedWritesOnly);
export const Medicine = model('Medicine', medicineSchema);

const productSchema = new Schema(
  {
    medicineId: {
      type: Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
      validate: {
        validator: async (id: Types.ObjectId) =>
          Boolean(await Medicine.exists({ _id: id })),
        message: 'Medicine must exist',
      },
    },
    brandName: label(160),
    manufacturer: label(160),
    packSize: label(80),
    productCode: {
      ...text(80),
      uppercase: true,
      match: /^[A-Z0-9][A-Z0-9_-]{1,79}$/,
      unique: true,
    },
    status,
  },
  domainOptions,
);
productSchema.index({ medicineId: 1, brandName: 1, _id: 1 });
productSchema.plugin(validatedWritesOnly);
export const MedicineProduct = model('MedicineProduct', productSchema);
export async function initializeCatalogueModels() {
  await Promise.all([Medicine.init(), MedicineProduct.init()]);
}
