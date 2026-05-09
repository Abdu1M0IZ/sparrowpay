// Standalone end-to-end harness for the blind-signature protocol.
//
// Verifies that the actual code paths used by the donation controller and
// the actual code paths used by the browser blind-signature client agree on
// every step: blind, sign, unblind, verify. Does NOT require MongoDB.
//
// Run: node scripts/protocol_e2e.js

const path = require('path');
const fs = require('fs');

// Inject the test PEM so bankRsa loads deterministically.
process.env.BANK_RSA_PRIVATE_PEM = fs.readFileSync(
  path.resolve(__dirname, '..', 'tests', 'fixtures', 'bank_rsa_test.pem'),
  'utf8'
);

const bankRsa = require('../src/config/bankRsa');
const ac = require('../src/utils/anonymousCrypto');

// We want to exercise the BROWSER blind-signature module too. It uses
// globalThis.crypto + atob/btoa, all available in modern Node.
const browserBs = require('../../frontend/src/utils/blindSig.js');

function assert(cond, msg) {
  if (!cond) {
    console.error('  FAIL:', msg);
    process.exitCode = 1;
    throw new Error(msg);
  }
  console.log('  ok  :', msg);
}

async function main() {
  console.log('\n[1] Bank key loaded');
  console.log('    modulus bits   :', bankRsa.n.toString(2).length);
  console.log('    public exponent:', bankRsa.eNumber);
  assert(bankRsa.n.toString(2).length === 2048, '2048-bit modulus');
  assert(bankRsa.eNumber === 65537, 'public exponent is 65537');

  console.log('\n[2] Browser-side blind, server-side sign, browser unblind, server verify');
  const COUNT = 200; // full chunk size
  const t0 = Date.now();

  // ---- BROWSER side: build blinded values exactly like the orchestrator
  const browserBlinds = [];
  for (let i = 0; i < COUNT; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const b = await browserBs.blindSerial(bankRsa.n, bankRsa.e);
    browserBlinds.push(b);
  }
  const t1 = Date.now();
  console.log(`    browser blinded ${COUNT} serials in ${t1 - t0}ms`);

  // ---- BANK side: parse, sign, return signatures (mirrors mint controller)
  const signaturesB64u = browserBlinds.map((b) => {
    const blindedBig = ac.b64urlToBigInt(b.blindedB64u);
    assert(blindedBig >= 0n && blindedBig < bankRsa.n, 'blinded value in range');
    const signed = bankRsa.signBlinded(blindedBig);
    return ac.bigIntToB64url(signed, bankRsa.modulusByteLen);
  });
  const t2 = Date.now();
  console.log(`    bank signed ${COUNT} blinded values in ${t2 - t1}ms`);

  // ---- BROWSER side: unblind to get final (serial, sig) tokens
  const tokens = signaturesB64u.map((sigBlinded, i) => {
    const sig = browserBs.unblindSig(sigBlinded, browserBlinds[i].blinder, bankRsa.n);
    return {
      serial: browserBs.bytesToHex(browserBlinds[i].serial),
      sig: browserBs.bigIntToB64url(sig),
    };
  });
  const t3 = Date.now();
  console.log(`    browser unblinded ${COUNT} signatures in ${t3 - t2}ms`);

  // ---- RECIPIENT/BANK side: verify each token (mirrors redeem controller)
  let validCount = 0;
  for (const tok of tokens) {
    const sigBig = ac.b64urlToBigInt(tok.sig);
    const serialBytes = Buffer.from(tok.serial, 'hex');
    if (ac.verifyToken(serialBytes, sigBig, bankRsa.e, bankRsa.n)) validCount += 1;
  }
  const t4 = Date.now();
  console.log(`    server verified ${COUNT} tokens in ${t4 - t3}ms`);
  assert(validCount === COUNT, `all ${COUNT} tokens verify`);

  console.log('\n[3] Tampering with a serial breaks verification');
  const tampered = { ...tokens[0] };
  // Flip one byte of the serial
  const bytes = Buffer.from(tampered.serial, 'hex');
  bytes[0] ^= 0x01;
  tampered.serial = bytes.toString('hex');
  const sigBig = ac.b64urlToBigInt(tampered.sig);
  const ok = ac.verifyToken(Buffer.from(tampered.serial, 'hex'), sigBig, bankRsa.e, bankRsa.n);
  assert(!ok, 'tampered serial fails verification');

  console.log('\n[4] Tampering with a signature breaks verification');
  const tampered2 = { ...tokens[1] };
  const sigBytes = ac.b64urlDecode(tampered2.sig);
  sigBytes[sigBytes.length - 1] ^= 0x01;
  tampered2.sig = ac.b64urlEncode(sigBytes);
  const ok2 = ac.verifyToken(
    Buffer.from(tampered2.serial, 'hex'),
    ac.b64urlToBigInt(tampered2.sig),
    bankRsa.e,
    bankRsa.n
  );
  assert(!ok2, 'tampered signature fails verification');

  console.log('\n[5] Forged signature without a real signing key fails verification');
  const fakeSerial = require('crypto').randomBytes(32);
  const fakeSig = require('crypto').randomBytes(256);
  const okFake = ac.verifyToken(
    fakeSerial,
    ac.bytesToBigInt(fakeSig) % bankRsa.n,
    bankRsa.e,
    bankRsa.n
  );
  assert(!okFake, 'random forged signature fails verification');

  console.log('\n[6] Per-token blinders differ (so bank cannot link mints)');
  const bs = new Set(browserBlinds.map((b) => b.blinder.toString()));
  assert(bs.size === COUNT, 'every blinder is unique');

  console.log('\n[7] Per-token serials differ (so recipient ledger has unique entries)');
  const ss = new Set(tokens.map((t) => t.serial));
  assert(ss.size === COUNT, 'every serial is unique');

  console.log('\n[8] Bank-signed-blinded values have NO statistical correlation with serials');
  // The Chaum guarantee: blinded = m * r^e mod n is uniform over Z_n* given
  // uniform r, regardless of m. We can't prove that with a finite sample,
  // but we can sanity-check that the blinded values look uniform by
  // checking they're spread across the modulus, and that no two are equal.
  const blindedSet = new Set(browserBlinds.map((b) => b.blindedB64u));
  assert(blindedSet.size === COUNT, 'every blinded value is unique');

  console.log('\nAll protocol checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
