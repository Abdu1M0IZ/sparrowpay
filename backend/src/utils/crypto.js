// Optional AES-256-GCM field encryption for sensitive PII (phone, CNIC).
//
// If MASTER_ENC_KEY is provided as a base64-encoded 32-byte key, fields will be
// encrypted at rest with a per-record nonce. Each ciphertext is stored as the
// string:  v1:<nonceB64>:<ciphertextB64>:<tagB64>
//
// If MASTER_ENC_KEY is NOT set, the helpers act as a passthrough (return the
// plaintext). This keeps local development simple while still allowing prod
// deployments to opt in to encryption.

const crypto = require('crypto');
const env = require('../config/env');

let key = null;
if (env.masterEncKeyB64) {
  try {
    const buf = Buffer.from(env.masterEncKeyB64, 'base64');
    if (buf.length !== 32) {
      // eslint-disable-next-line no-console
      console.warn('[crypto] MASTER_ENC_KEY is not 32 bytes after base64 decode; encryption disabled.');
    } else {
      key = buf;
    }
  } catch {
    // eslint-disable-next-line no-console
    console.warn('[crypto] MASTER_ENC_KEY could not be decoded; encryption disabled.');
  }
}

const ENABLED = key !== null;

function encryptField(plaintext) {
  if (plaintext == null) return plaintext;
  if (!ENABLED) return String(plaintext);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${ct.toString('base64')}:${tag.toString('base64')}`;
}

function decryptField(stored) {
  if (stored == null) return stored;
  const s = String(stored);
  if (!s.startsWith('v1:')) return s; // plaintext / legacy

  if (!ENABLED) {
    // We have ciphertext but no key. We can't decrypt; return a placeholder
    // rather than crashing the response.
    return '[encrypted]';
  }

  try {
    const [, ivB64, ctB64, tagB64] = s.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const ct = Buffer.from(ctB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString('utf8');
  } catch {
    return '[decryption error]';
  }
}

module.exports = {
  encryptField,
  decryptField,
  ENABLED,
};
