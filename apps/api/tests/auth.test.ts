import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import request from 'supertest';
import { SignJWT } from 'jose';
import { createApp } from '../src/app.js';
import { AuthSession, User } from '../src/auth/models.js';
import { AuthService, assertOwner } from '../src/auth/service.js';
import { roles } from '../src/auth/validation.js';
import { testConfig } from './config.js';

let database: MongoMemoryServer;
let app = createApp(testConfig);
const input = {
  email: 'person@example.test',
  displayName: 'Example Person',
  password: 'a long test-only password',
};
before(
  async () => {
    database = await MongoMemoryServer.create();
    await mongoose.connect(database.getUri());
    await Promise.all([User.init(), AuthSession.init()]);
  },
  { timeout: 300000 },
);
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), AuthSession.deleteMany({})]);
  app = createApp(testConfig);
});
after(async () => {
  await mongoose.disconnect();
  await database?.stop();
});
function post(path: string, body: object) {
  return request(app)
    .post(`/api/auth/${path}`)
    .set('X-Medora-Client', 'native')
    .send(body);
}
function me(token?: string) {
  const req = request(app).get('/api/auth/me');
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
}

test('registration normalizes email, hashes passwords, defaults to PATIENT, and omits secrets', async () => {
  const response = await post('register', {
    ...input,
    email: ' PERSON@EXAMPLE.TEST ',
  }).expect(201);
  assert.equal(response.body.user.role, 'PATIENT');
  assert.equal(response.body.user.email, input.email);
  assert.deepEqual(Object.keys(response.body.user).sort(), [
    'displayName',
    'email',
    'id',
    'role',
  ]);
  const user = await User.findOne({}).select('+passwordHash');
  assert.ok(user!.passwordHash.startsWith('scrypt-v1$'));
  assert.ok(!JSON.stringify(response.body).includes(user!.passwordHash));
  assert.ok(!JSON.stringify(user).includes('passwordHash'));
  const session = await AuthSession.findOne({}).select(
    '+refreshHash +usedHashes',
  );
  assert.notEqual(session!.refreshHash, response.body.refreshToken);
  assert.equal((await User.findOne({}))!.passwordHash, undefined);
});
test('validation rejects privilege injection, extra fields, invalid email and short passwords', async () => {
  for (const body of [
    { ...input, role: 'PLATFORM_ADMIN' },
    { ...input, active: true },
    { ...input, email: 'invalid' },
    { ...input, password: 'short' },
  ])
    await post('register', body).expect(400);
  assert.equal(await User.countDocuments(), 0);
});
test('email uniqueness survives concurrent registration', async () => {
  const responses = await Promise.all([
    post('register', input),
    post('register', input),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  assert.equal(await User.countDocuments(), 1);
});
test('valid login works and invalid credentials fail with the same generic response', async () => {
  await post('register', input).expect(201);
  const login = await post('login', {
    email: input.email,
    password: input.password,
  }).expect(200);
  const own = await me(login.body.accessToken).expect(200);
  assert.deepEqual(own.body.user, login.body.user);
  assert.ok(!JSON.stringify(own.body).includes('password'));
  const bad = await post('login', {
    email: input.email,
    password: 'wrong',
  }).expect(401);
  const missing = await post('login', {
    email: 'missing@example.test',
    password: 'wrong',
  }).expect(401);
  assert.deepEqual(bad.body, missing.body);
});
test('unauthenticated, malformed, tampered and expired access tokens are rejected', async () => {
  await me().expect(401);
  await me('nonsense').expect(401);
  const result = await post('register', input);
  await me(`${result.body.accessToken.slice(0, -8)}tampered`).expect(401);
  const session = await AuthSession.findOne({});
  const expired = await new SignJWT({ sid: session!.id, purpose: 'access' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer('medora-api')
    .setAudience('medora-clients')
    .setSubject(result.body.user.id)
    .setExpirationTime('0s')
    .sign(testConfig.jwtKey);
  await me(expired).expect(401);
});
test('all five roles are allowed only into their intended protected workspaces', async () => {
  const registered = await post('register', input);
  for (const role of roles) {
    await User.updateOne({}, { $set: { role } });
    for (const [workspace, allowed] of Object.entries({
      patient: ['PATIENT'],
      doctor: ['DOCTOR'],
      pharmacy: ['PHARMACY_ADMIN', 'PHARMACY_STAFF'],
      admin: ['PLATFORM_ADMIN'],
    })) {
      await request(app)
        .get(`/api/auth/access/${workspace}`)
        .set('Authorization', `Bearer ${registered.body.accessToken}`)
        .set('X-Role', 'PLATFORM_ADMIN')
        .expect(allowed.includes(role) ? 200 : 403);
    }
  }
});
test('signed role claims cannot override the stored role; disabled accounts lose access', async () => {
  const response = await post('register', input);
  const session = await AuthSession.findOne({});
  const forgedRole = await new SignJWT({
    sid: session!.id,
    purpose: 'access',
    role: 'PLATFORM_ADMIN',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer('medora-api')
    .setAudience('medora-clients')
    .setSubject(response.body.user.id)
    .setExpirationTime('1m')
    .sign(testConfig.jwtKey);
  await request(app)
    .get('/api/auth/access/admin')
    .set('Authorization', `Bearer ${forgedRole}`)
    .expect(403);
  await User.updateOne({}, { $set: { active: false } });
  await me(response.body.accessToken).expect(401);
  await post('refresh', { refreshToken: response.body.refreshToken }).expect(
    401,
  );
});
test('refresh rotates tokens; replay revokes the session family and its access tokens', async () => {
  const initial = await post('register', input);
  const next = await post('refresh', {
    refreshToken: initial.body.refreshToken,
  }).expect(200);
  assert.notEqual(next.body.refreshToken, initial.body.refreshToken);
  await me(next.body.accessToken).expect(200);
  await post('refresh', { refreshToken: initial.body.refreshToken }).expect(
    401,
  );
  await post('refresh', { refreshToken: next.body.refreshToken }).expect(401);
  await me(next.body.accessToken).expect(401);
});
test('concurrent refresh can consume the old token only once', async () => {
  const initial = await post('register', input);
  const responses = await Promise.all([
    post('refresh', { refreshToken: initial.body.refreshToken }),
    post('refresh', { refreshToken: initial.body.refreshToken }),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 401]);
  assert.equal((await AuthSession.findOne({}))!.revoked, true);
});
test('logout is idempotent and revokes access and refresh tokens', async () => {
  const initial = await post('register', input);
  await post('logout', { refreshToken: initial.body.refreshToken }).expect(204);
  await post('logout', { refreshToken: initial.body.refreshToken }).expect(204);
  await me(initial.body.accessToken).expect(401);
  await post('refresh', { refreshToken: initial.body.refreshToken }).expect(
    401,
  );
});
test('expired refresh sessions fail, even before MongoDB TTL cleanup', async () => {
  const initial = await post('register', input);
  await AuthSession.updateOne({}, { $set: { expiresAt: new Date(0) } });
  await post('refresh', { refreshToken: initial.body.refreshToken }).expect(
    401,
  );
  await me(initial.body.accessToken).expect(401);
});
test('web uses HttpOnly cookies and rejects CSRF, role injection, and native transport from browsers', async () => {
  const browser = request.agent(app);
  const result = await browser
    .post('/api/auth/register')
    .set('Origin', testConfig.origins[0]!)
    .set('X-Medora-Client', 'web')
    .send(input)
    .expect(201);
  assert.equal(result.body.refreshToken, undefined);
  const cookie = result.headers['set-cookie']?.[0];
  assert.ok(cookie);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Path=\/api\/auth/);
  const next = await browser
    .post('/api/auth/refresh')
    .set('Origin', testConfig.origins[0]!)
    .set('X-Medora-Client', 'web')
    .send({})
    .expect(200);
  assert.equal(next.body.refreshToken, undefined);
  await browser.post('/api/auth/refresh').send({}).expect(403);
  await browser
    .post('/api/auth/refresh')
    .set('Origin', 'https://evil.example')
    .set('X-Medora-Client', 'web')
    .send({})
    .expect(403);
  await browser
    .post('/api/auth/login')
    .set('Origin', testConfig.origins[0]!)
    .set('X-Medora-Client', 'native')
    .send(input)
    .expect(403);
  await browser
    .post('/api/auth/logout')
    .set('Origin', testConfig.origins[0]!)
    .set('X-Medora-Client', 'web')
    .send({})
    .expect(204);
  await me(next.body.accessToken).expect(401);
});
test('ownership requires a match and admin bypass must be explicitly allowed', async () => {
  const response = await post('register', input);
  const principal = await new AuthService(testConfig).authenticate(
    response.body.accessToken,
  );
  assert.doesNotThrow(() => assertOwner(principal, principal.user.id));
  assert.throws(() => assertOwner(principal, 'someone-else'));
  const admin = {
    ...principal,
    user: { ...principal.user, role: 'PLATFORM_ADMIN' as const },
  };
  assert.throws(() => assertOwner(admin, 'someone-else'));
  assert.doesNotThrow(() =>
    assertOwner(admin, 'someone-else', ['PLATFORM_ADMIN']),
  );
});
test('login attempts are rate limited', async () => {
  for (let i = 0; i < 20; i++) await post('login', {}).expect(400);
  await post('login', {}).expect(429);
});

test('a guessed refresh secret cannot revoke a valid session', async () => {
  const initial = await post('register', input);
  const guessed = `${initial.body.refreshToken.split('.')[0]}.${'a'.repeat(43)}`;
  await post('refresh', { refreshToken: guessed }).expect(401);
  await me(initial.body.accessToken).expect(200);
});

test('logout revokes only its own device session', async () => {
  const first = await post('register', input);
  const second = await post('login', {
    email: input.email,
    password: input.password,
  });
  await post('logout', { refreshToken: first.body.refreshToken }).expect(204);
  await me(first.body.accessToken).expect(401);
  await me(second.body.accessToken).expect(200);
});

test('production browser cookies carry Secure, and JWT issuer/audience are enforced', async () => {
  const production = createApp({ ...testConfig, secureCookies: true });
  const response = await request(production)
    .post('/api/auth/register')
    .set('Origin', testConfig.origins[0]!)
    .set('X-Medora-Client', 'web')
    .send(input)
    .expect(201);
  assert.match(String(response.headers['set-cookie']), /; Secure/);
  const session = await AuthSession.findOne({});
  for (const [issuer, audience] of [
    ['wrong-issuer', 'medora-clients'],
    ['medora-api', 'wrong-audience'],
  ]) {
    const token = await new SignJWT({ sid: session!.id, purpose: 'access' })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .setSubject(response.body.user.id)
      .setIssuer(issuer!)
      .setAudience(audience!)
      .setExpirationTime('1m')
      .sign(testConfig.jwtKey);
    await me(token).expect(401);
  }
});
