import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  console.error("DATABASE_URL is missing. Copy .env.example to .env.local and add your PostgreSQL/Neon connection string.");
  process.exit(1);
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
  ["COF003", "Cold Coffee with Ice Cream", "Coffee", 119],
];

const schemaSql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
const pool = new Pool({ connectionString, max: 1 });
const client = await pool.connect();

try {
  console.log("Initializing NutreeNext PostgreSQL database...");
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(794331001)");
  await client.query(schemaSql);

  const timezone = process.env.BUSINESS_TZ?.trim() || "Asia/Kolkata";
  await client.query(
    `
      INSERT INTO business_settings
        (id, restaurant_name, address, phone, email, gstin, default_gst_rate, printer_width_mm, currency_symbol, timezone)
      VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO NOTHING
    `,
    ["NutreeNext", "", "9758100102", "Contact@nutreenext.com", "", 5, 58, "₹", timezone],
  );

  const existingMenu = await client.query("SELECT COUNT(*) AS count FROM menu_items");
  if (Number(existingMenu.rows[0]?.count || 0) === 0) {
    const now = new Date().toISOString();
    for (const [productId, name, category, priceRupees] of seedItems) {
      await client.query(
        `
          INSERT INTO menu_items
            (product_id, name, category, price_paise, cost_paise, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, 0, 1, $5, $5)
          ON CONFLICT (product_id) DO NOTHING
        `,
        [productId, name, category, priceRupees * 100, now],
      );
    }
  }

  await client.query("COMMIT");
  const itemCount = await client.query("SELECT COUNT(*) AS count FROM menu_items");
  console.log(`Database ready. Menu items: ${itemCount.rows[0].count}`);
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Database initialization failed:", error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
