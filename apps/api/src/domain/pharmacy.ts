import { model, Schema } from 'mongoose';
import {
  addressSchema,
  domainOptions,
  email,
  identifier,
  pastDate,
  phone,
  text,
  userReference,
  validatedWritesOnly,
  verificationStatus,
} from './common.js';

const locationSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point', required: true },
    coordinates: {
      type: [Number],
      required: true,
      validate: (values: number[]) =>
        values.length === 2 &&
        values.every(Number.isFinite) &&
        Math.abs(values[0]!) <= 180 &&
        Math.abs(values[1]!) <= 90,
    },
  },
  { _id: false, strict: 'throw' },
);
const hoursSchema = new Schema(
  {
    day: {
      type: Number,
      min: 0,
      max: 6,
      required: true,
      validate: Number.isInteger,
    },
    closed: { type: Boolean, required: true },
    opensAt: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    closesAt: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    closesNextDay: { type: Boolean, default: false, required: true },
  },
  { _id: false, strict: 'throw' },
);
hoursSchema.pre('validate', function () {
  if (this.closed) {
    if (this.opensAt || this.closesAt || this.closesNextDay)
      this.invalidate('closed', 'Closed days cannot have opening times');
  } else if (
    !this.opensAt ||
    !this.closesAt ||
    (this.closesNextDay
      ? this.closesAt > this.opensAt
      : this.closesAt <= this.opensAt)
  ) {
    this.invalidate(
      'opensAt',
      'Provide a valid opening interval of at most 24 hours',
    );
  }
});
const pharmacySchema = new Schema(
  {
    adminUserId: { ...userReference('PHARMACY_ADMIN'), index: true },
    name: text(200),
    licenceNumber: identifier,
    address: { type: addressSchema, required: true },
    location: { type: locationSchema, required: true },
    phone,
    email,
    verificationStatus,
    pickupAvailable: { type: Boolean, default: false, required: true },
    deliveryAvailable: { type: Boolean, default: false, required: true },
    timeZone: {
      ...text(100),
      validate: (value: string) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: value });
          return true;
        } catch {
          return false;
        }
      },
    },
    operatingHours: {
      type: [hoursSchema],
      default: [],
      validate: (value: { day: number }[]) =>
        value.length <= 7 &&
        new Set(value.map((entry) => entry.day)).size === value.length,
    },
    inventoryLastUpdatedAt: { type: Date, default: null, validate: pastDate },
  },
  domainOptions,
);
pharmacySchema.index({ location: '2dsphere' });
pharmacySchema.plugin(validatedWritesOnly);
export const Pharmacy = model('Pharmacy', pharmacySchema);
