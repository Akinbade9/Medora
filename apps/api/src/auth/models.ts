import mongoose, { Schema } from 'mongoose';
import type { PublicUser, Role } from '@medora/shared-types';
import { roles } from './validation.js';

interface UserRecord {
  displayName: string;
  email: string;
  passwordHash: string;
  role: Role;
  active: boolean;
  createdAt: Date;
}
const userSchema = new Schema<UserRecord>(
  {
    displayName: { type: String, required: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: roles, required: true, default: 'PATIENT' },
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  {
    toJSON: {
      transform: (_doc, ret) => {
        delete (ret as Partial<UserRecord>).passwordHash;
        return ret;
      },
    },
  },
);
export const User = mongoose.model<UserRecord>('User', userSchema);

interface SessionRecord {
  _id: string;
  userId: mongoose.Types.ObjectId;
  refreshHash: string;
  usedHashes: string[];
  expiresAt: Date;
  revoked: boolean;
}
const sessionSchema = new Schema<SessionRecord>({
  _id: { type: String, required: true },
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'User',
  },
  refreshHash: { type: String, required: true, select: false },
  usedHashes: { type: [String], default: [], select: false },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  revoked: { type: Boolean, default: false },
});
export const AuthSession = mongoose.model<SessionRecord>(
  'AuthSession',
  sessionSchema,
);
export function publicUser(
  user: UserRecord & { _id: mongoose.Types.ObjectId },
): PublicUser {
  return {
    id: user._id.toString(),
    displayName: user.displayName,
    email: user.email,
    role: user.role,
  };
}
