import 'dotenv/config';
import mongoose from 'mongoose';
import { seedCatalogue } from './seed-data.js';

async function main() {
  if (process.env.NODE_ENV !== 'development')
    throw new Error('Development only');
  const uri = process.env.MONGODB_URI;
  if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri))
    throw new Error('Missing database URI');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  await seedCatalogue(process.env.NODE_ENV);
  console.log(
    'Development catalogue seed complete: example data only, not a complete or authoritative drug database.',
  );
}
main()
  .catch(() => {
    console.error(
      'Catalogue seed failed. Check the development environment, database availability, and conflicting fixture data.',
    );
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
