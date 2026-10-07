import type { DraftLine, Patient } from './types';
export const ruleLabels = {
  GENERIC_ALLOWED: 'Generic allowed',
  BRAND_SPECIFIC: 'Specific brand required',
  DO_NOT_SUBSTITUTE: 'Do not substitute',
};
export function buildIssueBody(
  patient: Patient | null,
  lines: DraftLine[],
  expiry: string,
) {
  if (!patient) throw new Error('Select a patient before reviewing.');
  if (!lines.length || lines.length > 50)
    throw new Error('Add between 1 and 50 medicines.');
  const medications = lines.map((line, index) => {
    const prefix = `Medicine ${index + 1}: `;
    if (line.medicine.status !== 'ACTIVE')
      throw new Error(prefix + 'select an active medicine.');
    if (
      !/^\d+$/.test(line.quantity) ||
      Number(line.quantity) < 1 ||
      Number(line.quantity) > 100000
    )
      throw new Error(
        prefix + 'quantity must be a whole number from 1 to 100,000.',
      );
    for (const [label, value, max] of [
      ['dosage instructions', line.dosageInstructions, 2000],
      ['frequency', line.frequency, 200],
      ['duration', line.duration, 200],
    ] as const) {
      if (!value.trim() || value.trim().length > max || /\p{Cc}/u.test(value))
        throw new Error(
          prefix + `enter valid ${label} (maximum ${max} characters).`,
        );
    }
    if (line.substitutionRule === 'BRAND_SPECIFIC' && !line.product)
      throw new Error(prefix + 'select the required brand.');
    const product =
      line.substitutionRule !== 'GENERIC_ALLOWED' ? line.product : undefined;
    if (
      product &&
      (product.status !== 'ACTIVE' || product.medicineId !== line.medicine._id)
    )
      throw new Error(prefix + 'brand must be active and match the medicine.');
    return {
      medicineId: line.medicine._id,
      ...(product ? { medicineProductId: product._id } : {}),
      quantity: Number(line.quantity),
      dosageInstructions: line.dosageInstructions.trim(),
      frequency: line.frequency.trim(),
      duration: line.duration.trim(),
      substitutionRule: line.substitutionRule,
    };
  });
  let expiresAt: string | undefined;
  if (expiry) {
    const date = new Date(expiry);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now())
      throw new Error('Expiry must be a valid future date and time.');
    expiresAt = date.toISOString();
  }
  return {
    patientId: patient._id,
    medications,
    ...(expiresAt ? { expiresAt } : {}),
  };
}
