// Anonymous donation client.
//
// Public surface:
//   donateAnonymously({ recipient, amount, pin })
//
// Orchestration per chunk (chunks of up to MAX_PER_MINT = 200 PKR each):
//   1. GET  /api/donations/bank-key   - public RSA params
//   2. Build `count` blinded serials (count === amount for this chunk)
//   3. POST /api/donations/mint       - bank debits and signs the blinded values
//   4. Unblind locally to get (serial, sig) tokens
//   5. POST /api/donations/redeem     - recipient's account is credited
//
// The serials and unblinded signatures NEVER leave the donor's browser
// during step 3, and the donor's identity NEVER leaves the donor's browser
// during step 5. That's the whole game.
//
// On a network drop between mint and redeem we cache the unblinded tokens
// in sessionStorage so a subsequent page load can complete the redeem.
// Each chunk's tokens are stored under a fresh mint id so partial
// completions can resume cleanly.

import { apiClient } from './apiClient.js';
import {
  blindSerial, unblindSig, bytesToHex, bigIntToB64url,
  b64urlToBigInt,
} from '../utils/blindSig.js';

export const MAX_PER_MINT = 200;
const STORAGE_PREFIX = 'sp_donation_pending_';

export async function getBankKey() {
  const { data } = await apiClient.get('/donations/bank-key');
  const n = b64urlToBigInt(data.n_b64url);
  const eNumber = Number(data.e);
  const e = BigInt(eNumber);
  return { n, e, eNumber, raw: data };
}

async function buildChunkBlinds(n, e, count) {
  const serials = [];
  const blinders = [];
  const blindedSerials = [];
  for (let i = 0; i < count; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const { serial, blinder, blindedB64u } = await blindSerial(n, e);
    serials.push(serial);
    blinders.push(blinder);
    blindedSerials.push(blindedB64u);
  }
  return { serials, blinders, blindedSerials };
}

async function mintChunk({ blindedSerials, amount, pin }) {
  const { data } = await apiClient.post('/donations/mint', {
    blindedSerials, amount, pin,
  });
  return data;
}

async function redeemChunk({ tokens, recipient }) {
  const { data } = await apiClient.post('/donations/redeem', {
    tokens, recipient,
  });
  return data;
}

function unblindAll({ signatures, blinders, serials, n }) {
  const tokens = [];
  for (let i = 0; i < signatures.length; i += 1) {
    const sig = unblindSig(signatures[i], blinders[i], n);
    tokens.push({
      serial: bytesToHex(serials[i]),
      sig: bigIntToB64url(sig),
    });
  }
  return tokens;
}

function cachePendingRedeem(mintId, payload) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + mintId, JSON.stringify(payload));
  } catch {
    // Quota or unavailability - non-fatal; redeem still happens immediately.
  }
}

function clearPendingRedeem(mintId) {
  try {
    sessionStorage.removeItem(STORAGE_PREFIX + mintId);
  } catch {
    // Ignore.
  }
}

export function listPendingRedeems() {
  // Best-effort recovery on next page load; not currently wired into the
  // UI but useful for ad-hoc debugging.
  const out = [];
  try {
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        out.push({
          mintId: key.slice(STORAGE_PREFIX.length),
          payload: JSON.parse(sessionStorage.getItem(key) || 'null'),
        });
      }
    }
  } catch {
    // Ignore.
  }
  return out;
}

// donateAnonymously - the orchestrator.
//
// recipient: SparrowPay username string (charity / receiver).
// amount: positive integer PKR (fractions are floored).
// pin: donor's 4-digit PIN.
//
// Returns the *first* chunk's donor-side Transaction (in the same shape as
// /api/transactions returns) so the calling page can do its existing
// `navigate(/app/history/<id>)`.
export async function donateAnonymously({ recipient, amount, pin }) {
  const total = Math.max(0, Math.floor(Number(amount) || 0));
  if (total < 1) throw new Error('Amount must be a positive integer.');
  if (!recipient || !String(recipient).trim()) throw new Error('Recipient is required.');

  const { n, e, eNumber } = await getBankKey();

  const chunks = [];
  let remaining = total;
  while (remaining > 0) {
    const c = Math.min(MAX_PER_MINT, remaining);
    chunks.push(c);
    remaining -= c;
  }

  let firstTx = null;
  let totalRedeemed = 0;
  const errors = [];

  for (let ci = 0; ci < chunks.length; ci += 1) {
    const count = chunks[ci];
    // 1. Blind locally
    // eslint-disable-next-line no-await-in-loop
    const { serials, blinders, blindedSerials } = await buildChunkBlinds(n, e, count);

    // 2. Mint at the bank
    let mintData;
    try {
      // eslint-disable-next-line no-await-in-loop
      mintData = await mintChunk({ blindedSerials, amount: count, pin });
    } catch (err) {
      // If even the first chunk's mint fails, surface it. If a later chunk
      // fails, we still report partial success.
      errors.push({ chunk: ci, phase: 'mint', error: err });
      break;
    }

    if (firstTx == null && mintData && mintData.donorTransaction) {
      firstTx = mintData.donorTransaction;
    }

    // 3. Unblind locally
    const tokens = unblindAll({
      signatures: mintData.signatures,
      blinders,
      serials,
      n,
    });

    // 4. Cache against network failure between mint and redeem
    const mintId = (firstTx && firstTx.id ? firstTx.id : Date.now().toString())
      + ':' + ci;
    cachePendingRedeem(mintId, { tokens, recipient });

    // 5. Redeem
    try {
      // eslint-disable-next-line no-await-in-loop
      const redeemData = await redeemChunk({ tokens, recipient });
      totalRedeemed += Number(redeemData.creditedAmount || redeemData.credited_amount || 0);
      clearPendingRedeem(mintId);
    } catch (err) {
      errors.push({ chunk: ci, phase: 'redeem', error: err });
      // Tokens are still in sessionStorage for retry. Stop here so we don't
      // burn more chunks against a flapping network.
      break;
    }
  }

  // Produce a transaction-shaped object so CreateTransactionPage's
  // `navigate('/app/history/' + created.id)` keeps working without changes.
  if (!firstTx) {
    if (errors.length > 0) {
      const first = errors[0].error;
      throw first instanceof Error ? first : new Error('Donation failed.');
    }
    throw new Error('Donation failed: no transaction created.');
  }

  return {
    ...firstTx,
    amount: total,                  // show the user-facing total, not just the first chunk
    creditedAmount: totalRedeemed,
    chunkCount: chunks.length,
    partialFailure: errors.length > 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// Exposed for debugging / future "retry pending redeem" UI.
export const _internal = {
  buildChunkBlinds, mintChunk, redeemChunk, unblindAll,
  STORAGE_PREFIX, listPendingRedeems,
};
