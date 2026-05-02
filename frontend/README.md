# SparrowPay Frontend (React + Vite + React Router)

The SparrowPay frontend is a Vite-powered React 18 SPA that talks to the
Express backend over HTTP.

## Quick start

```bash
cd Src/frontend
cp .env.example .env       # set VITE_API_BASE_URL if backend isn't on localhost:5000
npm install
npm run dev                # http://localhost:5173
```

## Build

```bash
npm run build              # outputs to dist/
npm run preview            # serve dist/ locally
```

## Tests

```bash
npm test
```

Tests run in `vitest` with a `jsdom` environment. They use React Testing
Library and mock the API client with `vi.mock`.

## Structure

```
src/
  App.jsx                    # mounts the router only
  main.jsx                   # imports Bootstrap + app styles, sets up providers
  routes/
    AppRouter.jsx            # all React Router routes
    ProtectedRoute.jsx       # gates /app/* behind auth
  layouts/
    AppLayout.jsx            # bottom-nav phone-frame for protected pages
    AuthLayout.jsx           # gradient phone-frame for login/signup/forgot
  pages/                     # one file per route
  components/common/         # SparrowLogo, Modal, Pill, Alerts, BottomNav, …
  components/ui/             # button + input wrappers (legacy compatibility)
  context/AuthContext.jsx    # global auth state
  hooks/useAuth.js
  services/                  # apiClient, authApi, meApi, transactionApi, favoriteApi
  utils/format.js            # PK phone/CNIC formatters, parseAmount, formatCompactPKR
  styles/index.css           # tailwind directives
  styles/app.css             # global app styles + the phone-frame look
```

See `Report/SparrowPay_MERN_Setup_Deployment_Guide.docx` for full setup,
deployment, and troubleshooting instructions.
