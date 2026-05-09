// All app routes. Matches the routing required by the refactor prompt.

import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute.jsx';
import AuthLayout from '../layouts/AuthLayout.jsx';
import AppLayout from '../layouts/AppLayout.jsx';

// Pages.
import LoginPage from '../pages/LoginPage.jsx';
import SignupPage from '../pages/SignupPage.jsx';
import ForgotPasswordPage from '../pages/ForgotPasswordPage.jsx';
import DashboardPage from '../pages/DashboardPage.jsx';
import CreateTransactionPage from '../pages/CreateTransactionPage.jsx';
import TransactionHistoryPage from '../pages/TransactionHistoryPage.jsx';
import TransactionDetailPage from '../pages/TransactionDetailPage.jsx';
import AccountDetailsPage from '../pages/AccountDetailsPage.jsx';
import ChangePasswordPage from '../pages/ChangePasswordPage.jsx';
import ChangePinPage from '../pages/ChangePinPage.jsx';
import ForgotPinPage from '../pages/ForgotPinPage.jsx';
import SupportPage from '../pages/SupportPage.jsx';
import FavoritesPage from '../pages/FavoritesPage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';

export default function AppRouter() {
  return (
    <Routes>
      {/* Public auth pages */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      {/* Protected app pages */}
      <Route
        path="/app"
        element={(
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        )}
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="create" element={<CreateTransactionPage />} />
        <Route path="history" element={<TransactionHistoryPage />} />
        <Route path="history/:transactionId" element={<TransactionDetailPage />} />
        <Route path="favorites" element={<FavoritesPage />} />
        <Route path="account" element={<AccountDetailsPage />} />
        <Route path="account/change-password" element={<ChangePasswordPage />} />
        <Route path="account/change-pin" element={<ChangePinPage />} />
        <Route path="account/forgot-pin" element={<ForgotPinPage />} />
        <Route path="support" element={<SupportPage />} />
      </Route>

      {/* Default + catch-all */}
      <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
