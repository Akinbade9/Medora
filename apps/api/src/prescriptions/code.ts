import { randomInt } from 'node:crypto';

// No patient data. Eight unbiased random base-32 symbols provide 40 random bits.
const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export function generatePrescriptionCode(issuedAt = new Date()) {
  const year = String(issuedAt.getUTCFullYear()).slice(-2);
  const random = Array.from(
    { length: 8 },
    () => alphabet[randomInt(alphabet.length)],
  ).join('');
  return `RX-${year}-${random}`;
}
