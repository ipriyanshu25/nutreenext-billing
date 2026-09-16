# NutreeNext Billing — PostgreSQL / Vercel Edition

NutreeNext Billing is a Next.js restaurant billing system with:

- Login protection before the dashboard or billing pages can be opened
- Dashboard for Today, Previous Day and Month
- Sales, GST, bills, average bill, expenses and profit/loss
- Payment breakdown and monthly sales graph
- Item management with selling price and cost price
- Generate Bill screen with search, category dropdown and checkout modal
- Optional GST billing with CGST + SGST split
- Daily bill numbering that restarts from 1 each business day
- Complete bill/item history
- 58 mm and 80 mm thermal receipt printing
- PostgreSQL persistence suitable for Vercel
- Idempotent menu synchronization: missing menu items are added and existing items are skipped

This version uses PostgreSQL and does not use SQLite or `better-sqlite3`.

## 1. Requirements

- Node.js 20.9 or newer
- A PostgreSQL database (Neon PostgreSQL works well with Vercel)

## 2. Environment variables

Copy `.env.example` to `.env.local` and set:

```env
DATABASE_URL="YOUR_POSTGRESQL_CONNECTION_STRING"
BUSINESS_TZ=Asia/Kolkata
AUTH_SECRET="A_LONG_RANDOM_SECRET"
```

Generate a secure `AUTH_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Never commit `.env.local` to GitHub.

For Vercel, add `DATABASE_URL`, `BUSINESS_TZ` and `AUTH_SECRET` in **Project → Settings → Environment Variables** and redeploy.

## 3. Install dependencies

```bash
npm install
```

## 4. Initialize / update the database

```bash
npm run db:init
```

This safely creates missing tables, creates the login credential record if it does not already exist, and synchronizes the packaged menu.

The menu sync is intentionally non-destructive: an item already present with the same name or Product ID is skipped, so its current price/cost/active state is not overwritten.

To run only the menu synchronization later:

```bash
npm run db:sync-menu
```

## 5. Login

Opening `/`, `/dashboard`, `/items`, `/billing`, receipt pages or protected APIs requires authentication. An unauthenticated browser is redirected to `/login`; a successful login redirects to the dashboard (or the originally requested protected page).

The browser session uses an HTTP-only signed cookie and expires after 12 hours. The sidebar also contains a **Sign out** button.

### Change the login ID/password at any time

Recommended interactive command:

```bash
npm run auth:set -- --username your-new-login-id
```

The script securely prompts for the new password and confirmation. It updates the `admin_credentials` row in PostgreSQL and also updates the packaged default credential hash for future fresh databases when the project directory is writable.

You can also pass a password directly (less private because it may remain in shell history):

```bash
npm run auth:set -- --username your-new-login-id --password "YourNewStrongPassword"
```

Password rules: 8–256 characters. Login IDs may use letters, numbers, `.`, `_`, `@` and `-`.

If the app is deployed against the same PostgreSQL database, running this script locally with that database's `DATABASE_URL` changes the deployed login as well. Existing already-signed-in sessions can remain valid until logout or session expiry.

## 6. Run locally

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

You will be sent to the login page first.

## 7. Production build test

```bash
npm run build
npm start
```

## 8. Deploy to Vercel

Push this project to GitHub and import it into Vercel. If the repository contains a parent directory, set Vercel's **Root Directory** to the folder containing this `package.json`.

Configure these environment variables in Vercel:

```text
DATABASE_URL = your pooled PostgreSQL connection string
BUSINESS_TZ = Asia/Kolkata
AUTH_SECRET = a long random secret
```

Then redeploy.

## Database tables

The project uses:

- `menu_items`
- `bills`
- `bill_items`
- `expenses`
- `business_settings`
- `daily_bill_counters`
- `admin_credentials`

`daily_bill_counters` makes bill numbering safe when multiple requests happen at the same time.

## Bill numbering

Each business day starts again from Bill #1. Example:

```text
2026-09-16: #1, #2, #3 ...
2026-09-17: #1, #2, #3 ...
```

The final number is assigned inside a PostgreSQL transaction when the bill is saved.

## GST

The bill screen allows GST to be turned on/off per bill. The selected total GST rate is divided equally into CGST and SGST.

- 5% total → 2.5% CGST + 2.5% SGST
- 18% total → 9% CGST + 9% SGST

Enter the restaurant GSTIN in **Dashboard → Settings** before creating GST bills. Confirm the correct GST treatment for the restaurant with a tax professional before production use.

## Thermal printing

Go to **Dashboard → Settings** and select 58 mm or 80 mm. Printing is done by the browser through the computer's installed printer.

## Profit / loss

The dashboard calculation is:

```text
Profit = Sales before GST - Item Cost - Other Expenses
```

GST collected is displayed separately. For accurate profit figures, enter the real cost price of each dish on the Items page.
