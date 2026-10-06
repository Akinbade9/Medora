import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/auth/service.js';
import { User, AuthSession } from '../src/auth/models.js';
import {
  Medicine,
  MedicineProduct,
  initializeCatalogueModels,
} from '../src/catalogue/models.js';
import { seedCatalogue } from '../src/catalogue/seed-data.js';
import { testConfig } from './config.js';

let db: MongoMemoryServer;
let token: string;
let userId: string;
const app = createApp(testConfig);
const input = {
  genericName: 'Paracetamol',
  activeIngredient: 'Paracetamol',
  strength: 500,
  strengthUnit: 'mg',
  dosageForm: 'Tablet',
  category: 'Example analgesic',
};
const product = (medicineId: string) => ({
  medicineId,
  brandName: 'Example Brand',
  manufacturer: 'Fictional Manufacturer',
  packSize: '10 tablets',
  productCode: 'EXAMPLE-1',
});
const admin = (method: 'post' | 'patch', path: string, body: object) =>
  request(app)
    [method](`/api/admin/${path}`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
const get = (path: string) =>
  request(app)
    .get(`/api/medicines${path}`)
    .set('Authorization', `Bearer ${token}`);
before(
  async () => {
    db = await MongoMemoryServer.create();
    await mongoose.connect(db.getUri());
    await Promise.all([
      User.init(),
      AuthSession.init(),
      initializeCatalogueModels(),
    ]);
    const auth = await new AuthService(testConfig).register({
      displayName: 'Catalogue tester',
      email: 'catalogue@example.test',
      password: 'unique test catalogue password',
    });
    token = auth.accessToken;
    userId = auth.user.id;
  },
  { timeout: 300000 },
);
beforeEach(async () => {
  await Promise.all([
    Medicine.deleteMany({}),
    MedicineProduct.deleteMany({}),
    User.updateOne({ _id: userId }, { role: 'PLATFORM_ADMIN' }),
  ]);
});
after(async () => {
  await mongoose.disconnect();
  await db?.stop();
});

test('medicine validation rejects missing/invalid fields, injected fields and empty patches', async () => {
  for (const body of [
    {},
    { ...input, strength: 0 },
    { ...input, strength: '500' },
    { ...input, genericName: ' ' },
    { ...input, status: 'UNKNOWN' },
    { ...input, unexpected: true },
  ])
    await admin('post', 'medicines', body).expect(400);
  const created = await admin('post', 'medicines', input).expect(201);
  assert.equal(created.body.genericName, 'paracetamol');
  assert.equal(created.body.status, 'ACTIVE');
  assert.ok(created.body.createdAt && created.body.updatedAt);
  await admin('patch', `medicines/${created.body._id}`, {}).expect(400);
  await assert.rejects(new Medicine({ ...input, strength: -1 }).validate());
});

test('normalized duplicate medicine definitions fail concurrently and on update', async () => {
  const outcomes = await Promise.all([
    admin('post', 'medicines', input),
    admin('post', 'medicines', {
      ...input,
      genericName: ' PARACETAMOL ',
      strengthUnit: ' MG ',
      dosageForm: 'tablet',
    }),
  ]);
  assert.deepEqual(outcomes.map((value) => value.status).sort(), [201, 409]);
  const other = await admin('post', 'medicines', {
    ...input,
    strength: 250,
  }).expect(201);
  await admin('patch', `medicines/${other.body._id}`, { strength: 500 }).expect(
    409,
  );
  assert.equal((await Medicine.findById(other.body._id))?.strength, 250);
});

test('product requires a real medicine, valid fields and unique normalized product code', async () => {
  const missing = new mongoose.Types.ObjectId().toString();
  await admin('post', 'medicine-products', product(missing)).expect(400);
  const medicine = await Medicine.create(input);
  const body = product(medicine.id);
  await admin('post', 'medicine-products', { ...body, packSize: '' }).expect(
    400,
  );
  const created = await admin('post', 'medicine-products', body).expect(201);
  await admin('post', 'medicine-products', {
    ...body,
    productCode: ' example-1 ',
  }).expect(409);
  await admin('patch', `medicine-products/${created.body._id}`, {
    medicineId: missing,
  }).expect(400);
  assert.equal(
    (await MedicineProduct.findById(created.body._id))?.medicineId.toString(),
    medicine.id,
  );
  await assert.rejects(new MedicineProduct(product(missing)).validate());
});

test('all catalogue routes require authentication and all non-admin roles cannot write', async () => {
  const medicine = await Medicine.create(input);
  const saved = await MedicineProduct.create(product(medicine.id));
  for (const path of [
    '',
    '/search?q=para',
    `/${medicine.id}`,
    `/${medicine.id}/products`,
  ])
    await request(app).get(`/api/medicines${path}`).expect(401);
  for (const role of [
    'PATIENT',
    'DOCTOR',
    'PHARMACY_ADMIN',
    'PHARMACY_STAFF',
  ]) {
    await User.updateOne({ _id: userId }, { role });
    await get('').expect(200);
    await admin('post', 'medicines', input).expect(403);
    await admin('patch', `medicines/${medicine.id}`, {
      status: 'INACTIVE',
    }).expect(403);
    await admin('post', 'medicine-products', product(medicine.id)).expect(403);
    await admin('patch', `medicine-products/${saved.id}`, {
      status: 'INACTIVE',
    }).expect(403);
  }
  await request(app).post('/api/admin/medicines').send(input).expect(401);
  await request(app)
    .patch(`/api/admin/medicines/${medicine.id}`)
    .send({ status: 'INACTIVE' })
    .expect(401);
  assert.equal((await Medicine.findById(medicine.id))?.status, 'ACTIVE');
});

test('admin creates and updates medicines and products, including deactivation', async () => {
  const medicine = await admin('post', 'medicines', input).expect(201);
  const updated = await admin('patch', `medicines/${medicine.body._id}`, {
    category: 'Updated category',
    status: 'INACTIVE',
  }).expect(200);
  assert.equal(updated.body.status, 'INACTIVE');
  const created = await admin(
    'post',
    'medicine-products',
    product(medicine.body._id),
  ).expect(201);
  const changed = await admin(
    'patch',
    `medicine-products/${created.body._id}`,
    { brandName: 'Updated Brand', status: 'INACTIVE' },
  ).expect(200);
  assert.equal(changed.body.brandName, 'Updated Brand');
  assert.equal(changed.body.status, 'INACTIVE');
  assert.equal(
    (await get(`/${medicine.body._id}`).expect(200)).body._id,
    medicine.body._id,
  );
  await request(app)
    .options(`/api/admin/medicines/${medicine.body._id}`)
    .set('Origin', testConfig.origins[0]!)
    .set('Access-Control-Request-Method', 'PATCH')
    .expect(204);
});

test('search matches generic name, active ingredient and brand literally without duplicate medicines', async () => {
  await seedCatalogue('development');
  for (const [q, expected] of [
    ['PARACE', 'paracetamol'],
    ['ascorbic', 'vitamin c'],
    ['Fictional amoxicillin', 'amoxicillin'],
  ]) {
    const response = await get(`/search?q=${encodeURIComponent(q!)}`).expect(
      200,
    );
    assert.equal(response.body.total, 1);
    assert.equal(response.body.items[0].genericName, expected);
  }
  assert.equal((await get('/search?q=.*').expect(200)).body.total, 0);
  await get('/search').expect(400);
  await get('/search?q=%20').expect(400);
  await get('/search?q[$ne]=x').expect(400);
});

test('catalogue and products use stable bounded pagination and validate IDs', async () => {
  await seedCatalogue('development');
  const first = await get('?limit=1').expect(200);
  const second = await get('?limit=1&page=2').expect(200);
  assert.equal(first.body.total, 3);
  assert.notEqual(first.body.items[0]._id, second.body.items[0]._id);
  const products = await get(
    `/${first.body.items[0]._id}/products?limit=1`,
  ).expect(200);
  assert.equal(products.body.total, 2);
  assert.equal(products.body.items.length, 1);
  assert.equal(products.body.items[0].medicineId, first.body.items[0]._id);
  const search = await get('/search?q=fictional&limit=1&page=2').expect(200);
  assert.equal(search.body.total, 3);
  assert.equal(search.body.items[0]._id, second.body.items[0]._id);
  for (const query of [
    '?limit=101',
    '?page=0',
    '?page=1.5',
    '?limit=1&limit=2',
  ])
    await get(query).expect(400);
  await get('/bad-id').expect(400);
  await get(`/${new mongoose.Types.ObjectId()}`).expect(404);
  await get(`/${new mongoose.Types.ObjectId()}/products`).expect(404);
  await admin('patch', `medicines/${new mongoose.Types.ObjectId()}`, {
    status: 'INACTIVE',
  }).expect(404);
});

test('development seed is repeatable, preserves edits and rejects production', async () => {
  await assert.rejects(seedCatalogue('production'));
  await seedCatalogue('development');
  const medicine = await Medicine.findOne().orFail();
  medicine.status = 'INACTIVE';
  await medicine.save();
  await seedCatalogue('development');
  assert.equal(await Medicine.countDocuments(), 3);
  assert.equal(await MedicineProduct.countDocuments(), 6);
  assert.equal((await Medicine.findById(medicine.id))?.status, 'INACTIVE');
});
