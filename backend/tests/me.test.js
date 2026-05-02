// /api/me tests: profile fetch, profile update, change password, change PIN.

const { startTestEnv, stopTestEnv, clearDb, request, signupAndLogin } = require('./setup');

beforeAll(async () => { await startTestEnv(); });
afterAll(async () => { await stopTestEnv(); });
beforeEach(async () => { await clearDb(); });

describe('Me', () => {
  test('GET /api/me returns user info and balance', async () => {
    const { accessToken } = await signupAndLogin();
    const res = await request().get('/api/me').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('testuser');
    expect(res.body.balance).toBe(20000);
    expect(res.body.phone).toBe('0301-1234567');
  });

  test('PATCH /api/me/profile updates fullName and phone', async () => {
    const { accessToken } = await signupAndLogin();
    const r = await request()
      .patch('/api/me/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fullName: 'New Name', phone: '0345-1112233' });
    expect(r.status).toBe(200);
    expect(r.body.data.fullName).toBe('New Name');
    expect(r.body.data.phone).toBe('0345-1112233');
  });

  test('change password rejects wrong current password', async () => {
    const { accessToken } = await signupAndLogin();
    const r = await request()
      .patch('/api/me/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'WRONG', newPassword: 'AnotherStrong456!', confirmPassword: 'AnotherStrong456!' });
    expect(r.status).toBe(401);
  });

  test('change password succeeds and old password no longer logs in', async () => {
    const { accessToken } = await signupAndLogin();
    const r = await request()
      .patch('/api/me/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'StrongPassword123!', newPassword: 'AnotherStrong456!', confirmPassword: 'AnotherStrong456!' });
    expect(r.status).toBe(200);

    const oldLogin = await request().post('/api/auth/login').send({ username: 'testuser', password: 'StrongPassword123!' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request().post('/api/auth/login').send({ username: 'testuser', password: 'AnotherStrong456!' });
    expect(newLogin.status).toBe(200);
  });

  test('change password rejects mismatched confirmation', async () => {
    const { accessToken } = await signupAndLogin();
    const r = await request()
      .patch('/api/me/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'StrongPassword123!', newPassword: 'AnotherStrong456!', confirmPassword: 'mismatched' });
    expect(r.status).toBe(400);
  });

  test('change PIN rejects wrong current PIN', async () => {
    const { accessToken } = await signupAndLogin();
    const r = await request()
      .patch('/api/me/pin')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPin: '0000', newPin: '4321', confirmPin: '4321' });
    expect(r.status).toBe(401);
  });

  test('change PIN succeeds with correct current PIN', async () => {
    const { accessToken } = await signupAndLogin();
    const r = await request()
      .patch('/api/me/pin')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPin: '1234', newPin: '4321', confirmPin: '4321' });
    expect(r.status).toBe(200);
  });
});
