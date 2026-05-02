// Shared test helpers. Boots an in-memory MongoDB, exposes the supertest
// agent, and provides convenience functions for signing up / logging in.

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');

let mongo;
let app;

async function startTestEnv() {
  mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri();
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test_access_secret_at_least_32_chars_xxxxxxxxxx';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_at_least_32_chars_xxxxxxxx';
  process.env.INITIAL_BALANCE = '20000';
  process.env.CORS_ORIGINS = 'http://localhost:5173';

  // eslint-disable-next-line global-require
  app = require('../src/app');
  await mongoose.connect(process.env.MONGO_URI);
  return app;
}

async function stopTestEnv() {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
}

async function clearDb() {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    // eslint-disable-next-line no-await-in-loop
    await collections[key].deleteMany({});
  }
}

const sampleSignup = (overrides = {}) => ({
  fullName: 'Test User',
  username: 'testuser',
  password: 'StrongPassword123!',
  phone: '0301-1234567',
  cnic: '35202-1234567-1',
  pin: '1234',
  ...overrides,
});

async function signupAndLogin(payload = sampleSignup()) {
  const res = await request(app).post('/api/auth/signup').send(payload);
  if (res.status !== 201) {
    throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    accessToken: res.body.access_token,
    refreshToken: res.body.refresh_token,
    user: res.body.user,
  };
}

module.exports = {
  startTestEnv,
  stopTestEnv,
  clearDb,
  request: () => request(app),
  app: () => app,
  sampleSignup,
  signupAndLogin,
};
