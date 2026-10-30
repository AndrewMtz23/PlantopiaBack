# Plantopia Backend — Sprint1

Express + PostgreSQL 17 + Prisma. Node 22.21.0 (`.nvmrc`).

## Install a NEW database

Create `.env` from `.env.example`; set DATABASE_URL and a private random JWT_SECRET. Never reuse test credentials for real data.

```text
npm ci
npx prisma validate
npx prisma generate
npx prisma migrate deploy
npm start
```

The server does not repair sequences on startup. After a controlled import, with application writers stopped, `npm run db:reconcile` reconciles them and exits nonzero on failure.

## Existing PostgreSQL database

Do not blindly run the baseline against an existing database. Back up and restore into an isolated copy first. Compare the existing schema to `202610290001_baseline/migration.sql`. Only when it matches, mark that baseline applied with `prisma migrate resolve --applied 202610290001_baseline`, then apply later migrations to the COPY and reconcile counts, totals and relations. Repeat the reviewed procedure on the valuable database only after explicit operational approval. `db push` is not the release workflow.

The integrity migration aborts transactionally for duplicate normalized email, monetary rounding/overflow, invalid quantities or orphan references. It never deletes or silently repairs those records. Diagnose and reconcile records before retrying; preserve the source backup. Old paid records remain paid until business reconciliation; legacy sales lacking inventory provenance cannot be auto-cancelled. New schema revokes old tokens missing tokenVersion; users log in again.

## MySQL import

`node migrate_data_mysql_to_pg.js --verify-only` compares a consistent read snapshot to PostgreSQL without importing. Without that flag it imports all expected tables in one target transaction, checks normalized content/IDs/counts and aborts on conflicts. MySQL source is read only. Configure DB_HOST/USER/PASSWORD/NAME and DATABASE_URL; stop target writers during import and sequence reconciliation. Money requiring rounding is rejected, not hidden by comparison. JSON/date/decimal values are normalized; unknown incompatible schema columns are errors. This workflow was checked with synthetic PostgreSQL fixtures, not the owner's live MySQL dataset.

## Tests

Use a separate local database whose name ends in `_test`. The suite truncates its synthetic tables and exercises migrations in an isolated schema. TEST_DATABASE_URL must not identify the same database as DATABASE_URL; omit DATABASE_URL for tests. No .env from another checkout is copied automatically.

PowerShell example for the disposable audit cluster:

```powershell
$env:TEST_DATABASE_URL='postgresql://sprint1@127.0.0.1:55432/plantopia_test'
npm test
```

Initialize this test DB with `prisma migrate deploy` first, using its URL temporarily as DATABASE_URL; unset it before tests. `npm run test:integration` selects integration tests. CI provisions PostgreSQL 17 and runs installation, schema validation, migrations, full tests and dependency audit.

## API contract

- Bearer JWT identity is checked against current account status, role and tokenVersion.
- Cart/wishlist/payment reads and writes are scoped to the owner, including legacy aliases.
- GET `/carrito/cotizacion` returns items, decimal-string totals and quoteHash.
- POST `/procesarCompra` requires `Idempotency-Key`, quoteHash, metodo `efectivo`, and delivery address. The same key/payload returns the same order; conflicting reuse or changed quote returns 409. Subtotal and usuario supplied by a client are not authorities.
- New cash orders are pending. POST `/pagos/:id/confirmar-efectivo` is admin-only, audited and idempotent.
- Preparing/ready unpaid cash orders may be cancelled once. Paid/shipped and legacy orders without provenance require separate manual reconciliation.
- Errors use `{ "error": { "code": "...", "message": "..." } }` with internal DB details concealed.
- Amounts use decimal arithmetic and two decimal places. Current MXN tax/shipping constants preserve the old technical assumptions; commercial/fiscal approval is still needed before real sales.

## Deployment constraints

The auth rate limiter is per process (20 attempts / 15 minutes by default). Configure a shared store and trusted-proxy policy before multiple replicas; do not assume a global limit. Plan durable uploads, HTTPS, origin allowlist, monitoring, backups and restoration before publication. No production database migration or deployment is performed by CI. Frontend legacy dependency exceptions are documented in its SECURITY.md.
