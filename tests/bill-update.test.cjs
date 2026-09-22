const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");

// Exercise the real query function with an isolated database boundary.
const source = ts.transpileModule(readFileSync(path.join(__dirname, "../lib/queries.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function setup({ missing = false, failWrite = false } = {}) {
  const calls = [];
  let released = false;
  const original = {
    id: "original-bill", bill_date: "2026-01-05", daily_number: 7,
    created_at: "2026-01-05T10:00:00.000Z", customer_name: "Old name", customer_phone: "123",
    payment_method: "Cash", gst_enabled: 0, gst_rate: 0, subtotal_paise: 1000,
    cgst_paise: 0, sgst_paise: 0, total_paise: 1000, cogs_paise: 300,
  };
  const client = {
    async query(sql, values = []) {
      sql = sql.replace(/\s+/g, " ").trim();
      calls.push({ sql, values });
      if (sql.startsWith("SELECT * FROM bills")) return { rows: missing ? [] : [original] };
      if (sql.startsWith("SELECT * FROM bill_items")) return { rows: [{
        id: 11, menu_item_id: null, product_id: "OLD", name: "Historical item", category: "Food",
        unit_price_paise: 1000, unit_cost_paise: 300, quantity: 1, line_total_paise: 1000,
      }] };
      if (sql.startsWith("SELECT * FROM menu_items")) return { rows: values[0].includes(22) ? [{
        id: 22, product_id: "NEW", name: "Available item", category: "Food",
        price_paise: 2000, cost_paise: 500, is_active: 1,
      }] : [] };
      if (failWrite && sql.startsWith("UPDATE bill_items")) throw new Error("Simulated write failure");
      assert.match(sql, /^(BEGIN|COMMIT|ROLLBACK|UPDATE bills SET|UPDATE bill_items SET|DELETE FROM bill_items|INSERT INTO bill_items)/);
      return { rows: [] };
    },
    release() { released = true; },
  };
  const db = {
    getSettings: async () => ({ gstin: "configured" }),
    getDbPool: () => ({ connect: async () => client }),
    mapMenuRow: (row) => ({ id: row.id, productId: row.product_id, name: row.name, category: row.category,
      pricePaise: row.price_paise, costPaise: row.cost_paise, isActive: true }),
  };
  const exports = {};
  new Function("require", "exports", source)((name) => {
    if (name === "@/lib/db") return db;
    if (name === "@/lib/utils") return {};
    return require(name);
  }, exports);
  return { updateBill: exports.updateBill, calls, original, released: () => released };
}

const input = (overrides = {}) => ({ customerName: " Updated customer ", customerPhone: " 456 ",
  paymentMethod: "UPI", gstEnabled: true, gstRate: 5, items: [{ lineId: 11, quantity: 3 }], ...overrides });

test("updates the same bill and existing line, preserving identity and historical pricing", async () => {
  const db = setup();
  const result = await db.updateBill("original-bill", input());
  assert.deepEqual(result, { id: "original-bill", billDate: "2026-01-05", dailyNumber: 7, totalPaise: 3150 });
  const update = db.calls.find((call) => call.sql.startsWith("UPDATE bills SET"));
  assert.deepEqual(update.values, ["Updated customer", "456", "UPI", 1, 5, 3000, 75, 75, 3150, 900, "original-bill"]);
  assert.doesNotMatch(update.sql, /SET id|bill_date\s*=|daily_number\s*=|created_at\s*=/);
  assert.deepEqual(db.calls.find((call) => call.sql.startsWith("UPDATE bill_items")).values, [3, 3000, 11, "original-bill"]);
  assert.ok(!db.calls.some((call) => /INSERT|daily_bill_counters/.test(call.sql)));
  assert.equal(db.calls.at(-1).sql, "COMMIT");
  assert.equal(db.released(), true);
});

test("removes an original line and adds an existing menu item to the same bill", async () => {
  const db = setup();
  const result = await db.updateBill("original-bill", input({ gstEnabled: false, items: [{ itemId: 22, quantity: 2 }] }));
  assert.equal(result.totalPaise, 4000);
  assert.deepEqual(db.calls.find((call) => call.sql.startsWith("DELETE FROM bill_items")).values, ["original-bill", []]);
  assert.deepEqual(db.calls.find((call) => call.sql.startsWith("INSERT INTO bill_items")).values,
    ["original-bill", 22, "NEW", "Available item", "Food", 2000, 500, 2, 4000]);
  assert.ok(!db.calls.some((call) => /INSERT INTO bills\b|INSERT INTO menu_items|daily_bill_counters/.test(call.sql)));
  const update = db.calls.find((call) => call.sql.startsWith("UPDATE bills SET"));
  assert.deepEqual(update.values.slice(3, 9), [0, 0, 4000, 0, 0, 4000]);
});

test("rejects line IDs belonging to a different bill and unavailable menu items", async () => {
  for (const items of [[{ lineId: 999, quantity: 1 }], [{ itemId: 999, quantity: 1 }]]) {
    const db = setup();
    await assert.rejects(db.updateBill("original-bill", input({ items })), /available/);
    assert.ok(!db.calls.some((call) => call.sql.startsWith("UPDATE")));
    assert.equal(db.calls.at(-1).sql, "ROLLBACK");
    assert.equal(db.released(), true);
  }
});

test("rolls back the entire update when a line write fails", async () => {
  const db = setup({ failWrite: true });
  await assert.rejects(db.updateBill("original-bill", input()), /Simulated write failure/);
  assert.equal(db.calls.at(-1).sql, "ROLLBACK");
  assert.ok(!db.calls.some((call) => call.sql === "COMMIT"));
  assert.equal(db.released(), true);
});

test("missing bill does not create a replacement", async () => {
  const db = setup({ missing: true });
  assert.equal(await db.updateBill("deleted-bill", input()), null);
  assert.equal(db.calls.at(-1).sql, "ROLLBACK");
  assert.ok(!db.calls.some((call) => /INSERT|UPDATE|DELETE FROM/.test(call.sql.replace("FOR UPDATE", ""))));
  assert.equal(db.released(), true);
});

test("rejects empty, duplicate, ambiguous and invalid quantities", async () => {
  for (const items of [[], [{ lineId: 11, quantity: 0 }], [{ lineId: 11, quantity: 1.5 }],
    [{ lineId: 11, itemId: 22, quantity: 1 }], [{ quantity: 1 }],
    [{ lineId: 11, quantity: 1 }, { lineId: 11, quantity: 2 }]]) {
    const db = setup();
    await assert.rejects(db.updateBill("original-bill", input({ items })));
    assert.equal(db.calls.length, 0);
  }
});

test("recalculates 18% tax and rejects unsupported payment and tax rates", async () => {
  const db = setup();
  assert.equal((await db.updateBill("original-bill", input({ gstRate: 18 }))).totalPaise, 3540);
  await assert.rejects(setup().updateBill("original-bill", input({ gstRate: 12 })), /GST rate/);
  await assert.rejects(setup().updateBill("original-bill", input({ paymentMethod: "Invalid" })), /Payment method/);
});
