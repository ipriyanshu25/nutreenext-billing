# NutreeNext Billing

NutreeNext Billing is a restaurant POS/billing system built with **Next.js** and **SQLite**. It supports daily bill numbering, menu management, GST/non-GST bills, 58 mm / 80 mm thermal printing, bill history, expenses, and daily/monthly profit tracking.

## Current UI

The left sidebar contains only three working areas:

- **Dashboard**
- **Items**
- **Generate Bill**

The UI uses a clean **white background with orange accents**.

### Dashboard

The Dashboard is period-based instead of showing every report at the same time.

- **Today** shows today's sales, profit/loss, bills, average bill, payment mix, top items, expenses and bill records.
- **Previous Day** lets you pick any earlier date and shows the same day-level report.
- **Month** lets you pick a month and shows monthly sales, profit/loss, bills, average bill, a daily sales graph, top items and daily performance.
- Use **+ Expense** to record operating expenses.
- Use **Settings** for restaurant details, GSTIN, GST default and thermal paper width.

### Items

Use Items to:

- Add a new dish
- Search/filter menu items
- Change selling price
- Enter cost price for profit calculations
- Edit Product IDs/categories
- Hide or reactivate an item

### Generate Bill

- Search menu items by name or Product ID.
- Filter by category with the dropdown.
- Add multiple items and change quantities directly in the list.
- Click **Review & Print Bill** to open the bill in a modal.
- Customer name, mobile, payment method and GST are entered in that modal.
- The modal body scrolls independently while totals and **Save & Print Bill** stay accessible at the bottom.

## 1. Requirements

Install Node.js 20+ (Node.js 22 LTS is recommended).

## 2. Setup

Extract the project and open a terminal in the project folder:

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Optional `.env.local`:

```env
DB_PATH=./data/nutreenext.sqlite
BUSINESS_TZ=Asia/Kolkata
```

On Windows you can also use `start-windows.bat` after dependencies are installed.

## 3. Database

The current version uses **SQLite**. No separate database server is required.

The app automatically creates:

```text
data/nutreenext.sqlite
```

It creates the tables and seeds the NutreeNext menu items included in this project.

Back up `data/nutreenext.sqlite` regularly. PostgreSQL is the recommended later upgrade if you add multiple billing counters, multiple branches or a cloud-hosted central database.

## 4. Billing flow

1. Open **Generate Bill**.
2. Search/filter items.
3. Add dishes and quantities.
4. Click **Review & Print Bill**.
5. Enter optional customer details.
6. Choose Cash, UPI or Card.
7. Enable GST only when required.
8. Click **Save & Print Bill**.
9. The receipt page opens and triggers the browser print dialog.
10. Use **Generate Next Bill** after printing.

Daily bill numbering starts from `#1` each new day. The final number is assigned when the bill is saved.

## 5. GST

The system supports:

- No GST
- 5% total GST → CGST 2.5% + SGST 2.5%
- 18% total GST → CGST 9% + SGST 9%

GST billing is blocked until a GSTIN is saved in **Dashboard → Settings**.

Confirm the GST treatment that applies to your restaurant with your accountant/CA before production use.

## 6. Profit / loss

Profit is calculated as:

```text
Sales before GST - Item Cost - Other Expenses
```

Enter each dish's cost price on the **Items** page for meaningful profit figures.

## 7. Thermal printer

A fresh database defaults to **58 mm** paper because the project is configured for a compact portable thermal printer. You can switch between **58 mm** and **80 mm** in **Dashboard → Settings**.

When printing:

- Select the installed/paired thermal printer.
- Use 100% / actual-size scale.
- Disable browser headers and footers.
- Use minimal/default printer margins.

## 8. Production notes

SQLite is suitable when the application and database run on one restaurant computer or a server with persistent storage. Avoid storing the SQLite database on an ephemeral/serverless filesystem.

For a future multi-counter/cloud version, migrate the data layer to PostgreSQL while keeping most of the current UI and billing workflow.
