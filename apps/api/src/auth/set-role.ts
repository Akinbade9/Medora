import 'dotenv/config';
import mongoose from 'mongoose';
import { z } from 'zod';
import { loadAuthConfig } from './config.js';
import { emailSchema, roles } from './validation.js';
import { AuthSession, User } from './models.js';

async function main() {
  const [email, role] = process.argv.slice(2);
  const validatedEmail = emailSchema.parse(email);
  const validatedRole = z.enum(roles).parse(role);
  await mongoose.connect(loadAuthConfig().mongoUri);
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
      'Role assignment failed. Check the database, account email, and role argument.',
    );
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
