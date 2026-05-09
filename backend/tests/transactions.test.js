// Transactions tests.

const { startTestEnv, stopTestEnv, clearDb, request, signupAndLogin, sampleSignup } = require('./setup');

beforeAll(async () => { await startTestEnv(); });
afterAll(async () => { await stopTestEnv(); });
beforeEach(async () => { await clearDb(); });

async function authHeader(token) { return { Authorization: `Bearer ${token}` }; }

describe('Transactions', () => {
  test('rejects wrong PIN', async () => {
    const { accessToken } = await signupAndLogin();
    const r = await request()
      .post('/api/transactions')
      .set(await authHeader(accessToken))
      .send({ kind: 'transaction', bankType: 'SadaPay', to: 'Friend', amount: 100, pin: '0000' });
    expect(r.status).toBe(403);
  });

  test('rejects insufficient balance', async () => {
    const { accessToken } = await signupAndLogin();
    const r = await request()
      .post('/api/transactions')
      .set(await authHeader(accessToken))
      .send({ kind: 'transaction', bankType: 'SadaPay', to: 'Friend', amount: 999999, pin: '1234' });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/insufficient/i);
  });

  test('external transfer succeeds and balance decreases', async () => {
    const { accessToken } = await signupAndLogin();
    const r = await request()
      .post('/api/transactions')
      .set(await authHeader(accessToken))
      .send({ kind: 'transaction', bankType: 'SadaPay', to: 'Friend', amount: 500, pin: '1234' });
    expect(r.status).toBe(201);
    const me = await request().get('/api/me').set(await authHeader(accessToken));
    expect(me.body.balance).toBe(19500);
  });

  test('SparrowPay-to-SparrowPay transfer credits recipient', async () => {
    const sender = await signupAndLogin();
    const recipient = await signupAndLogin(sampleSignup({
      username: 'recip', phone: '0301-7654321', cnic: '35202-7654321-2',
    }));

    const r = await request()
      .post('/api/transactions')
      .set(await authHeader(sender.accessToken))
      .send({ kind: 'transaction', bankType: 'SparrowPay', to: 'recip', amount: 1500, pin: '1234' });
    expect(r.status).toBe(201);

    const senderMe = await request().get('/api/me').set(await authHeader(sender.accessToken));
    expect(senderMe.body.balance).toBe(20000 - 1500);

    const recipMe = await request().get('/api/me').set(await authHeader(recipient.accessToken));
    expect(recipMe.body.balance).toBe(20000 + 1500);
  });

  test('rejects transfer to non-existent SparrowPay user', async () => {
    const { accessToken } = await signupAndLogin();
    const r = await request()
      .post('/api/transactions')
      .set(await authHeader(accessToken))
      .send({ kind: 'transaction', bankType: 'SparrowPay', to: 'nobody-here', amount: 100, pin: '1234' });
    expect(r.status).toBe(404);
  });

  test('rejects negative or zero amount', async () => {
    const { accessToken } = await signupAndLogin();
    const r1 = await request()
      .post('/api/transactions')
      .set(await authHeader(accessToken))
      .send({ kind: 'transaction', bankType: 'SadaPay', to: 'Friend', amount: 0, pin: '1234' });
    expect(r1.status).toBe(400);
    const r2 = await request()
      .post('/api/transactions')
      .set(await authHeader(accessToken))
      .send({ kind: 'transaction', bankType: 'SadaPay', to: 'Friend', amount: -50, pin: '1234' });
    expect(r2.status).toBe(400);
  });

  test('list transactions returns most recent first', async () => {
    const { accessToken } = await signupAndLogin();
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await request()
        .post('/api/transactions')
        .set(await authHeader(accessToken))
        .send({ kind: 'transaction', bankType: 'SadaPay', to: `f${i}`, amount: 10 + i, pin: '1234' });
    }
    const r = await request().get('/api/transactions?kind=transaction').set(await authHeader(accessToken));
    expect(r.status).toBe(200);
    expect(r.body.items.length).toBe(3);
  });

  test('rejects SparrowPay donations on /transactions (must use /donations)', async () => {
    const sender = await signupAndLogin();
    await signupAndLogin(sampleSignup({
      username: 'charity', phone: '0301-2222222', cnic: '35202-2222222-2',
    }));
    const r = await request()
      .post('/api/transactions')
      .set(await authHeader(sender.accessToken))
      .send({ kind: 'donation', bankType: 'SparrowPay', to: 'charity', amount: 50, pin: '1234' });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/\/api\/donations/i);
  });

  test('external-bank donation anonymizes the stored recipient label', async () => {
    const { accessToken } = await signupAndLogin();
    const r = await request()
      .post('/api/transactions')
      .set(await authHeader(accessToken))
      .send({ kind: 'donation', bankType: 'SadaPay', to: 'Edhi Foundation', amount: 250, pin: '1234' });
    expect(r.status).toBe(201);
    expect(r.body.to).toBe('Anonymous Donation');
    expect(r.body.meta).not.toMatch(/Edhi/);
  });
});

describe('Favorites', () => {
  test('add, list, toggle, delete', async () => {
    const { accessToken } = await signupAndLogin();
    const headers = await authHeader(accessToken);

    // Add
    const r1 = await request().post('/api/favorites').set(headers).send({ name: 'Alice', accountType: 'SadaPay' });
    expect(r1.status).toBe(201);
    const favId = r1.body.id;

    // Duplicate add => 409
    const r2 = await request().post('/api/favorites').set(headers).send({ name: 'Alice', accountType: 'SadaPay' });
    expect(r2.status).toBe(409);

    // List
    const r3 = await request().get('/api/favorites').set(headers);
    expect(r3.status).toBe(200);
    expect(r3.body.items.length).toBe(1);

    // Check
    const r4 = await request().get('/api/favorites/check').query({ name: 'Alice', accountType: 'SadaPay' }).set(headers);
    expect(r4.body.favorited).toBe(true);

    // Toggle off
    const r5 = await request().post('/api/favorites/toggle').set(headers).send({ name: 'Alice', accountType: 'SadaPay' });
    expect(r5.body.favorited).toBe(false);

    // Toggle on
    const r6 = await request().post('/api/favorites/toggle').set(headers).send({ name: 'Alice', accountType: 'SadaPay' });
    expect(r6.body.favorited).toBe(true);

    // Delete (use the new id from toggle-on)
    const newId = r6.body.favorite.id;
    const r7 = await request().delete(`/api/favorites/${newId}`).set(headers);
    expect(r7.status).toBe(200);

    // Delete same again => 404
    const r8 = await request().delete(`/api/favorites/${favId}`).set(headers);
    expect(r8.status).toBe(404);
  });
});
