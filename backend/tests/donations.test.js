// Donations tests - the 12-case suite from the design spec.
//
// Notes on test infrastructure:
//   - bankRsa.js uses the test PEM injected via BANK_RSA_PRIVATE_PEM in setup.js
//     so n, e, d are stable across runs.
//   - We reproduce the donor-side blinding/unblinding logic here because the
//     point of the test suite is to confirm the on-the-wire flow really works
//     end-to-end, not just that the server's own helpers agree with themselves.

const crypto = require('crypto');

const {
  startTestEnv, stopTestEnv, clearDb, request,
  signupAndLogin, sampleSignup,
} = require('./setup');

const ac = require('../src/utils/anonymousCrypto');
const DonationRedeemed = require('../src/models/DonationRedeemed');
const DonationMintAudit = require('../src/models/DonationMintAudit');
const Transaction = require('../src/models/Transaction');

beforeAll(async () => { await startTestEnv(); });
afterAll(async () => { await stopTestEnv(); });
beforeEach(async () => { await clearDb(); });

function authHeader(token) { return { Authorization: `Bearer ${token}` }; }

// Donor-side blinding. Returns parallel arrays for cleanup later.
function blindAmountTokens(n, e, count) {
  const serials = [];   // Buffer
  const blinders = [];  // bigint
  const blindedB64u = []; // string
  for (let i = 0; i < count; i += 1) {
    const serial = crypto.randomBytes(32);
    const m = ac.hashSerialToInt(serial, n);
    const r = ac.randomCoprime(n);
    const blinded = (m * ac.modPow(r, e, n)) % n;
    serials.push(serial);
    blinders.push(r);
    blindedB64u.push(ac.bigIntToB64url(blinded));
  }
  return { serials, blinders, blindedB64u };
}

// Donor-side unblinding. Takes server signatures (b64url) and returns the
// final (serial-hex, sig-b64url) tuples ready for /redeem.
function unblindToTokens(n, signatures, serials, blinders) {
  const tokens = [];
  for (let i = 0; i < signatures.length; i += 1) {
    const sPrime = ac.b64urlToBigInt(signatures[i]);
    const rInv = ac.modInverse(blinders[i], n);
    const sig = (sPrime * rInv) % n;
    tokens.push({
      serial: serials[i].toString('hex'),
      sig: ac.bigIntToB64url(sig),
    });
  }
  return tokens;
}

describe('Anonymous donations - blind signature flow', () => {
  // 1
  test('GET /api/donations/bank-key returns valid n_b64url and e', async () => {
    const r = await request().get('/api/donations/bank-key');
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(typeof r.body.n_b64url).toBe('string');
    expect(r.body.n_b64url.length).toBeGreaterThan(300); // ~342 chars for 2048-bit
    expect(r.body.e).toBe(65537);
    // n parses as a BigInt and is within an expected order of magnitude.
    const n = ac.b64urlToBigInt(r.body.n_b64url);
    expect(n.toString(2).length).toBeGreaterThanOrEqual(2047);
    expect(n.toString(2).length).toBeLessThanOrEqual(2048);
  });

  // 2
  test('mint without auth returns 401', async () => {
    const key = await request().get('/api/donations/bank-key');
    const n = ac.b64urlToBigInt(key.body.n_b64url);
    const { blindedB64u } = blindAmountTokens(n, BigInt(key.body.e), 3);
    const r = await request().post('/api/donations/mint').send({
      blindedSerials: blindedB64u, amount: 3, pin: '1234',
    });
    expect(r.status).toBe(401);
  });

  // 3
  test('mint with wrong PIN returns 403', async () => {
    const { accessToken } = await signupAndLogin();
    const key = await request().get('/api/donations/bank-key');
    const n = ac.b64urlToBigInt(key.body.n_b64url);
    const { blindedB64u } = blindAmountTokens(n, BigInt(key.body.e), 5);
    const r = await request()
      .post('/api/donations/mint')
      .set(authHeader(accessToken))
      .send({ blindedSerials: blindedB64u, amount: 5, pin: '0000' });
    expect(r.status).toBe(403);
  });

  // 4
  test('mint with count !== amount returns 400', async () => {
    const { accessToken } = await signupAndLogin();
    const key = await request().get('/api/donations/bank-key');
    const n = ac.b64urlToBigInt(key.body.n_b64url);
    const { blindedB64u } = blindAmountTokens(n, BigInt(key.body.e), 3);
    const r = await request()
      .post('/api/donations/mint')
      .set(authHeader(accessToken))
      .send({ blindedSerials: blindedB64u, amount: 5, pin: '1234' });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/count must equal amount/i);
  });

  // 5
  test('mint with amount > 200 returns 400 from schema', async () => {
    const { accessToken } = await signupAndLogin();
    const r = await request()
      .post('/api/donations/mint')
      .set(authHeader(accessToken))
      .send({ blindedSerials: ['Zg'], amount: 201, pin: '1234' });
    expect(r.status).toBe(400);
  });

  // 6
  test('mint with insufficient balance returns 400', async () => {
    // signup defaults give 20000 starting balance; we go above that.
    const { accessToken } = await signupAndLogin();
    const key = await request().get('/api/donations/bank-key');
    const n = ac.b64urlToBigInt(key.body.n_b64url);
    // First drain the account so any further mint fails.
    await request()
      .post('/api/transactions')
      .set(authHeader(accessToken))
      .send({ kind: 'transaction', bankType: 'SadaPay', to: 'drain', amount: 19999, pin: '1234' });
    // Now try to mint 100 PKR with only 1 PKR left.
    const { blindedB64u } = blindAmountTokens(n, BigInt(key.body.e), 100);
    const r = await request()
      .post('/api/donations/mint')
      .set(authHeader(accessToken))
      .send({ blindedSerials: blindedB64u, amount: 100, pin: '1234' });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/insufficient/i);
  });

  // 7
  test('successful mint debits donor, audits with encrypted metadata, ' +
       'creates Anonymous Donation transaction, returns count signatures', async () => {
    const { accessToken, user } = await signupAndLogin();
    const key = await request().get('/api/donations/bank-key');
    const n = ac.b64urlToBigInt(key.body.n_b64url);
    const e = BigInt(key.body.e);
    const { blindedB64u } = blindAmountTokens(n, e, 17);

    const r = await request()
      .post('/api/donations/mint')
      .set(authHeader(accessToken))
      .send({ blindedSerials: blindedB64u, amount: 17, pin: '1234' });

    expect(r.status).toBe(200);
    expect(r.body.signatures).toHaveLength(17);

    // Donor balance dropped by 17.
    const me = await request().get('/api/me').set(authHeader(accessToken));
    expect(me.body.balance).toBe(20000 - 17);

    // Mint audit row exists with the donor's id and encrypted metadata.
    const audit = await DonationMintAudit.findOne({ donor: user.id });
    expect(audit).not.toBeNull();
    expect(audit.amount).toBe(17);
    expect(audit.count).toBe(17);
    // The encrypted metadata is opaque if no MASTER_ENC_KEY is configured
    // (passthrough plaintext) OR begins with 'v1:' if encryption is enabled.
    // Tests don't set MASTER_ENC_KEY, so we just check the field is populated.
    expect(typeof audit.metadataEnc).toBe('string');
    expect(audit.metadataEnc.length).toBeGreaterThan(0);

    // Donor-side Transaction row uses the anonymized label.
    const tx = await Transaction.findOne({ user: user.id, kind: 'donation' });
    expect(tx).not.toBeNull();
    expect(tx.toLabel).toBe('Anonymous Donation');
    expect(tx.bankType).toBe('SparrowPay');
    expect(tx.amount).toBe(17);
    expect(tx.status).toBe('Completed');

    // Mint response also surfaces the donor transaction so the frontend
    // can navigate to its detail page.
    expect(r.body.donorTransaction).toBeDefined();
    expect(r.body.donorTransaction.id).toBe(tx._id.toString());
  });

  // 8
  test('returned signatures unblind to valid (serial, sig) pairs', async () => {
    const { accessToken } = await signupAndLogin();
    const key = await request().get('/api/donations/bank-key');
    const n = ac.b64urlToBigInt(key.body.n_b64url);
    const e = BigInt(key.body.e);
    const { serials, blinders, blindedB64u } = blindAmountTokens(n, e, 4);

    const r = await request()
      .post('/api/donations/mint')
      .set(authHeader(accessToken))
      .send({ blindedSerials: blindedB64u, amount: 4, pin: '1234' });

    expect(r.status).toBe(200);
    const tokens = unblindToTokens(n, r.body.signatures, serials, blinders);
    for (const t of tokens) {
      const sigBig = ac.b64urlToBigInt(t.sig);
      const serialBytes = Buffer.from(t.serial, 'hex');
      expect(ac.verifyToken(serialBytes, sigBig, e, n)).toBe(true);
    }
  });

  // 9
  test('successful redeem credits recipient, creates DonationRedeemed rows ' +
       'with no donor field, creates Anonymous Donor transaction', async () => {
    const donor = await signupAndLogin();
    const recipient = await signupAndLogin(sampleSignup({
      username: 'charity', phone: '0301-2222222', cnic: '35202-2222222-2',
    }));

    const key = await request().get('/api/donations/bank-key');
    const n = ac.b64urlToBigInt(key.body.n_b64url);
    const e = BigInt(key.body.e);

    const { serials, blinders, blindedB64u } = blindAmountTokens(n, e, 25);
    const mintResp = await request()
      .post('/api/donations/mint')
      .set(authHeader(donor.accessToken))
      .send({ blindedSerials: blindedB64u, amount: 25, pin: '1234' });
    const tokens = unblindToTokens(n, mintResp.body.signatures, serials, blinders);

    const redeemResp = await request().post('/api/donations/redeem').send({
      tokens, recipient: 'charity',
    });
    expect(redeemResp.status).toBe(200);
    expect(redeemResp.body.redeemedCount).toBe(25);
    expect(redeemResp.body.creditedAmount).toBe(25);

    // Recipient balance grew.
    const me = await request().get('/api/me').set(authHeader(recipient.accessToken));
    expect(me.body.balance).toBe(20000 + 25);

    // DonationRedeemed rows: 25 of them, recipient set, NO donor field.
    const rows = await DonationRedeemed.find({}).lean();
    expect(rows).toHaveLength(25);
    for (const row of rows) {
      expect(String(row.recipient)).toBe(recipient.user.id);
      expect(row.amount).toBe(1);
      expect(row.donor).toBeUndefined();
      expect(row.issuedToUser).toBeUndefined();
    }

    // Recipient-facing Transaction row uses the anonymized donor label.
    const recipTx = await Transaction.findOne({
      user: recipient.user.id, kind: 'donation',
    });
    expect(recipTx).not.toBeNull();
    expect(recipTx.toLabel).toBe('Anonymous Donor');
    expect(recipTx.amount).toBe(25);
    expect(recipTx.status).toBe('Received');
  });

  // 10
  test('redeeming the same token twice does not credit twice', async () => {
    const donor = await signupAndLogin();
    await signupAndLogin(sampleSignup({
      username: 'charity', phone: '0301-2222222', cnic: '35202-2222222-2',
    }));

    const key = await request().get('/api/donations/bank-key');
    const n = ac.b64urlToBigInt(key.body.n_b64url);
    const e = BigInt(key.body.e);
    const { serials, blinders, blindedB64u } = blindAmountTokens(n, e, 5);
    const mintResp = await request()
      .post('/api/donations/mint')
      .set(authHeader(donor.accessToken))
      .send({ blindedSerials: blindedB64u, amount: 5, pin: '1234' });
    const tokens = unblindToTokens(n, mintResp.body.signatures, serials, blinders);

    const r1 = await request().post('/api/donations/redeem').send({
      tokens, recipient: 'charity',
    });
    expect(r1.status).toBe(200);
    expect(r1.body.redeemedCount).toBe(5);

    // Second redeem of the same tokens: every token is now spent, so the
    // controller returns 400.
    const r2 = await request().post('/api/donations/redeem').send({
      tokens, recipient: 'charity',
    });
    expect(r2.status).toBe(400);
    expect(r2.body.message).toMatch(/no valid tokens/i);

    // Mixed batch: 3 already-spent + 2 fresh => 2 credited.
    const fresh = blindAmountTokens(n, e, 2);
    const m2 = await request()
      .post('/api/donations/mint')
      .set(authHeader(donor.accessToken))
      .send({ blindedSerials: fresh.blindedB64u, amount: 2, pin: '1234' });
    const freshTokens = unblindToTokens(n, m2.body.signatures, fresh.serials, fresh.blinders);
    const mixed = [...tokens.slice(0, 3), ...freshTokens];
    const r3 = await request().post('/api/donations/redeem').send({
      tokens: mixed, recipient: 'charity',
    });
    expect(r3.status).toBe(200);
    expect(r3.body.redeemedCount).toBe(2);
  });

  // 11
  test('redeeming a forged signature does not credit', async () => {
    await signupAndLogin();
    await signupAndLogin(sampleSignup({
      username: 'charity', phone: '0301-2222222', cnic: '35202-2222222-2',
    }));

    const key = await request().get('/api/donations/bank-key');

    // Build a (serial, sig) pair where sig is a random bigint - extremely
    // unlikely to verify against H(serial).
    const fakeSerial = crypto.randomBytes(32).toString('hex');
    const fakeSig = ac.bigIntToB64url(
      ac.bytesToBigInt(crypto.randomBytes(256))
        % ac.b64urlToBigInt(key.body.n_b64url)
    );

    const r = await request().post('/api/donations/redeem').send({
      tokens: [{ serial: fakeSerial, sig: fakeSig }],
      recipient: 'charity',
    });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/no valid tokens/i);

    // No redemption rows or recipient transactions were created.
    expect(await DonationRedeemed.countDocuments({})).toBe(0);
    expect(await Transaction.countDocuments({ kind: 'donation', status: 'Received' })).toBe(0);
  });

  // 12
  test('anonymity invariants: no donor-recipient correlation in any collection', async () => {
    const donor = await signupAndLogin();
    const recipient = await signupAndLogin(sampleSignup({
      username: 'charity', phone: '0301-2222222', cnic: '35202-2222222-2',
    }));

    const key = await request().get('/api/donations/bank-key');
    const n = ac.b64urlToBigInt(key.body.n_b64url);
    const e = BigInt(key.body.e);
    const { serials, blinders, blindedB64u } = blindAmountTokens(n, e, 10);
    const mintResp = await request()
      .post('/api/donations/mint')
      .set(authHeader(donor.accessToken))
      .send({ blindedSerials: blindedB64u, amount: 10, pin: '1234' });
    const tokens = unblindToTokens(n, mintResp.body.signatures, serials, blinders);
    await request().post('/api/donations/redeem').send({
      tokens, recipient: 'charity',
    });

    // (a) DonationRedeemed has no donor field - the schema doesn't define it.
    const sample = await DonationRedeemed.findOne({}).lean();
    expect(sample).not.toBeNull();
    expect(Object.keys(sample)).not.toContain('donor');
    expect(Object.keys(sample)).not.toContain('issuedToUser');
    // Direct query would return nothing because the field isn't indexed/stored.
    const byDonor = await DonationRedeemed.findOne({ donor: donor.user.id });
    expect(byDonor).toBeNull();

    // (b) Donor's transaction history must NOT contain the recipient's username.
    const donorRecipientHits = await Transaction.find({
      user: donor.user.id,
      toLabel: { $regex: recipient.user.username, $options: 'i' },
    });
    expect(donorRecipientHits).toHaveLength(0);

    // (c) Recipient's transaction history must NOT contain the donor's username.
    const recipDonorHits = await Transaction.find({
      user: recipient.user.id,
      toLabel: { $regex: donor.user.username, $options: 'i' },
    });
    expect(recipDonorHits).toHaveLength(0);

    // (d) The mint audit row's *plaintext* fields don't reveal the recipient
    // (we never told the bank who the recipient was during /mint).
    const audit = await DonationMintAudit.findOne({ donor: donor.user.id });
    expect(audit).not.toBeNull();
    // metadataEnc is JSON of {donorId, amount, count, ts} - by construction
    // it does not mention the recipient's username.
    expect(audit.metadataEnc).not.toContain(recipient.user.username);
  });
});
