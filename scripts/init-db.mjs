import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  console.error("DATABASE_URL is missing. Copy .env.example to .env.local and add your PostgreSQL/Neon connection string.");
  process.exit(1);
}

const seedItems = JSON.parse(fs.readFileSync(path.join(projectRoot, "data", "menu-items.json"), "utf8"));
const defaultAuth = JSON.parse(fs.readFileSync(path.join(projectRoot, "data", "default-auth.json"), "utf8"));
const schemaSql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
const pool = new Pool({ connectionString, max: 1 });
const client = await pool.connect();

async function syncMenu() {
  const now = new Date().toISOString();
  let added = 0;
  let skipped = 0;

  for (const item of seedItems) {
    const result = await client.query(
      `
        INSERT INTO menu_items
          (product_id, name, category, price_paise, cost_paise, is_active, created_at, updated_at)
        SELECT $1, $2, $3, $4, 0, 1, $5, $5
        WHERE NOT EXISTS (
          SELECT 1
          FROM menu_items existing
          WHERE LOWER(BTRIM(existing.name)) = LOWER(BTRIM($2))
        )
        ON CONFLICT (product_id) DO NOTHING
        RETURNING id
      `,
      [item.productId, item.name, item.category, item.priceRupees * 100, now],
    );

    if (result.rowCount) added += 1;
    else skipped += 1;
  }

  return { added, skipped };
}

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

  await client.query(
    `
      INSERT INTO admin_credentials (id, username, password_salt, password_hash, updated_at)
      VALUES (1, $1, $2, $3, $4)
      ON CONFLICT (id) DO NOTHING
    `,
    [defaultAuth.username, defaultAuth.salt, defaultAuth.hash, new Date().toISOString()],
  );

  const menuResult = await syncMenu();

  await client.query("COMMIT");
  const itemCount = await client.query("SELECT COUNT(*) AS count FROM menu_items");
  console.log(`Database ready. Menu items: ${itemCount.rows[0].count} (${menuResult.added} added, ${menuResult.skipped} already present).`);
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Database initialization failed:", error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
