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
  console.error("DATABASE_URL is missing from .env.local.");
  process.exit(1);
}

const seedItems = JSON.parse(fs.readFileSync(path.join(projectRoot, "data", "menu-items.json"), "utf8"));
const schemaSql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
const pool = new Pool({ connectionString, max: 1 });
const client = await pool.connect();

try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(794331001)");
  await client.query(schemaSql);

  const now = new Date().toISOString();
  const added = [];
  const skipped = [];

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
        RETURNING product_id, name
      `,
      [item.productId, item.name, item.category, item.priceRupees * 100, now],
    );

    if (result.rowCount) added.push(item.name);
    else skipped.push(item.name);
  }

  await client.query("COMMIT");
  console.log(`Menu sync complete: ${added.length} added, ${skipped.length} already present/skipped.`);
  if (added.length) {
    console.log("Added items:");
    for (const name of added) console.log(`  + ${name}`);
  }
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Menu sync failed:", error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
