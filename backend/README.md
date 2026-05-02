# SparrowPay Backend (Express + MongoDB)

This is the Node.js / Express / MongoDB backend for the SparrowPay MERN app.

## Quick start

```bash
cd Src/backend
cp .env.example .env       # edit values - MongoDB URI, JWT secrets
npm install
npm run dev                # auto-restart with nodemon
# or
npm start                  # plain node
```

The server listens on `http://localhost:5000` by default (configurable via
`PORT` in `.env`).

Health check: `GET http://localhost:5000/api/health`

## Tests

```bash
npm test
```

Tests use `mongodb-memory-server`, so no live database is required.

## API surface

```
GET    /api/health
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
GET    /api/auth/check-username?username=...
POST   /api/auth/reset-password-by-pin
POST   /api/auth/forgot-pin

GET    /api/me
PATCH  /api/me/profile
PATCH  /api/me/password
PATCH  /api/me/pin
POST   /api/me/change-pin       (legacy alias)
POST   /api/me/signing-key

GET    /api/transactions?kind=transaction|donation
GET    /api/transactions/:id
POST   /api/transactions

GET    /api/favorites
POST   /api/favorites
POST   /api/favorites/toggle
GET    /api/favorites/check?name=...&accountType=...
DELETE /api/favorites/:id

GET    /api/donations/bank-key
POST   /api/donations/mint
POST   /api/donations/redeem
```

See `Report/SparrowPay_MERN_Setup_Deployment_Guide.docx` for full setup,
deployment, and troubleshooting instructions.
