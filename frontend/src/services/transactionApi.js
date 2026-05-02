// Transactions API service.

import { apiClient } from './apiClient.js';

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
  const { data } = await apiClient.post('/transactions', { kind, bankType, to, amount, pin });
  return data.data || data;
}
