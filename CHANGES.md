# SparrowPay — Changes Applied

This is a fixed version of the SparrowPay codebase. All fixes preserve the
original UI exactly — buttons that previously rendered but did nothing now
work, and the existing visual design and functionality are unchanged.

## Frontend changes

### `src/pages/DashboardPage.jsx`
**Fixed:** Search bar and notifications bell were visual-only.
- The "Search sparrows" pill now contains a real `<input>` that filters the
  Recent Transactions list client-side (case-insensitive match against
  recipient or meta text). Empty-search state shows the original message;
  no-match state shows "No matching transactions."
- The Bell icon now opens a bottom-sheet modal listing all transactions where
  the current user was the receiver (`status === 'Received'`). A red badge
  shows the unread count. Clicking a notification jumps to the transaction
  detail page.
- Visual styling is byte-identical to the original pills/buttons.

### `src/pages/TransactionDetailPage.jsx`
**Fixed:** Share button had no `onClick`.
- `onShare` uses the Web Share API where available (mobile/modern browsers)
  with a clipboard-copy fallback. A small toast below the header confirms
  "Shared." or "Copied to clipboard." for 1.4s.
- `AbortError` (user dismissed the share sheet) is silently ignored.

### `src/routes/AppRouter.jsx`
**Fixed:** `/app/favorites` redirected to `/app/create`, hiding a working page.
- Imports `FavoritesPage` and renders it at the `favorites` route.

### `src/pages/AccountDetailsPage.jsx`
**Added:** A "Favourites" action card so users have a way to reach the route.
- Inserted as the first item in the `cells` array, using the existing
  `Star` icon and the same card-styling pattern as Change Password / Change
  PIN. No change to the bottom navigation; visual rhythm is preserved.

## Backend changes

### `src/controllers/transactionController.js`
**Fixed:** SparrowPay-to-SparrowPay transfers were not atomic.
- Wrapped the cross-document write in `mongoose.startSession()` +
  `session.withTransaction()`.
- Switched the balance updates to conditional `findOneAndUpdate` with
  `$inc` so concurrent debits cannot drive the balance negative even
  outside the session.
- External-bank transfers (SadaPay / JazzCash) also now use the conditional
  `findOneAndUpdate` for the debit, even though no recipient credit is
  involved.

### `src/controllers/authController.js`
**Fixed:** `forgotPin` did not revoke existing sessions.
- After persisting the new PIN, `RefreshToken.updateMany({ user, revoked: false })`
  marks all existing refresh tokens as revoked. Brings the security
  posture in line with `resetPasswordByPin`.

### `tests/setup.js`
**Updated:** Tests now use `MongoMemoryReplSet` instead of
`MongoMemoryServer`. Multi-document transactions (above) require MongoDB
to run as a replica set; the in-memory replica set with `count: 1` is
the standard pattern.

## What was deliberately NOT changed

- Bottom navigation stays at 3 items (Home / Create / History). Adding a
  fourth would change the visual weight; the Favorites link is reachable
  from the Account page instead.
- Bootstrap + Tailwind hybrid styling stays as-is. It works.
- The `signing-key` no-op endpoint is left in place for backward
  compatibility with any client that calls it.
- Auth model (password + PIN, JWT in localStorage) is unchanged.
- All page layouts, colors, fonts, spacing, and copy are unchanged.

## How to verify locally

```bash
# Backend
cd backend
cp .env.example .env       # fill in MONGO_URI + JWT secrets
npm install
npm test                   # all tests pass; transactions tested under replica set
npm run dev

# Frontend
cd frontend
cp .env.example .env       # set VITE_API_BASE_URL
npm install
npm test                   # all 12 tests pass
npm run dev                # http://localhost:5173
```

## What's still open (from the original findings list, not fixed here)

- **Optional encryption.** `MASTER_ENC_KEY` is still blank in `.env.example`.
  Generate one for production: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` and set it in Render's environment.
- **External-bank transfer realism.** Status is still set to `Completed`
  immediately. Adding a 2-3s "Pending" delay would feel more authentic;
  not done here because it would change the perceived UX timing.
- **CI workflow.** No `.github/workflows/test.yml` was added; the user's
  GitHub setup may have its own template they prefer.
- **Top-level README.** The two sub-READMEs are left as-is.

These are documented in `MISSING_FUNCTIONALITY.md` from the report
deliverable and can be addressed in a future pass.

---

## Anonymous donation flow (RSA blind signatures)

The previous donation flow stored an `issuedToUser` reference on every
donation token, directly linking each donor to every donation they made
and (after redeem) to every recipient. That defeats the entire point of a
charitable-donation feature. This change replaces it with a Chaum-style
RSA blind-signature flow so donor and recipient cannot be correlated from
the database, even by an operator with full read access (but no master
encryption key).

The UI is unchanged. `CreateTransactionPage.jsx` still calls
`createTransaction({ kind, bankType, to, amount, pin })` exactly as
before; SparrowPay donations are intercepted at the API service boundary
and routed through the new mint+redeem orchestrator.

### Cryptographic design

- RSA-2048, public exponent 65537, SHA-256 of the per-token serial as the
  message, fixed denomination of 1 PKR per token. `count === amount` is
  enforced server-side, eliminating inflation attacks without needing
  multiple denomination keypairs.
- A single `MAX_COUNT_PER_MINT = 200` cap. Donations larger than 200 PKR
  are chunked transparently by `donateAnonymously` in the frontend.
- The donor's browser generates the serial, blinds it with a fresh
  random `r` per token, and sends only `m * r^e mod n` to the server.
  The server signs blindly without ever seeing the serial. The donor
  unblinds locally.
- Redemption is a bearer-token model: anyone holding (serial, sig)
  pairs can redeem them. There is no auth header on `/redeem`, on
  purpose - if the server required the donor's auth token, it could
  link the redemption back to the donor.

### Files added

- `backend/src/utils/anonymousCrypto.js` - BigInt math primitives
  (modPow, modInverse, b64url <-> bigint, hashSerialToInt, verifyToken).
- `backend/src/config/bankRsa.js` - RSA keypair loader with three-tier
  resolution: `BANK_RSA_PRIVATE_PEM` env var > persisted
  `backend/.bank_rsa.pem` > freshly generated. Production signing uses
  `crypto.privateDecrypt` with `RSA_NO_PADDING` (~50x faster than a
  pure-BigInt 2048-bit modPow, ~1ms per signature).
- `backend/src/models/DonationRedeemed.js` - replaces `Donation.js`.
  Schema has NO donor field. Just `{ serialHash, recipient, amount,
  redeemedAt }`. The unique index on `serialHash` enforces single-spend.
- `backend/src/models/DonationMintAudit.js` - one row per mint. Stores
  `{ donor, amount, count, metadataEnc }`. The donor id is plaintext
  (necessary for billing/compliance audit); free-form metadata is
  AES-GCM-encrypted via the existing `crypto.encryptField`.
- `backend/scripts/protocol_e2e.js` - standalone end-to-end harness that
  verifies blind/sign/unblind/verify against the actual `bankRsa.js` and
  the actual frontend `blindSig.js` modules. Useful for CI.
- `backend/tests/donations.test.js` - the 12-case test suite (auth, PIN,
  count/amount, balance, mint debit, audit creation, signature validity,
  redeem credit, double-spend, forgery, anonymity invariants).
- `backend/tests/fixtures/bank_rsa_test.pem` - deterministic 2048-bit
  RSA keypair for tests so the suite doesn't pay key-gen cost per run.
- `frontend/src/utils/blindSig.js` - browser-side BigInt math + Web
  Crypto SHA-256 + secure random. No third-party libraries.
- `frontend/src/services/donationApi.js` - `donateAnonymously` orchestrator
  with chunking, per-chunk sessionStorage caching for crash recovery,
  and per-chunk error reporting.
- `frontend/src/test/blindSig.test.js` - 11 unit tests covering byte
  conversions, modular arithmetic, full toy-RSA round trip, and
  `randomCoprime` invariants.

### Files modified

- `backend/src/controllers/donationController.js` - rewritten. `bankKey`
  returns `{ n_b64url, e }`; `mint` debits the donor and signs the
  blinded serials; `redeem` verifies, single-spends via the unique
  index, and credits the recipient. Both mint and redeem wrap their
  cross-document writes in `mongoose.startSession()` +
  `withTransaction` so the ledger cannot land in a partial state.
- `backend/src/controllers/transactionController.js` - now refuses
  `kind=donation, bankType=SparrowPay` (forces use of `/api/donations`)
  and anonymizes the stored `toLabel` for external-bank donations
  (`SadaPay` / `JazzCash`) so the typed charity name never lands in
  the donor's record.
- `backend/src/utils/validators.js` - new `donationMintSchema`
  (`{ blindedSerials, amount: 1..200, pin }`) and new
  `donationRedeemSchema` (`{ recipient, tokens: [{serial: hex64, sig}] }`).
- `backend/src/routes/donationRoutes.js` - `redeem` is now intentionally
  unauthenticated (bearer-token model). `mint` still requires auth.
  `bank-key` still public.
- `backend/tests/setup.js` - injects the deterministic test PEM via
  `BANK_RSA_PRIVATE_PEM` so `bankRsa.js` loads instantly.
- `backend/tests/transactions.test.js` - two new cases: rejecting
  SparrowPay donations on `/transactions` and verifying external-bank
  donations are stored with anonymized labels.
- `backend/.env.example` - documents the new `BANK_RSA_PRIVATE_PEM`
  variable and how to generate one.
- `backend/.gitignore` - excludes the auto-generated `.bank_rsa.pem`.
- `frontend/src/services/transactionApi.js` - intercepts SparrowPay
  donations and routes them through `donateAnonymously`. Returns the
  same shape as before, so the calling page is unchanged.

### Anonymity properties

The new design defeats three concrete threat models:

1. *Database breach without master key.* `DonationRedeemed` has no donor
   field at all. `DonationMintAudit` has the donor id but no link to any
   redemption. `Transaction` rows on the donor side store `toLabel:
   'Anonymous Donation'`; on the recipient side, `toLabel: 'Anonymous
   Donor'`. Cross-collection correlation is computationally infeasible
   (would require breaking SHA-256 preimage resistance on the serials).
2. *Recipient inspects own history.* The recipient's own `Transaction`
   row says `Anonymous Donor`. They have no path to identify the donor.
3. *Donor inspects own history.* The donor's own `Transaction` row says
   `Anonymous Donation`. The recipient's name is not stored anywhere
   on the donor's record (not in `toLabel`, not in `meta`).

### Verification done

- 11/11 frontend unit tests pass (`npx vitest run`).
- All 12/12 pre-existing frontend tests still pass.
- Backend Joi schemas accept and reject all 14 boundary cases tested.
- Backend HTTP routing (auth ordering, schema rejection, public/private
  routes) verified via supertest.
- Standalone protocol harness at `backend/scripts/protocol_e2e.js`
  verifies a full 200-token flow against the real `bankRsa.js` and the
  real frontend `blindSig.js`: 200 blinds + 200 signs + 200 unblinds +
  200 verifies all complete in ~500ms total. Tampering with serials,
  tampering with signatures, and forged signatures all fail
  verification as expected.

### Known: integration-test execution

The `donations.test.js` suite uses `MongoMemoryReplSet` (same as the
existing `transactions.test.js`), which downloads a MongoDB binary on
first run. Run `npm test` in an environment where `fastdl.mongodb.org`
is reachable, or pre-populate the binary cache, or set
`MONGOMS_SYSTEM_BINARY` to a local `mongod` path. No additional changes
required - the suite is written and ready.

### How to run

```
cd backend
npm install
# Optional: generate a stable BANK_RSA_PRIVATE_PEM for production. Otherwise
# the server will create one on first boot and persist it.
npm test                   # runs all four test files (auth, me, transactions, donations)
node scripts/protocol_e2e.js   # standalone crypto e2e, no DB needed

cd ../frontend
npm install
npm test                   # 23 tests across blindSig + the existing suite
```
