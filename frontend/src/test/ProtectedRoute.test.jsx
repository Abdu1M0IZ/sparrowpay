// ProtectedRoute test - confirms unauthenticated users are redirected.

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../routes/ProtectedRoute.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';

vi.mock('../services/apiClient.js', async () => {
  const actual = await vi.importActual('../services/apiClient.js');
  return {
    ...actual,
    apiClient: {
      get: vi.fn().mockRejectedValue(new Error('not authed')),
      post: vi.fn(), patch: vi.fn(), delete: vi.fn(),
    },
  };
});

beforeEach(() => { localStorage.clear(); });

describe('ProtectedRoute', () => {
  test('redirects unauthenticated user to /login', () => {
    render(
      <MemoryRouter initialEntries={['/app/dashboard']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/app/dashboard"
              element={(
                <ProtectedRoute>
                  <div>Dashboard content</div>
                </ProtectedRoute>
              )}
            />
            <Route path="/login" element={<div>Login screen</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );
    expect(screen.getByText(/login screen/i)).toBeInTheDocument();
    expect(screen.queryByText(/dashboard content/i)).not.toBeInTheDocument();
  });
});
