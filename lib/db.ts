import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type BusinessSettings = {
  restaurantName: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  defaultGstRate: number;
  printerWidthMm: number;
  currencySymbol: string;
  timezone: string;
};

export type MenuItem = {
  id: number;
  productId: string;
  name: string;
  category: string;
  pricePaise: number;
  costPaise: number;
  isActive: boolean;
};

const dbPath = process.env.DB_PATH
  ? path.resolve(process.cwd(), process.env.DB_PATH)
  : path.join(process.cwd(), "data", "nutreenext.sqlite");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

type GlobalWithDb = typeof globalThis & { __nutreeDb?: Database.Database };
const globalForDb = globalThis as GlobalWithDb;

export const db = globalForDb.__nutreeDb ?? new Database(dbPath);
if (process.env.NODE_ENV !== "production") globalForDb.__nutreeDb = db;

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price_paise INTEGER NOT NULL CHECK(price_paise >= 0),
  cost_paise INTEGER NOT NULL DEFAULT 0 CHECK(cost_paise >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bills (
  id TEXT PRIMARY KEY,
  bill_date TEXT NOT NULL,
  daily_number INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  payment_method TEXT NOT NULL,
  gst_enabled INTEGER NOT NULL DEFAULT 0 CHECK(gst_enabled IN (0,1)),
  gst_rate REAL NOT NULL DEFAULT 0,
  subtotal_paise INTEGER NOT NULL,
  cgst_paise INTEGER NOT NULL DEFAULT 0,
  sgst_paise INTEGER NOT NULL DEFAULT 0,
  total_paise INTEGER NOT NULL,
  cogs_paise INTEGER NOT NULL DEFAULT 0,
  UNIQUE(bill_date, daily_number)
);

CREATE TABLE IF NOT EXISTS bill_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id TEXT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  menu_item_id INTEGER,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit_price_paise INTEGER NOT NULL,
  unit_cost_paise INTEGER NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  line_total_paise INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(bill_date);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_date TEXT NOT NULL,
  amount_paise INTEGER NOT NULL CHECK(amount_paise > 0),
  note TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

CREATE TABLE IF NOT EXISTS business_settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  restaurant_name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  gstin TEXT NOT NULL,
  default_gst_rate REAL NOT NULL,
  printer_width_mm INTEGER NOT NULL,
  currency_symbol TEXT NOT NULL,
  timezone TEXT NOT NULL
);
`);

const settingsExists = db.prepare("SELECT 1 FROM business_settings WHERE id = 1").get();
if (!settingsExists) {
  db.prepare(`
    INSERT INTO business_settings
      (id, restaurant_name, address, phone, email, gstin, default_gst_rate, printer_width_mm, currency_symbol, timezone)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "NutreeNext",
    "",
    "9758100102",
    "Contact@nutreenext.com",
    "",
    5,
    58,
    "₹",
    process.env.BUSINESS_TZ || "Asia/Kolkata"
  );
}

const seedItems = [
  ["MOM001", "Veg Momos – 6 Pc", "Momos", 69],
  ["MOM002", "Paneer Momos – 6 Pc", "Momos", 99],
  ["MOM003", "Kurkure Momos – 6 Pc", "Momos", 99],
  ["MOM004", "Fried Momos – 6 Pc", "Momos", 79],
  ["MOM005", "Paneer Cheese Momos – 6 Pc", "Momos", 129],
  ["MOM006", "NutreeNext Special Momos – 8 Pc", "Momos", 139],

  ["SAN001", "Grilled Sandwich", "Sandwich", 69],
  ["SAN002", "Grilled Mint Sandwich", "Sandwich", 79],
  ["SAN003", "Grilled Cheese Sandwich", "Sandwich", 99],
  ["SAN004", "Grilled Paneer Cheese Sandwich", "Sandwich", 139],

  ["FRI001", "French Fries", "Fries Bucket", 69],
  ["FRI002", "Peri Peri Masala Fries", "Fries Bucket", 79],
  ["FRI003", "Baked Peri Peri Tandoori Fries", "Fries Bucket", 129],
  ["FRI004", "Baked Cheese Fries", "Fries Bucket", 149],

  ["SHA001", "Vanilla Shake", "Shakes", 75],
  ["SHA002", "Strawberry Shake", "Shakes", 85],
  ["SHA003", "Mango Shake", "Shakes", 89],
  ["SHA004", "Pineapple Shake", "Shakes", 99],
  ["SHA005", "Blueberry Shake", "Shakes", 109],

  ["PMS001", "Kitkat Shake", "Premium Milkshakes", 79],
  ["PMS002", "Oreo Shake", "Premium Milkshakes", 89],
  ["PMS003", "Biscoff Shake", "Premium Milkshakes", 119],

  ["ROL001", "Veg Roll", "Rolls", 69],
  ["ROL002", "Veg Frankie Roll", "Rolls", 79],
  ["ROL003", "Paneer Roll", "Rolls", 99],
  ["ROL004", "NutreeNext Special Veg Kathi Roll", "Rolls", 119],

  ["BUR001", "Veg Burger", "Burgers", 59],
  ["BUR002", "Tandoori Burger", "Burgers", 69],
  ["BUR003", "Grilled Cheese Burger", "Burgers", 89],
  ["BUR004", "Mint Burger", "Burgers", 59],
  ["BUR005", "Big Double Tikki Burger", "Burgers", 99],
  ["BUR006", "Big Paneer Burger", "Burgers", 119],

  ["STK001", "Baby Corn Stick – 6 Pc", "Special Sticks", 199],
  ["STK002", "Mushroom Duplex – 6 Pc", "Special Sticks", 229],

  ["WAF001", "Chocolate Waffle", "Waffles", 59],
  ["WAF002", "Icy Vanilla Waffle", "Waffles", 69],
  ["WAF003", "Oreo Waffle", "Waffles", 79],
  ["WAF004", "Biscoff Waffle", "Waffles", 79],
  ["WAF005", "Choco-Chip Waffle", "Waffles", 69],
  ["WAF006", "Strawberry Waffle", "Waffles", 79],
  ["WAF007", "Mango Waffle", "Waffles", 89],
  ["WAF008", "Pineapple Waffle", "Waffles", 79],
  ["WAF009", "Blueberry Waffle", "Waffles", 99],

  ["COF001", "Spanish Hot Coffee", "Coffee", 49],
  ["COF002", "Special Cold Coffee", "Coffee", 89],
  ["COF003", "Cold Coffee with Ice Cream", "Coffee", 119]
] as const;

const menuCount = (db.prepare("SELECT COUNT(*) AS count FROM menu_items").get() as { count: number }).count;
if (menuCount === 0) {
  const insert = db.prepare(`
    INSERT INTO menu_items
      (product_id, name, category, price_paise, cost_paise, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, 1, ?, ?)
  `);
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    for (const [productId, name, category, priceRupees] of seedItems) {
      insert.run(productId, name, category, priceRupees * 100, now, now);
    }
  });
  tx();
}

export function mapMenuRow(row: Record<string, unknown>): MenuItem {
  return {
    id: Number(row.id),
    productId: String(row.product_id),
    name: String(row.name),
    category: String(row.category),
    pricePaise: Number(row.price_paise),
    costPaise: Number(row.cost_paise),
    isActive: Boolean(row.is_active),
  };
}

export function getSettings(): BusinessSettings {
  const row = db.prepare("SELECT * FROM business_settings WHERE id = 1").get() as Record<string, unknown>;
  return {
    restaurantName: String(row.restaurant_name),
    address: String(row.address),
    phone: String(row.phone),
    email: String(row.email),
    gstin: String(row.gstin),
    defaultGstRate: Number(row.default_gst_rate),
    printerWidthMm: Number(row.printer_width_mm),
    currencySymbol: String(row.currency_symbol),
    timezone: String(row.timezone),
  };
}
