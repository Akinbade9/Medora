export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
export interface Patient {
  _id: string;
  displayName: string;
  patientCode: string;
  dateOfBirth: string;
}
export interface Medicine {
  _id: string;
  genericName: string;
  activeIngredient: string;
  strength: number;
  strengthUnit: string;
  dosageForm: string;
  status: 'ACTIVE' | 'INACTIVE';
}
export interface Product {
  _id: string;
  medicineId: string;
  brandName: string;
  manufacturer: string;
  packSize: string;
  status: 'ACTIVE' | 'INACTIVE';
}
export type Rule = 'GENERIC_ALLOWED' | 'BRAND_SPECIFIC' | 'DO_NOT_SUBSTITUTE';
export interface DraftLine {
  key: string;
  medicine: Medicine;
  product?: Product;
  quantity: string;
  dosageInstructions: string;
  frequency: string;
  duration: string;
  substitutionRule: Rule;
}
export interface Medication {
  _id: string;
  medicineId: string;
  medicineProductId?: string | null;
  genericName: string;
  strength: number;
  strengthUnit: string;
  dosageForm: string;
  brandName?: string | null;
  quantity: number;
  dosageInstructions: string;
  frequency: string;
  duration: string;
  substitutionRule: Rule;
  quantityDispensed: number;
}
export type Status = 'ISSUED' | 'VIEWED' | 'CANCELLED' | 'EXPIRED';
export interface Prescription {
  _id: string;
  publicCode: string;
  patientId: string;
  status: Status;
  issuedAt: string;
  expiresAt: string | null;
  viewedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  isActive: boolean;
  medications: Medication[];
}
export interface Profile {
  professionalRegistrationNumber: string;
  specialty: string;
  verificationStatus: string;
  hospital: { name: string; verificationStatus: string } | null;
  canIssue: boolean;
}
