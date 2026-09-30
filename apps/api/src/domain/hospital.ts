import { model, Schema } from 'mongoose';
import {
  addressSchema,
  domainOptions,
  email,
  pastDate,
  phone,
  text,
  validatedWritesOnly,
  verificationStatus,
} from './common.js';

const documentSchema = new Schema(
  {
    kind: {
      type: String,
      enum: ['REGISTRATION', 'LICENCE', 'OTHER'],
      required: true,
    },
    fileName: text(255),
    storageKey: text(500),
    mimeType: {
      type: String,
      enum: ['application/pdf', 'image/jpeg', 'image/png'],
      required: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 1,
      max: 20 * 1024 * 1024,
      validate: Number.isInteger,
    },
    uploadedAt: { type: Date, required: true, validate: pastDate },
  },
  { strict: 'throw' },
);
const hospitalSchema = new Schema(
  {
    name: text(200),
    address: { type: addressSchema, required: true },
    phone,
    email,
    verificationStatus,
    verificationDocuments: {
      type: [documentSchema],
      default: [],
      select: false,
      validate: (value: unknown[]) => value.length <= 20,
    },
  },
  domainOptions,
);
hospitalSchema.plugin(validatedWritesOnly);
export const Hospital = model('Hospital', hospitalSchema);
