// Donor-side RSA blind-signature math (browser).
//
// Pure native BigInt + window.crypto.subtle.digest. No third-party libraries.
// Mirrors backend/src/utils/anonymousCrypto.js but for the browser side of
// the protocol. The donor's flow per token is:
//
//   serial   = randomBytes(32)            (client picks)
//   m        = SHA-256(serial) mod n      (deterministic)
//   r        = random bigint coprime to n (client picks fresh per token)
//   blinded  = m * r^e mod n              (-> sent to bank)
//
//   --- bank signs: signedBlinded = blinded^d mod n ---
//
//   sig      = signedBlinded * r^-1 mod n (client unblinds, sends to recipient)
//
// The public exponent e is fixed at 65537, so client-side modPow is cheap
// regardless of modulus size.

// ----- byte / hex / b64url conversions ---------------------------------

export function bytesToHex(uint8) {
  let s = '';
  for (let i = 0; i < uint8.length; i += 1) {
    s += uint8[i].toString(16).padStart(2, '0');
  }
  return s;
}

export function hexToBytes(hex) {
  if (typeof hex !== 'string' || hex.length % 2 !== 0) {
    throw new Error('hexToBytes: invalid hex string');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToBigInt(uint8) {
  if (!uint8 || uint8.length === 0) return 0n;
  let hex = '';
  for (let i = 0; i < uint8.length; i += 1) {
    hex += uint8[i].toString(16).padStart(2, '0');
  }
  return BigInt('0x' + hex);
}

export function bigIntToBytes(n, byteLen) {
  if (n < 0n) throw new Error('bigIntToBytes: negative not supported');
  let hex = n.toString(16);
  if (hex.length % 2 === 1) hex = '0' + hex;
  let bytes = hexToBytes(hex);
  if (byteLen != null) {
    if (bytes.length > byteLen) {
      bytes = bytes.subarray(bytes.length - byteLen);
    } else if (bytes.length < byteLen) {
      const padded = new Uint8Array(byteLen);
      padded.set(bytes, byteLen - bytes.length);
      bytes = padded;
    }
  }
  return bytes;
}

function b64ToBytes(b64) {
  // atob is universally available in browsers and modern Node test envs
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(uint8) {
  let bin = '';
  for (let i = 0; i < uint8.length; i += 1) bin += String.fromCharCode(uint8[i]);
  return btoa(bin);
}

export function b64urlEncode(uint8) {
  return bytesToB64(uint8)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function b64urlDecode(s) {
  const padded = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return b64ToBytes(padded + pad);
}

export function bigIntToB64url(n, byteLen) {
  return b64urlEncode(bigIntToBytes(n, byteLen));
}

export function b64urlToBigInt(s) {
  return bytesToBigInt(b64urlDecode(s));
}

// ----- modular arithmetic -----------------------------------------------

export function modPow(base, exp, mod) {
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

export function gcd(a, b) {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y > 0n) {
    [x, y] = [y, x % y];
  }
  return x;
}

function egcd(a, b) {
  if (b === 0n) return [a, 1n, 0n];
  const [g, x1, y1] = egcd(b, a % b);
  return [g, y1, x1 - (a / b) * y1];
}

export function modInverse(a, m) {
  const aa = ((a % m) + m) % m;
  const [g, x] = egcd(aa, m);
  if (g !== 1n) throw new Error('modInverse: a and m are not coprime');
  return ((x % m) + m) % m;
}

// ----- secure randomness -----------------------------------------------

function getRandomBytes(byteLen) {
  // window.crypto.getRandomValues caps at 65536 bytes per call, more than
  // enough for our needs.
  const out = new Uint8Array(byteLen);
  // globalThis works in both browsers (window) and Node (global).
  globalThis.crypto.getRandomValues(out);
  return out;
}

export function randomCoprime(n) {
  const byteLen = Math.ceil(n.toString(2).length / 8);
  for (let i = 0; i < 1024; i += 1) {
    const buf = getRandomBytes(byteLen);
    const r = bytesToBigInt(buf) % n;
    if (r > 1n && gcd(r, n) === 1n) return r;
  }
  throw new Error('randomCoprime: failed after 1024 attempts');
}

export function randomSerial() {
  return getRandomBytes(32);
}

// ----- SHA-256 ----------------------------------------------------------

// Async because Web Crypto's digest is async. Returns a BigInt.
export async function sha256AsBigInt(uint8, n) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', uint8);
  return bytesToBigInt(new Uint8Array(digest)) % n;
}

// ----- blinding / unblinding -------------------------------------------

// Build a fully blinded token ready to send to /api/donations/mint.
// Returns { serial: Uint8Array, blinder: bigint, blindedB64u: string }.
export async function blindSerial(n, e) {
  const serial = randomSerial();
  const m = await sha256AsBigInt(serial, n);
  const blinder = randomCoprime(n);
  const blinded = (m * modPow(blinder, e, n)) % n;
  return {
    serial,
    blinder,
    blindedB64u: bigIntToB64url(blinded),
  };
}

// Unblind a single signature. Takes the bank's b64url signature string
// and the blinder used at mint time. Returns the final sig as a BigInt.
export function unblindSig(signedBlindedB64u, blinder, n) {
  const sPrime = b64urlToBigInt(signedBlindedB64u);
  const rInv = modInverse(blinder, n);
  return (sPrime * rInv) % n;
}
