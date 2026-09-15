# NutreeNext Billing — PostgreSQL / Vercel Edition

NutreeNext Billing is a Next.js restaurant billing system with:

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

This version no longer uses SQLite or `better-sqlite3`.

## 1. Create a PostgreSQL database

Recommended for Vercel: Neon PostgreSQL.

Create a Neon database, then copy its **pooled PostgreSQL connection string**. It looks similar to:

```env
postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/neondb?sslmode=require
```

## 2. Create `.env.local`

Copy `.env.example` to `.env.local` and set:

```env
DATABASE_URL="YOUR_POSTGRESQL_CONNECTION_STRING"
BUSINESS_TZ=Asia/Kolkata
```

Never commit `.env.local` to GitHub.

## 3. Install dependencies

```bash
npm install
```

## 4. Initialize the database

Recommended before the first run:

```bash
npm run db:init
```

This creates the PostgreSQL tables, default NutreeNext business settings and the menu items included with the project.

The application also contains a safe idempotent first-request initializer, so missing tables can be created automatically when the app first reaches PostgreSQL. Running `npm run db:init` is still recommended because it confirms the database credentials before deployment.

## 5. Run locally

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## 6. Production build test

Before deploying:

```bash
npm run build
npm start
```

## 7. Deploy to Vercel

Push this project to GitHub and import it into Vercel.

In **Vercel → Project → Settings → Environment Variables**, add:

```text
DATABASE_URL = your pooled PostgreSQL connection string
BUSINESS_TZ = Asia/Kolkata
```

Add them at least to **Production**. Adding them to Preview and Development is also useful.

If your GitHub repository contains a parent folder and this project is inside `nutreenext-billing`, set Vercel's **Root Directory** to that folder. The Vercel root must be the folder containing `package.json`.

Redeploy after saving the environment variables.

## Database tables

The project uses:

- `menu_items`
- `bills`
- `bill_items`
- `expenses`
- `business_settings`
- `daily_bill_counters`

`daily_bill_counters` makes bill numbering safe when multiple Vercel requests happen at the same time.

## Bill numbering

Each business day starts again from Bill #1. Example:

```text
2026-09-16: #1, #2, #3 ...
2026-09-17: #1, #2, #3 ...
```

The final number is assigned inside a PostgreSQL transaction when the bill is saved, so two simultaneous bills cannot normally receive the same number.

## GST

The bill screen allows GST to be turned on/off per bill. The selected total GST rate is divided equally into CGST and SGST.

- 5% total → 2.5% CGST + 2.5% SGST
- 18% total → 9% CGST + 9% SGST

Enter the restaurant GSTIN in **Dashboard → Settings** before creating GST bills.

Confirm the correct GST treatment for your restaurant with your tax professional before production use.

## Thermal printing

Go to **Dashboard → Settings** and select:

- 58 mm for small portable thermal printers
- 80 mm for 80 mm receipt printers

Printing is done by the browser through the computer's installed USB/Bluetooth printer. Vercel does not need direct access to the physical printer.

## Profit / loss

The dashboard calculation is:

```text
Profit = Sales before GST - Item Cost - Other Expenses
```

GST collected is displayed separately and is not counted as restaurant sales profit.

For accurate profit figures, enter the real cost price of every dish on the Items page.

## Important differences from the old SQLite version

Removed:

- `better-sqlite3`
- `DB_PATH`
- `data/nutreenext.sqlite`
- local database writes
- SQLite reset script

Added:

- `pg`
- `DATABASE_URL`
- PostgreSQL transactions
- concurrency-safe daily bill counters
- `npm run db:init`
- Vercel-compatible persistent database storage
