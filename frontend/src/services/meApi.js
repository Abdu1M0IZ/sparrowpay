// /api/me service.

import { apiClient } from './apiClient.js';

export async function fetchMe() {
  const { data } = await apiClient.get('/me');
  // The backend exposes fields both at the top level and inside `data` for
  // backward-compatibility. We normalise to a single shape.
  return data.data || data;
}

export async function updateProfile({ fullName, phone }) {
  const body = {};
  if (typeof fullName === 'string') body.fullName = fullName;
  if (typeof phone === 'string' && phone) body.phone = phone;
  const { data } = await apiClient.patch('/me/profile', body);
  return data.data || data;
}

export async function changePassword({ currentPassword, newPassword, confirmPassword }) {
  const { data } = await apiClient.patch('/me/password', {
    currentPassword, newPassword, confirmPassword,
  });
  return data;
}

export async function changePin({ currentPin, newPin, confirmPin }) {
  const { data } = await apiClient.patch('/me/pin', { currentPin, newPin, confirmPin });
  return data;
}
