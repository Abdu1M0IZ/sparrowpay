// Smoke tests for auth pages: render and validate.

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LoginPage from '../pages/LoginPage.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';

// Stub the network layer so tests never make real HTTP calls.
vi.mock('../services/apiClient.js', async () => {
  const actual = await vi.importActual('../services/apiClient.js');
  return {
    ...actual,
    apiClient: {
      get: vi.fn().mockRejectedValue(new Error('not authed')),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  };
});

beforeEach(() => {
  localStorage.clear();
});

function renderWithProviders(ui) {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={ui} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  test('renders username and password fields', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByPlaceholderText(/username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  test('shows validation error when fields empty', async () => {
    renderWithProviders(<LoginPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/please enter your username and password/i)).toBeInTheDocument();
  });
});
