import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { loadAuthConfig } from './auth/config.js';
import { AuthSession, User } from './auth/models.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

async function start() {
  const config = loadAuthConfig();
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
  await Promise.all([User.init(), AuthSession.init()]);
  const server = createApp(config).listen(port, host, () => {
    console.log(`Medora API listening at http://${host}:${port}`);
  });
  server.on('error', (error) => {
    console.error('API failed to start:', error.message);
    process.exitCode = 1;
    void mongoose.disconnect();
  });

  function shutdown() {
    server.close(() => {
      void mongoose.disconnect().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
start().catch(() => {
  console.error(
    'API startup failed. Check MONGODB_URI, JWT_ACCESS_SECRET, WEB_ORIGINS, and database availability.',
  );
  process.exitCode = 1;
  void mongoose.disconnect();
});
