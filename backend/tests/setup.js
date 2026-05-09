// Shared test helpers. Boots an in-memory MongoDB replica set, exposes the
// supertest agent, and provides convenience functions for signing up /
// logging in.
//
// We use MongoMemoryReplSet (not MongoMemoryServer) because the transaction
// controller wraps SparrowPay-to-SparrowPay transfers in a Mongoose session,
// and multi-document transactions require MongoDB to run as a replica set.

const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');

let mongo;
let app;

// Deterministic 2048-bit RSA keypair for the donation blind-signature tests.
// Using a fixed key avoids paying generateKeyPairSync (~hundreds of ms) on
// every test run and keeps the test output reproducible.
const TEST_BANK_RSA_PEM = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDC3M9Pz2AT0oIe
pbkwGjMc0+rkxrzdicumJlfim0Yjbi1tEdOCiAHi0BxMMNyb42PZVQWGgldiobmU
Ztc03zCiGOJGqDQ07TeUgPW+NAynevB5GP65DbXI7XwBbvWej56JIjyhAy43C9UI
eiDtU/guMTE3e7oxB/7jW8UjRC5ygV9P+6Sl4uEpy0swX5fRJginqysoZA1poWSa
q5Kh303YKZztJbh/SwxuDYPCoGM6bjZdR48WRTal3IM8K1ZJ2qBfSP9pXgEHZ3dU
Cbk5V4N196LD4BBQd/4YgaFeo084o29hEw+DaSV42K3wwNUyE3ICuf1ivGljsDI5
I2QZQx2LAgMBAAECggEACWbR8c3Vmt87O/NO/g0ljiyDVspn7mBpnPiYoOxQ9ACq
3GpRxCh/vsu/scVhv3u3I5NAkv7S7IVVCN31YC2skQWWVUZkTnFrjxSxxp2IRsRd
udoE4DTTIoCizQbnfuD7Cy7FshcPMcS2YJRT5l94x/HDqCOmFhuGpr2Uw2DUxN13
b1ed7dzPNnkV/O80dYL8ZMLhOJHXoNUwCSFzhzhyuaZVC7Bg87cCOiE+abefW/HQ
qnEF6owQS4/6xt4Slnjq1rnPjT5PoaS2jUTGpDdKWw+sWy0OyWJjM+nT/KWtK6WC
HYaZ5xByLV8quItMzvQFsnCRUvKlDdLZp76gOf8NgQKBgQD1qQyDN2613SYgd0qy
dg824wCAVvguEe8Icybk58gF2ssuPFh1wsjDmHppou+jn0seSZap/P9lgH6k/vYU
0bLjWIYpVNuSLUKFZBe2ToV+71ySdl3ZmmIFT2bY89AzvJe/o4I4tpV7hTboRMMU
fapnYoYfSrXtkchRR20Km0yVYQKBgQDLEGwxqnek9id6Oba0uJBE6nQZx56zPrHN
zGWysS/l20eLgtzA3d5C6bIltFUsxuxQkTTVQ9ws0xZuxIG6ODxbvVuBy35QahDZ
z/BmQfC8moUW33LVhZNqG3CcLIL4ZvDTmohNrbWbjijO7MI3so/ZsAyzjCBkJCua
yI+nALFuawKBgCjBsDLA6pw/oYi3YewzzBhmFvoz857pGMhFGonVrojSIO1904tO
ErLoxD5sauexkOvod5eiQtkbNWe4aSlRFSXE1RVcX8VjvuqUjZ6QbnN90NT30GA+
zc5luwF5iexbeK2xufQgzrIcityEM/1dT/0xCmF8qqxMiHh7qiqdU1phAoGALbMD
dmXzyScwmTw11xQWO7w75rVbDOHWKAeQ95cSvXsM7ePEhI8p/wsS8ZNU+9/EvRkA
t+IuwdO7n7APtfYD9211E4/VXImSQ0KdypWadQedXhlpgY4vL9j/Ddainv6jwitr
83ddgKWMn4z+5IQGBaquIRYvD/pn6cyrL51jUQMCgYEAiFoosqQo9BbU+5AUmcHo
dZdm9pN41uAO4wc8AANXFFVmXKPIC5PSo/lcHcMoGPnbGOCLBBjEp+nljemC2JFS
CIehwm/D0UlKmVf/n+IhFNeBBukVadI1cUsQOCQ/Y2K+zBJd4rHMDEwU4DD7LlVw
yCvmbCdSlk9gNuFfkKzYlhg=
-----END PRIVATE KEY-----
`;

async function startTestEnv() {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGO_URI = mongo.getUri();
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test_access_secret_at_least_32_chars_xxxxxxxxxx';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_at_least_32_chars_xxxxxxxx';
  process.env.INITIAL_BALANCE = '20000';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.BANK_RSA_PRIVATE_PEM = TEST_BANK_RSA_PEM;

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
  TEST_BANK_RSA_PEM,
};
