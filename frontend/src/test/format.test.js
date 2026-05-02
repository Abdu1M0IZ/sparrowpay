// Pure-function tests for utils/format helpers.

import { describe, test, expect } from 'vitest';
import {
  formatPkPhone, formatPkCnic, parseAmount, formatCompactPKR,
  PK_PHONE_RE, PK_CNIC_RE,
} from '../utils/format.js';

describe('formatPkPhone', () => {
  test('inserts dash after 4 digits', () => {
    expect(formatPkPhone('03001234567')).toBe('0300-1234567');
    expect(formatPkPhone('0300-1234567')).toBe('0300-1234567');
  });
  test('drops non-digits', () => {
    expect(formatPkPhone('abc0300def1234567')).toBe('0300-1234567');
  });
  test('produces a value matching PK_PHONE_RE for valid input', () => {
    expect(PK_PHONE_RE.test(formatPkPhone('03011234567'))).toBe(true);
  });
});

describe('formatPkCnic', () => {
  test('formats with two dashes', () => {
    expect(formatPkCnic('3520212345671')).toBe('35202-1234567-1');
  });
  test('matches PK_CNIC_RE', () => {
    expect(PK_CNIC_RE.test('35202-1234567-1')).toBe(true);
  });
});

describe('parseAmount', () => {
  test('parses numbers and strings', () => {
    expect(parseAmount('1,234.50')).toBe(1234.5);
    expect(parseAmount('abc')).toBe(0);
    expect(parseAmount(0)).toBe(0);
  });
});

describe('formatCompactPKR', () => {
  test('plain number under 10k', () => {
    expect(formatCompactPKR(9999)).toBe('9,999');
  });
  test('10k+ uses k+', () => {
    expect(formatCompactPKR(15000)).toMatch(/k\+/);
  });
  test('1m+ uses M+', () => {
    expect(formatCompactPKR(2_500_000)).toMatch(/M\+/);
  });
});
