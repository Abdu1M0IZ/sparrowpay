// Bank RSA keypair, used for the blind-signature donation flow.
//
// On first import:
//   1. If BANK_RSA_PRIVATE_PEM env var is present, parse it.
//   2. Otherwise, if backend/.bank_rsa.pem exists on disk, load it.
//   3. Otherwise, generate a fresh 2048-bit keypair and persist to that path.
//
// Tests pin a deterministic PEM into BANK_RSA_PRIVATE_PEM at startup so they
// don't pay key-generation cost on every run.
//
// Production signing uses node:crypto.privateDecrypt with RSA_NO_PADDING,
// which is OpenSSL-backed raw modular exponentiation (~50x faster than a
// JS BigInt modPow with a 2048-bit exponent).

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
  bigIntToB64url,
  bigIntToBytes,
  bytesToBigInt,
  modPow,
} = require('../utils/anonymousCrypto');

const KEY_PATH = path.resolve(__dirname, '..', '..', '.bank_rsa.pem');

function loadOrCreatePrivateKey() {
  // 1. Env var wins (used by tests and explicit deployments).
  const envPem = process.env.BANK_RSA_PRIVATE_PEM;
  if (envPem && envPem.includes('PRIVATE KEY')) {
    return crypto.createPrivateKey({ key: envPem, format: 'pem' });
  }

  // 2. Persisted file from a previous boot.
  if (fs.existsSync(KEY_PATH)) {
    const pem = fs.readFileSync(KEY_PATH, 'utf8');
    return crypto.createPrivateKey({ key: pem, format: 'pem' });
  }

  // 3. Fresh keypair on first run.
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicExponent: 0x10001,
  });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  try {
    fs.writeFileSync(KEY_PATH, pem, { mode: 0o600 });
  } catch {
    // Read-only filesystem in some hosted environments. The keypair lives
    // in memory for this process; that's good enough to not crash.
  }
  return privateKey;
}

const privateKey = loadOrCreatePrivateKey();
const publicKey = crypto.createPublicKey(privateKey);

// Pull n, e, d out as BigInts. JWK gives us base64url-encoded big-endian
// integers, which is exactly what we need.
const jwkPriv = privateKey.export({ format: 'jwk' });
const jwkPub = publicKey.export({ format: 'jwk' });

function jwkB64uToBigInt(s) {
  // JWK uses base64url. Reuse the helper from anonymousCrypto via a small inline
  // implementation here to avoid a circular import surprise during refactors.
  const padded = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return bytesToBigInt(Buffer.from(padded + pad, 'base64'));
}

const n = jwkB64uToBigInt(jwkPub.n);
const e = jwkB64uToBigInt(jwkPub.e);
const d = jwkB64uToBigInt(jwkPriv.d);

const eNumber = Number(e);
const modulusByteLen = Math.ceil(n.toString(2).length / 8);
const nB64url = bigIntToB64url(n);

// Fast signing via OpenSSL. crypto.privateDecrypt with RSA_NO_PADDING does
// raw m^d mod n. Input must be exactly modulusByteLen bytes (left-padded
// with zeros if needed) and strictly less than n.
function signBlindedFast(blindedBigInt) {
  if (blindedBigInt < 0n || blindedBigInt >= n) {
    throw new Error('signBlindedFast: blinded value out of range [0, n).');
  }
  const inBuf = bigIntToBytes(blindedBigInt, modulusByteLen);
  const outBuf = crypto.privateDecrypt(
    { key: privateKey, padding: crypto.constants.RSA_NO_PADDING },
    inBuf,
  );
  return bytesToBigInt(outBuf);
}

// Pure-JS fallback that works regardless of OpenSSL behavior. Slow but
// useful as a sanity reference and for environments where privateDecrypt
// in raw mode isn't available.
function signBlindedSlow(blindedBigInt) {
  return modPow(blindedBigInt, d, n);
}

module.exports = {
  n,
  e,
  d,
  eNumber,
  nB64url,
  modulusByteLen,
  privateKey,
  publicKey,
  signBlinded: signBlindedFast,
  signBlindedFast,
  signBlindedSlow,
  KEY_PATH,
};
