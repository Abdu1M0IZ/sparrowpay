// Auth API service. Each function returns the parsed response body.

import { apiClient } from './apiClient.js';

export async function login(username, password) {
  const { data } = await apiClient.post('/auth/login', { username, password });
  return data;
}

export async function signup(payload) {
  // payload: { fullName, username, password, phone, cnic, pin }
  const { data } = await apiClient.post('/auth/signup', payload);
  return data;
}

export async function logout(refreshToken) {
  if (!refreshToken) return { success: true };
  const { data } = await apiClient.post('/auth/logout', { refreshToken, refresh_token: refreshToken });
  return data;
}

export async function checkUsername(username) {
  const { data } = await apiClient.get('/auth/check-username', { params: { username } });
  return data; // { success, available, taken }
}

export async function resetPasswordByPin({ username, pin, newPassword, confirmPassword }) {
  const { data } = await apiClient.post('/auth/reset-password-by-pin', {
    username, pin, newPassword, confirmPassword,
  });
  return data;
}

export async function forgotPin({ username, password, newPin, confirmPin }) {
  const { data } = await apiClient.post('/auth/forgot-pin', {
    username, password, newPin, confirmPin,
  });
  return data;
}
