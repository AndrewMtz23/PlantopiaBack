# Plantopia · Backend

**The API behind Plantopia's plant store and management platform.**

Plantopia connects a customer storefront with the tools needed to manage products, branch inventory, orders and deliveries. This repository contains the Node.js API, PostgreSQL data model and business logic shared by those experiences.

[![Backend CI](https://github.com/AndrewMtz23/PlantopiaBack/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/AndrewMtz23/PlantopiaBack/actions/workflows/ci.yml)

[Frontend repository](https://github.com/AndrewMtz23/PlantopiaFront) · [Getting started](#getting-started) · [API overview](#api-overview) · [Testing](#testing)

## Features

- **Accounts and access:** registration, authentication, profiles, password changes and role-based permissions.
- **Catalog:** products, categories, suppliers and product images.
- **Inventory:** stock availability and inventory management across branches.
- **Shopping:** customer-owned carts, wishlists and server-calculated order quotes.
- **Checkout:** transactional order creation, stock updates and idempotent submissions.
- **Payments and delivery:** pending cash orders, collection confirmation, preparation, courier assignment and delivery tracking.
- **Store operations:** activity logs and sales metrics based on collected payments.

The application uses **PostgreSQL**. MySQL utilities are retained for importing legacy data; MySQL is not required to run the API.

## Technology

| Area | Stack |
| --- | --- |
| Runtime | Node.js 22.21.0 |
| HTTP API | Express 4 |
| Database | PostgreSQL 17 |
| Data access | Prisma 7 with the PostgreSQL driver adapter |
| Authentication | JWT and bcrypt |
| Monetary calculations | Decimal.js |
| Tests | Node.js test runner and Supertest |
| CI | GitHub Actions |

## Getting started

### 1. Install

Use the Node.js version in [`.nvmrc`](.nvmrc) and a running PostgreSQL instance.

~~~bash
git clone https://github.com/AndrewMtz23/PlantopiaBack.git
cd PlantopiaBack
npm ci
~~~

### 2. Configure

Copy [`.env.example`](.env.example) to `.env`. Create an empty `plantopia` database and configure its connection:

~~~dotenv
PORT=3001
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/plantopia
JWT_SECRET=replace-with-your-own-long-random-secret
JWT_EXPIRES_IN=8h
~~~

Replace all placeholders with your own values. `.env` is excluded from Git.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Required PostgreSQL connection string |
| `JWT_SECRET` | Required token-signing secret |
| `PORT` | HTTP port; default `3001` |
| `JWT_EXPIRES_IN` | Token lifetime; default `8h` |
| `PUBLIC_PATH` / `UPLOADS_PATH` | Optional overrides for asset and upload directories |
| `AUTH_RATE_LIMIT` | Authentication requests per IP per 15 minutes; default `20` |
| `ALLOWED_ORIGINS` | Comma-separated frontend origins; required in production (HTTPS only) |
| `TRUST_PROXY` | `false` by default; explicit trusted proxy IPs or CIDRs only |

Development defaults allow `http://localhost:3000` and `http://127.0.0.1:3000`.
The JWT secret must contain at least 32 bytes. Invalid configuration prevents startup;
configuration errors identify the variable without printing its value. JSON requests
are limited to 100 KiB. API responses include a server-generated `X-Request-Id`.

### 3. Initialize and run

For a **new, empty database**:

~~~bash
npx prisma validate
npx prisma generate
npx prisma migrate deploy
npm run dev
~~~

The API starts at `http://localhost:3001`. Nodemon restarts it when source files change. For a populated database, follow [Existing databases](#existing-databases) first.

## Architecture

~~~text
prisma/             Data model and versioned migrations
src/
  config/           Database client configuration
  controllers/      HTTP request and response handling
  middleware/       Authentication, authorization, errors and uploads
  repositories/     Data access helpers
  routes/           Endpoint definitions
  services/         Account, catalog, checkout and payment logic
  db/               Import and data normalization utilities
  utils/            Shared application helpers
scripts/            Maintenance commands
tests/              Unit and PostgreSQL integration tests
index.js            Server startup and shutdown
~~~

The backend follows a controller/service/repository structure. Checkout and payment transitions use database transactions. Protected operations validate the account's current role, status and resource ownership on the server.

## API overview

Protected endpoints accept `Authorization: Bearer <token>`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/auth/register` | Create a customer account |
| `POST` | `/auth/login` | Sign in |
| `GET` | `/auth/me` | Retrieve the authenticated session |
| `GET` | `/obtenerProductos` | Browse the public catalog |
| `GET` | `/perfil` | Retrieve the current user's profile |
| `GET` | `/carrito/cotizacion` | Get authoritative cart totals and quote fingerprint |
| `POST` | `/procesarCompra` | Submit an order with an `Idempotency-Key` header |
| `POST` | `/pagos/:id/confirmar-efectivo` | Confirm cash collection as an administrator |
| `GET` | `/health` | Check HTTP service availability |
| `GET` | `/ready` | Check database connectivity |

See [`src/routes`](src/routes) for all endpoint definitions and [`CheckoutService.js`](src/services/CheckoutService.js) for the checkout contract.

### Orders and payments

The API calculates prices, tax, shipping and totals with decimal arithmetic. Quote fingerprints detect changes before checkout; idempotency keys allow safe retries without creating duplicate orders.

Cash orders begin as **pending payment**. An administrator confirms collection separately. Eligible unpaid orders can be cancelled with inventory restoration. Online payment processing is not enabled in this version.

## Development commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start development mode with nodemon |
| `npm start` | Start the API without a file watcher |
| `npm test` | Run all tests |
| `npm run test:integration` | Run database integration tests |
| `npm run db:reconcile` | Reconcile sequences after a controlled import |
| `npx prisma migrate deploy` | Apply pending migrations |
| `npm audit --audit-level=high` | Check dependency advisories |

## Testing

Use a dedicated PostgreSQL database whose name ends in `_test`. **Integration tests delete fixture data: never use a database containing valuable records.**

After creating `plantopia_test`, run this in a separate PowerShell terminal:

~~~powershell
$env:TEST_DATABASE_URL = 'postgresql://USER:PASSWORD@localhost:5432/plantopia_test'
$env:DATABASE_URL = $env:TEST_DATABASE_URL
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { throw 'Test database migration failed.' }
Remove-Item Env:DATABASE_URL
npm test
~~~

Tests cover authorization, session revocation, pricing, checkout concurrency, duplicate requests, payment transitions and migration integrity. GitHub Actions provisions PostgreSQL and runs installation, schema validation, migrations, tests and dependency checks.

## Existing databases

Before adopting an existing PostgreSQL database, back it up and restore it into an isolated copy. If it has no Prisma migration history, compare its schema with the [baseline migration](prisma/migrations/202610290001_baseline/migration.sql). Mark the baseline as applied only when the schemas match. Test subsequent migrations on the copy before applying the reviewed procedure to the original with its owner's approval.

For databases with migration history, use `prisma migrate deploy` for pending migrations; do not reapply the baseline. Avoid `db push` or database resets as a deployment procedure. Integrity migrations reject incompatible records rather than silently rounding money or deleting data.

Legacy imports use `migrate_data_mysql_to_pg.js`; `--verify-only` compares MySQL and PostgreSQL without importing. Configure the `DB_*` variables only for these utilities. Stop application writes during imports and sequence reconciliation.

## Deployment

Plantopia is under active development. Production requires HTTPS, restricted origins, durable image storage, protected secrets and tested backups. Authentication throttling is per process; multiple replicas require a shared rate-limit store. Validate tax, shipping and delivery rules against the actual business before accepting live orders.

CI validates the codebase. It does not deploy the application or migrate production databases automatically.

### Session scope and legacy accounts

Tokens use HS256 with `JWT_ISSUER=plantopia-api` and `JWT_AUDIENCE=plantopia-web` by default. Older unscoped tokens require a new login. Role or status changes revoke existing sessions, and at least one active administrator must remain.

Run `node scripts/checkLegacyPasswords.js` for a count-only password audit. Applying conversion requires a verified backup, an isolated rehearsal and explicit operational approval; the script documents its guarded `--apply` mode. It is resumable and does not print passwords or hashes. Login accepts bcrypt hashes only. Audit and convert any legacy database before switching it to this version.
