// Unit tests for the donor-side blind-signature math.
//
// These don't need a real RSA key - the math is identical for any
// (n, e, d) triple where ed ≡ 1 (mod λ(n)). Using a 16-bit toy modulus
// keeps the test fast and the values trivially auditable.

import { describe, test, expect } from 'vitest';
import {
  bytesToHex, hexToBytes,
  bytesToBigInt, bigIntToBytes,
  b64urlEncode, b64urlDecode,
  bigIntToB64url, b64urlToBigInt,
  modPow, modInverse, gcd,
  randomCoprime,
} from '../utils/blindSig.js';

describe('blindSig - byte conversions', () => {
  test('hex round trip', () => {
    const bytes = new Uint8Array([0x00, 0xff, 0x10, 0xab, 0xcd]);
    const hex = bytesToHex(bytes);
    expect(hex).toBe('00ff10abcd');
    const back = hexToBytes(hex);
    expect(Array.from(back)).toEqual(Array.from(bytes));
  });

  test('bigint round trip with explicit byte length pads correctly', () => {
    const n = 0x010203n;
    const bytes = bigIntToBytes(n, 8);
    expect(bytes.length).toBe(8);
    expect(Array.from(bytes)).toEqual([0, 0, 0, 0, 0, 1, 2, 3]);
    expect(bytesToBigInt(bytes)).toBe(n);
  });

  test('b64url round trip', () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0xfe, 0x00, 0x01]);
    const enc = b64urlEncode(bytes);
    expect(enc).not.toMatch(/[+/=]/); // url-safe, unpadded
    const dec = b64urlDecode(enc);
    expect(Array.from(dec)).toEqual(Array.from(bytes));
  });

  test('bigint b64url round trip', () => {
    const n = BigInt('0xdeadbeefcafef00d1234567890abcdef');
    const enc = bigIntToB64url(n);
    expect(b64urlToBigInt(enc)).toBe(n);
  });
});

describe('blindSig - modular arithmetic', () => {
  test('modPow base cases', () => {
    expect(modPow(2n, 10n, 1000n)).toBe(24n); // 1024 mod 1000
    expect(modPow(7n, 0n, 13n)).toBe(1n);
    expect(modPow(0n, 5n, 17n)).toBe(0n);
  });

  test('modPow matches Fermat little theorem (a^(p-1) ≡ 1 mod p for prime p)', () => {
    const p = 257n; // prime
    for (const a of [2n, 3n, 5n, 250n]) {
      expect(modPow(a, p - 1n, p)).toBe(1n);
    }
  });

  test('gcd and modInverse', () => {
    expect(gcd(12n, 18n)).toBe(6n);
    expect(gcd(17n, 31n)).toBe(1n); // coprime
    expect(modInverse(3n, 11n)).toBe(4n); // 3*4 = 12 ≡ 1 (mod 11)
    const r = 12345n;
    const m = 1000003n;
    const ri = modInverse(r, m);
    expect((r * ri) % m).toBe(1n);
  });

  test('modInverse throws when a and m are not coprime', () => {
    expect(() => modInverse(6n, 9n)).toThrow();
  });
});

describe('blindSig - full Chaum round trip with toy RSA', () => {
  // Toy RSA: p=11, q=13, n=143, phi=120, e=7, d=103
  const n = 143n;
  const e = 7n;
  const d = 103n;

  test('blind, sign, unblind, verify', () => {
    // The "message" stands in for SHA-256(serial) reduced mod n. We pick
    // a fixed value here so the test is fully deterministic.
    const m = 42n;

    // Donor blinds with a coprime r
    const r = 5n; // gcd(5, 143) = 1
    expect(gcd(r, n)).toBe(1n);
    const blinded = (m * modPow(r, e, n)) % n;

    // Bank "signs" by raising to d
    const signedBlinded = modPow(blinded, d, n);

    // Donor unblinds
    const rInv = modInverse(r, n);
    const sig = (signedBlinded * rInv) % n;

    // Recipient verifies: sig^e mod n must equal m
    expect(modPow(sig, e, n)).toBe(m);
  });

  test('different blinders produce different blinded values for the same m', () => {
    const m = 42n;
    const r1 = 5n;
    const r2 = 9n;
    const b1 = (m * modPow(r1, e, n)) % n;
    const b2 = (m * modPow(r2, e, n)) % n;
    expect(b1).not.toBe(b2);
  });
});

describe('blindSig - randomCoprime', () => {
  test('returns a value in [2, n-1] coprime to n', () => {
    const n = 143n; // 11 * 13
    for (let i = 0; i < 20; i += 1) {
      const r = randomCoprime(n);
      expect(r > 1n).toBe(true);
      expect(r < n).toBe(true);
      expect(gcd(r, n)).toBe(1n);
    }
  });
});
