import { randomBytes } from 'node:crypto';
import { model, Schema } from 'mongoose';
import {
  addressSchema,
  domainOptions,
  pastDate,
  text,
  userReference,
  validatedWritesOnly,
} from './common.js';

const savedAddressSchema = new Schema(
  {
    label: text(50),
    address: { type: addressSchema, required: true },
  },
  { strict: 'throw' },
);
const preferencesSchema = new Schema(
  {
    push: { type: Boolean, default: true, required: true },
    email: { type: Boolean, default: true, required: true },
    sms: { type: Boolean, default: false, required: true },
  },
  { _id: false, strict: 'throw' },
);
const patientSchema = new Schema(
  {
    userId: { ...userReference('PATIENT'), unique: true },
    patientCode: {
      ...text(40),
      uppercase: true,
      unique: true,
      match: /^PT-[A-Z0-9-]+$/,
      default: () => `PT-${randomBytes(10).toString('hex').toUpperCase()}`,
    },
    dateOfBirth: { type: Date, required: true, validate: pastDate },
    gender: {
      type: String,
      enum: ['FEMALE', 'MALE', 'OTHER', 'PREFER_NOT_TO_SAY'],
      required: true,
    },
    savedAddresses: {
      type: [savedAddressSchema],
      default: [],
      validate: (value: unknown[]) => value.length <= 10,
    },
    notificationPreferences: {
      type: preferencesSchema,
      default: () => ({}),
      required: true,
    },
  },
  domainOptions,
);
patientSchema.plugin(validatedWritesOnly);
export const Patient = model('Patient', patientSchema);
