import 'dotenv/config';
import mongoose from 'mongoose';
import { z } from 'zod';
import { loadAuthConfig } from './config.js';
import { emailSchema, roles } from './validation.js';
import { AuthSession, User } from './models.js';
import { assertCompatibleProfileRole } from '../domain/relationships.js';

async function main() {
  const [email, role] = process.argv.slice(2);
  const validatedEmail = emailSchema.parse(email);
  const validatedRole = z.enum(roles).parse(role);
  await mongoose.connect(loadAuthConfig().mongoUri);
  const existing = await User.findOne({ email: validatedEmail });
  if (!existing) throw new Error('Account not found');
  await assertCompatibleProfileRole(existing._id, validatedRole);
  const user = await User.findOneAndUpdate(
    { email: validatedEmail },
    { $set: { role: validatedRole } },
    { returnDocument: 'after', runValidators: true },
  );
  if (!user) throw new Error('Account not found. Register the account first.');
  await AuthSession.updateMany(
    { userId: user._id },
    { $set: { revoked: true } },
  );
  console.log('Role assigned. Existing sessions revoked; sign in again.');
}
main()
  .catch(() => {
    console.error(
      'Role assignment failed. Check the database, account email, role argument, and existing profile compatibility.',
    );
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
