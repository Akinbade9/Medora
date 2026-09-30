import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import { app } from '../src/app.js';
import { errorHandler } from '../src/middleware/error-handler.js';

test('health endpoint returns successful JSON', async () => {
  const response = await request(app)
    .get('/api/health')
    .expect(200)
    .expect('Content-Type', /json/);
  assert.deepEqual(response.body, { status: 'ok', service: 'medora-api' });
  assert.equal(response.headers['x-powered-by'], undefined);
});

test('unknown routes return JSON 404', async () => {
  const response = await request(app).get('/missing').expect(404);
  assert.deepEqual(response.body, { error: { message: 'Not found' } });
});

test('malformed JSON returns a safe 400 response', async () => {
  const response = await request(app)
    .post('/missing')
    .set('Content-Type', 'application/json')
    .send('{invalid')
    .expect(400);
  assert.deepEqual(response.body, { error: { message: 'Invalid request' } });
});

test('oversized JSON returns 413', async () => {
  const response = await request(app)
    .post('/missing')
    .send({ value: 'a'.repeat(110_000) })
    .expect(413);
  assert.deepEqual(response.body, {
    error: { message: 'Request body too large' },
  });
});

test('unexpected errors hide internal details', async () => {
  const failingApp = express();
  failingApp.get('/', () => {
    throw new Error('private internal detail');
  });
  failingApp.use(errorHandler);
  const response = await request(failingApp).get('/').expect(500);
  assert.deepEqual(response.body, {
    error: { message: 'Internal server error' },
  });
});
