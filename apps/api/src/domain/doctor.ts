import { model, Schema, Types } from 'mongoose';
import {
  domainOptions,
  identifier,
  text,
  userReference,
  validatedWritesOnly,
  verificationStatus,
} from './common.js';
import { Hospital } from './hospital.js';

const doctorSchema = new Schema(
  {
    userId: { ...userReference('DOCTOR'), unique: true },
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: 'Hospital',
      required: true,
      index: true,
      validate: {
        validator: async (id: Types.ObjectId) =>
          Boolean(await Hospital.exists({ _id: id })),
        message: 'Hospital must exist',
      },
    },
    professionalRegistrationNumber: identifier,
    specialty: text(120),
    verificationStatus,
  },
  domainOptions,
);
doctorSchema.plugin(validatedWritesOnly);
export const Doctor = model('Doctor', doctorSchema);
