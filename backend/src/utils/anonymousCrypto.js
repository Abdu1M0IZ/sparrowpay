// RSA blind-signature math primitives.
//
// Pure-BigInt implementation of the operations needed for the Chaum-style
// blind-signature donation flow:
//
//   serial  -> m  = H(serial) mod n         (donor side)
//   blind   -> b  = m * r^e   mod n         (donor side)
//   sign    -> s' = b^d        mod n        (bank, this server)
//   unblind -> s  = s' * r^-1 mod n         (donor side)
//   verify  -> s^e == m        mod n        (recipient side, also this server)
//
// Server-side production signing uses OpenSSL via crypto.privateDecrypt with
// RSA_NO_PADDING (see bankRsa.js) because raw 2048-bit BigInt modPow is ~50x
// slower than native and stacks up at scale. This file keeps the math in
// JS so it can be unit-tested directly and reused for verification.

const crypto = require('crypto');

// ----- byte / bigint conversions ----------------------------------------

function bytesToBigInt(buf) {
  if (!buf || buf.length === 0) return 0n;
  // Build a hex string and parse. Fast enough for 256-byte inputs.
  const hex = Buffer.from(buf).toString('hex');
  return BigInt('0x' + hex);
}

function bigIntToBytes(n, byteLen) {
  let hex = n.toString(16);
  if (hex.length % 2 === 1) hex = '0' + hex;
  let buf = Buffer.from(hex, 'hex');
  if (byteLen != null) {
    if (buf.length > byteLen) {
      // Strip leading zero bytes if we overshot due to odd-length padding.
      buf = buf.subarray(buf.length - byteLen);
    } else if (buf.length < byteLen) {
      const pad = Buffer.alloc(byteLen - buf.length);
      buf = Buffer.concat([pad, buf]);
    }
  }
  return buf;
}

// ----- base64url <-> bigint ---------------------------------------------

function b64urlEncode(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function b64urlDecode(s) {
  const padded = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, 'base64');
}

function bigIntToB64url(n, byteLen) {
  return b64urlEncode(bigIntToBytes(n, byteLen));
}

function b64urlToBigInt(s) {
  return bytesToBigInt(b64urlDecode(s));
}

// ----- modular arithmetic ------------------------------------------------

// Square-and-multiply modular exponentiation. Used directly for verification
// (small e=65537) and as a portable fallback for signing.
function modPow(base, exp, mod) {
  if (mod === 1n) return 0n;
  let result = 1n;
  let b = base % mod;
  if (b < 0n) b += mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    e >>= 1n;
    b = (b * b) % mod;
  }
  return result;
}

// Extended Euclidean algorithm. Returns [g, x, y] s.t. a*x + b*y = g = gcd(a,b).
function egcd(a, b) {
  if (b === 0n) return [a, 1n, 0n];
  const [g, x1, y1] = egcd(b, a % b);
  return [g, y1, x1 - (a / b) * y1];
}

function gcd(a, b) {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y > 0n) {
    [x, y] = [y, x % y];
  }
  return x;
}

// Modular inverse of a mod m. Throws if a is not coprime to m.
function modInverse(a, m) {
  const aa = ((a % m) + m) % m;
  const [g, x] = egcd(aa, m);
  if (g !== 1n) throw new Error('modInverse: a and m are not coprime');
  return ((x % m) + m) % m;
}

// Generate a random integer in [2, n-1] coprime to n. Used by tests; the
// real frontend generates these client-side using window.crypto.
function randomCoprime(n) {
  const byteLen = Math.ceil(n.toString(2).length / 8);
  // Cap retries to avoid pathological loops; for an RSA modulus the
  // probability of collision with the (huge) prime factors is astronomically
  // small, but if for some reason the modulus had small factors we want to
  // surface that rather than spin forever.
  for (let i = 0; i < 1024; i += 1) {
    const buf = crypto.randomBytes(byteLen);
    const r = bytesToBigInt(buf) % n;
    if (r > 1n && gcd(r, n) === 1n) return r;
  }
  throw new Error('randomCoprime: failed to find a coprime value');
}

// ----- blind-signature primitives ---------------------------------------

// SHA-256(serial) reduced mod n, as a BigInt.
function hashSerialToInt(serialBytes, n) {
  const digest = crypto.createHash('sha256').update(serialBytes).digest();
  return bytesToBigInt(digest) % n;
}

// signBlinded(b, d, n) = b^d mod n. Pure BigInt; OK for tests with small
// moduli but slow with a 2048-bit d. Production uses bankRsa.signBlinded
// which calls into OpenSSL.
function signBlinded(blinded, d, n) {
  return modPow(blinded, d, n);
}

// verifyToken: re-implements the Chaum check. (sig^e mod n) must equal
// (H(serial) mod n).
function verifyToken(serialBytes, sigBigInt, e, n) {
  const lhs = modPow(sigBigInt, e, n);
  const rhs = hashSerialToInt(serialBytes, n);
  return lhs === rhs;
}

module.exports = {
  bytesToBigInt,
  bigIntToBytes,
  b64urlEncode,
  b64urlDecode,
  bigIntToB64url,
  b64urlToBigInt,
  modPow,
  egcd,
  gcd,
  modInverse,
  randomCoprime,
  hashSerialToInt,
  signBlinded,
  verifyToken,
};
