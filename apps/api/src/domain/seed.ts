import 'dotenv/config';
import mongoose from 'mongoose';
import { seedDevelopmentData } from './seed-data.js';
import { seedCatalogue } from '../catalogue/seed-data.js';

async function main() {
  if (process.env.NODE_ENV !== 'development')
    throw new Error('Development only');
  const uri = process.env.MONGODB_URI;
  if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri))
    throw new Error('Missing MongoDB URI');
  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < 12 || password.length > 128)
    throw new Error('Invalid seed password');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  await seedDevelopmentData(password, process.env.NODE_ENV);
  await seedCatalogue(process.env.NODE_ENV);
  console.log(
    'Catalogue examples are for development only, not an authoritative drug database.',
  );
  console.log(
    'Fictional development seed complete. Existing records and passwords preserved.',
  );
}
main()
  .catch(() => {
    console.error(
      'Seed failed. Check NODE_ENV=development, MONGODB_URI, SEED_PASSWORD (12-128 characters), and conflicting seed records.',
    );
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
