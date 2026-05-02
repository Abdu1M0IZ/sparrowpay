// Favorites API service.

import { apiClient } from './apiClient.js';

export async function listFavorites() {
  const { data } = await apiClient.get('/favorites');
  return data.items || data.data?.items || [];
}

export async function addFavorite({ name, accountType }) {
  const { data } = await apiClient.post('/favorites', { name, accountType });
  return data.data || data;
}

export async function deleteFavorite(id) {
  const { data } = await apiClient.delete(`/favorites/${encodeURIComponent(id)}`);
  return data;
}

export async function toggleFavorite({ name, accountType }) {
  const { data } = await apiClient.post('/favorites/toggle', { name, accountType });
  return data; // { success, favorited, favorite }
}

export async function checkFavorite({ name, accountType }) {
  const { data } = await apiClient.get('/favorites/check', { params: { name, accountType } });
  return data;
}
