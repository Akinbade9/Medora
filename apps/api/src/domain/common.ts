import { Schema, Types } from 'mongoose';
import type { Role } from '@medora/shared-types';
import { User } from '../auth/models.js';
import { emailSchema } from '../auth/validation.js';

export const verificationStatuses = [
  'PENDING',
  'VERIFIED',
  'SUSPENDED',
  'REJECTED',
] as const;
export const domainOptions = {
  timestamps: true,
  strict: 'throw',
  optimisticConcurrency: true,
} as const;
export const text = (maxlength: number) => ({
  type: String,
  required: true,
  trim: true,
  minlength: 1,
  maxlength,
});
export const email = {
  ...text(254),
  lowercase: true,
  validate: (value: string) => emailSchema.safeParse(value).success,
};
export const phone = { ...text(16), match: /^\+[1-9]\d{6,14}$/ };
export const verificationStatus = {
  type: String,
  enum: verificationStatuses,
  default: 'PENDING',
  required: true,
  index: true,
};
export const pastDate = {
  validator: (value: Date | null) =>
    value === null || value.getTime() <= Date.now(),
  message: 'Date cannot be in the future',
};
export const identifier = {
  ...text(80),
  uppercase: true,
  match: /^[A-Z0-9][A-Z0-9/-]*$/,
  unique: true,
};

export function userReference(role: Role) {
  return {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    validate: {
      validator: async (value: Types.ObjectId) =>
        Boolean(await User.exists({ _id: value, role })),
      message: `User must exist with role ${role}`,
    },
  };
}

export const addressSchema = new Schema(
  {
    line1: text(200),
    line2: { type: String, trim: true, maxlength: 200 },
    city: text(100),
    state: text(100),
    postalCode: { type: String, trim: true, maxlength: 20 },
    countryCode: { ...text(2), uppercase: true, match: /^[A-Z]{2}$/ },
  },
  { _id: false, strict: 'throw' },
);

// Full-document validation is required for cross-field rules and role references.
// Query/bulk updates bypass parts of that validation in Mongoose.
export function validatedWritesOnly(schema: Schema) {
  schema.pre(
    [
      'updateOne',
      'updateMany',
      'findOneAndUpdate',
      'replaceOne',
      'findOneAndReplace',
    ],
    function () {
      throw new Error('Use document.save() for validated domain updates');
    },
  );
  schema.pre('bulkWrite', function () {
    throw new Error('Use document.save() for validated domain writes');
  });
}
