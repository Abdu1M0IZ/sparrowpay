// Transactions API service.
//
// SparrowPay donations are intercepted here and routed through the
// blind-signature mint+redeem flow exposed by donationApi.js. From the
// rest of the app's point of view, createTransaction's contract is
// unchanged: same arguments, same shape on the way back.

import { apiClient } from './apiClient.js';
import { donateAnonymously } from './donationApi.js';

export async function listTransactions(kind /* 'transaction' | 'donation' */) {
  const params = kind ? { kind } : {};
  const { data } = await apiClient.get('/transactions', { params });
  return data.items || data.data?.items || [];
}

export async function getTransaction(id) {
  const { data } = await apiClient.get(`/transactions/${encodeURIComponent(id)}`);
  return data.data || data;
}

export async function createTransaction({ kind, bankType, to, amount, pin }) {
  // SparrowPay donations: anonymizing flow. The orchestrator returns a
  // transaction-shaped object so the calling page sees the same response.
  if (kind === 'donation' && bankType === 'SparrowPay') {
    return donateAnonymously({ recipient: to, amount, pin });
  }

  // Everything else: existing direct call to /api/transactions.
  const { data } = await apiClient.post('/transactions', { kind, bankType, to, amount, pin });
  return data.data || data;
}
