// Auth flow tests: signup, login, refresh rotation, logout, username check,
// reset password by PIN, forgot PIN by password.

const { startTestEnv, stopTestEnv, clearDb, request, sampleSignup } = require('./setup');

beforeAll(async () => { await startTestEnv(); });
afterAll(async () => { await stopTestEnv(); });
beforeEach(async () => { await clearDb(); });

describe('Auth', () => {
  test('signup creates user and account, returns tokens', async () => {
    const res = await request().post('/api/auth/signup').send(sampleSignup());
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.access_token).toEqual(expect.any(String));
    expect(res.body.refresh_token).toEqual(expect.any(String));
    expect(res.body.user.username).toBe('testuser');

    // /me should report the seeded balance
    const me = await request().get('/api/me').set('Authorization', `Bearer ${res.body.access_token}`);
    expect(me.status).toBe(200);
    expect(me.body.balance).toBe(20000);
  });

  test('signup rejects duplicate username', async () => {
    await request().post('/api/auth/signup').send(sampleSignup());
    const res = await request().post('/api/auth/signup').send(sampleSignup());
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  test('signup rejects weak password', async () => {
    const res = await request().post('/api/auth/signup').send(sampleSignup({ password: 'short' }));
    expect(res.status).toBe(400);
  });

  test('signup rejects malformed phone or cnic', async () => {
    const r1 = await request().post('/api/auth/signup').send(sampleSignup({ phone: '0300' }));
    expect(r1.status).toBe(400);
    const r2 = await request().post('/api/auth/signup').send(sampleSignup({ username: 'u2', cnic: 'invalid' }));
    expect(r2.status).toBe(400);
  });

  test('login succeeds with correct credentials', async () => {
    await request().post('/api/auth/signup').send(sampleSignup());
    const res = await request().post('/api/auth/login').send({ username: 'testuser', password: 'StrongPassword123!' });
    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeDefined();
  });

  test('login fails with wrong password', async () => {
    await request().post('/api/auth/signup').send(sampleSignup());
    const res = await request().post('/api/auth/login').send({ username: 'testuser', password: 'WrongPassword123' });
    expect(res.status).toBe(401);
  });

  test('refresh rotates token and old token is revoked', async () => {
    const signup = await request().post('/api/auth/signup').send(sampleSignup());
    const r1 = await request().post('/api/auth/refresh').send({ refresh_token: signup.body.refresh_token });
    expect(r1.status).toBe(200);
    expect(r1.body.refresh_token).not.toBe(signup.body.refresh_token);

    // Re-using the OLD refresh token should now fail.
    const r2 = await request().post('/api/auth/refresh').send({ refresh_token: signup.body.refresh_token });
    expect(r2.status).toBe(401);
  });

  test('logout revokes refresh token', async () => {
    const signup = await request().post('/api/auth/signup').send(sampleSignup());
    const out = await request().post('/api/auth/logout').send({ refresh_token: signup.body.refresh_token });
    expect(out.status).toBe(200);
    const r = await request().post('/api/auth/refresh').send({ refresh_token: signup.body.refresh_token });
    expect(r.status).toBe(401);
  });

  test('check-username reports availability', async () => {
    const r1 = await request().get('/api/auth/check-username').query({ username: 'freshname' });
    expect(r1.status).toBe(200);
    expect(r1.body.available).toBe(true);

    await request().post('/api/auth/signup').send(sampleSignup({ username: 'freshname' }));
    const r2 = await request().get('/api/auth/check-username').query({ username: 'freshname' });
    expect(r2.body.available).toBe(false);
  });

  test('reset password by PIN works and old password no longer logs in', async () => {
    await request().post('/api/auth/signup').send(sampleSignup());
    const r = await request().post('/api/auth/reset-password-by-pin').send({
      username: 'testuser',
      pin: '1234',
      newPassword: 'BrandNewPassword456!',
      confirmPassword: 'BrandNewPassword456!',
    });
    expect(r.status).toBe(200);

    const oldLogin = await request().post('/api/auth/login').send({ username: 'testuser', password: 'StrongPassword123!' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request().post('/api/auth/login').send({ username: 'testuser', password: 'BrandNewPassword456!' });
    expect(newLogin.status).toBe(200);
  });

  test('forgot PIN by password works', async () => {
    await request().post('/api/auth/signup').send(sampleSignup());
    const r = await request().post('/api/auth/forgot-pin').send({
      username: 'testuser',
      password: 'StrongPassword123!',
      newPin: '9876',
      confirmPin: '9876',
    });
    expect(r.status).toBe(200);
  });

  test('protected route rejects missing token', async () => {
    const r = await request().get('/api/me');
    expect(r.status).toBe(401);
  });

  test('protected route rejects malformed token', async () => {
    const r = await request().get('/api/me').set('Authorization', 'Bearer not-a-token');
    expect(r.status).toBe(401);
  });
});
