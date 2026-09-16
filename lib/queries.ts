import { randomUUID } from "node:crypto";
import {
  ensureDatabase,
  getDbPool,
  getSettings,
  mapMenuRow,
  queryDb,
  type BusinessSettings,
  type MenuItem,
} from "@/lib/db";
import { dateKeyInTimeZone } from "@/lib/utils";

export type BillLine = {
  id: number;
  menuItemId: number | null;
  productId: string;
  name: string;
  category: string;
  unitPricePaise: number;
  unitCostPaise: number;
  quantity: number;
  lineTotalPaise: number;
};

export type BillRecord = {
  id: string;
  billDate: string;
  dailyNumber: number;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: string;
  gstEnabled: boolean;
  gstRate: number;
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  totalPaise: number;
  cogsPaise: number;
  items: BillLine[];
};

function mapBill(row: Record<string, unknown>): Omit<BillRecord, "items"> {
  return {
    id: String(row.id),
    billDate: String(row.bill_date),
    dailyNumber: Number(row.daily_number),
    createdAt: String(row.created_at),
    customerName: String(row.customer_name || ""),
    customerPhone: String(row.customer_phone || ""),
    paymentMethod: String(row.payment_method),
    gstEnabled: Number(row.gst_enabled) === 1 || row.gst_enabled === true,
    gstRate: Number(row.gst_rate),
    subtotalPaise: Number(row.subtotal_paise),
    cgstPaise: Number(row.cgst_paise),
    sgstPaise: Number(row.sgst_paise),
    totalPaise: Number(row.total_paise),
    cogsPaise: Number(row.cogs_paise),
  };
}

function mapBillLine(row: Record<string, unknown>): BillLine {
  return {
    id: Number(row.id),
    menuItemId: row.menu_item_id == null ? null : Number(row.menu_item_id),
    productId: String(row.product_id),
    name: String(row.name),
    category: String(row.category),
    unitPricePaise: Number(row.unit_price_paise),
    unitCostPaise: Number(row.unit_cost_paise),
    quantity: Number(row.quantity),
    lineTotalPaise: Number(row.line_total_paise),
  };
}

export async function getMenuItems(includeInactive = false): Promise<MenuItem[]> {
  const result = await queryDb<Record<string, unknown>>(`
    SELECT * FROM menu_items
    ${includeInactive ? "" : "WHERE is_active = 1"}
    ORDER BY category ASC, name ASC
  `);
  return result.rows.map(mapMenuRow);
}

export async function getMenuItemById(id: number): Promise<MenuItem | null> {
  const result = await queryDb<Record<string, unknown>>(
    "SELECT * FROM menu_items WHERE id = $1",
    [id],
  );
  return result.rows[0] ? mapMenuRow(result.rows[0]) : null;
}

export async function getNextDailyNumber(dateKey = dateKeyInTimeZone()): Promise<number> {
  const result = await queryDb<{ next_no: string | number }>(
    `
      SELECT GREATEST(
        COALESCE((SELECT last_number FROM daily_bill_counters WHERE bill_date = $1), 0),
        COALESCE((SELECT MAX(daily_number) FROM bills WHERE bill_date = $1), 0)
      ) + 1 AS next_no
    `,
    [dateKey],
  );
  return Number(result.rows[0]?.next_no || 1);
}

export async function getBill(id: string): Promise<BillRecord | null> {
  const billResult = await queryDb<Record<string, unknown>>(
    "SELECT * FROM bills WHERE id = $1",
    [id],
  );
  const row = billResult.rows[0];
  if (!row) return null;

  const itemResult = await queryDb<Record<string, unknown>>(
    "SELECT * FROM bill_items WHERE bill_id = $1 ORDER BY id ASC",
    [id],
  );

  return { ...mapBill(row), items: itemResult.rows.map(mapBillLine) };
}

export async function deleteBill(
  id: string,
): Promise<{ id: string; billDate: string; dailyNumber: number } | null> {
  await ensureDatabase();

  const result = await queryDb<{ id: string; bill_date: string; daily_number: string | number }>(
    `
      DELETE FROM bills
      WHERE id = $1
      RETURNING id, bill_date, daily_number
    `,
    [id],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: String(row.id),
    billDate: String(row.bill_date),
    dailyNumber: Number(row.daily_number),
  };
}

export type BillListRecord = Omit<BillRecord, "items"> & { itemCount: number };

export async function getBillsForDate(dateKey: string, limit = 100): Promise<BillListRecord[]> {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const result = await queryDb<Record<string, unknown>>(
    `
      SELECT b.*,
        (SELECT COALESCE(SUM(quantity),0) FROM bill_items bi WHERE bi.bill_id = b.id) AS item_count
      FROM bills b
      WHERE bill_date = $1
      ORDER BY daily_number DESC
      LIMIT $2
    `,
    [dateKey, safeLimit],
  );

  return result.rows.map((row: Record<string, unknown>) => ({ ...mapBill(row), itemCount: Number(row.item_count) }));
}

export async function createBill(input: {
  customerName?: string;
  customerPhone?: string;
  paymentMethod: string;
  gstEnabled: boolean;
  gstRate: number;
  items: Array<{ itemId: number; quantity: number }>;
}) {
  await ensureDatabase();
  const settings = await getSettings();

  if (input.items.length === 0) throw new Error("Add at least one item to the bill.");
  if (input.gstEnabled && !settings.gstin.trim()) {
    throw new Error("Set your GSTIN in Dashboard → Business Settings before creating a GST invoice.");
  }

  const allowedRate = input.gstEnabled ? input.gstRate : 0;
  if (input.gstEnabled && ![5, 18].includes(allowedRate)) {
    throw new Error("GST rate must be 5% or 18%.");
  }

  const ids = input.items.map((item) => item.itemId);
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const itemResult = await client.query<Record<string, unknown>>(
      "SELECT * FROM menu_items WHERE id = ANY($1::int[]) AND is_active = 1",
      [ids],
    );
    const itemPairs: Array<readonly [number, MenuItem]> = itemResult.rows.map((row: Record<string, unknown>) => {
      const item = mapMenuRow(row);
      return [item.id, item] as const;
    });
    const itemMap = new Map<number, MenuItem>(itemPairs);

    const normalized: Array<{ item: MenuItem; quantity: number }> = input.items.map(({ itemId, quantity }) => {
      const item = itemMap.get(itemId);
      if (!item) throw new Error(`Menu item ${itemId} is unavailable.`);
      const qty = Math.max(1, Math.floor(quantity));
      return { item, quantity: qty };
    });

    const subtotalPaise = normalized.reduce((sum, x) => sum + x.item.pricePaise * x.quantity, 0);
    const cogsPaise = normalized.reduce((sum, x) => sum + x.item.costPaise * x.quantity, 0);
    const totalTaxPaise = input.gstEnabled ? Math.round((subtotalPaise * allowedRate) / 100) : 0;
    const cgstPaise = Math.floor(totalTaxPaise / 2);
    const sgstPaise = totalTaxPaise - cgstPaise;
    const totalPaise = subtotalPaise + totalTaxPaise;
    const billDate = dateKeyInTimeZone(new Date(), settings.timezone);
    const createdAt = new Date().toISOString();
    const id = randomUUID();

    const counterResult = await client.query<{ last_number: string | number }>(
      `
        INSERT INTO daily_bill_counters (bill_date, last_number)
        VALUES (
          $1,
          (SELECT COALESCE(MAX(daily_number), 0) + 1 FROM bills WHERE bill_date = $1)
        )
        ON CONFLICT (bill_date) DO UPDATE SET
          last_number = GREATEST(
            daily_bill_counters.last_number,
            (SELECT COALESCE(MAX(daily_number), 0) FROM bills WHERE bill_date = EXCLUDED.bill_date)
          ) + 1
        RETURNING last_number
      `,
      [billDate],
    );
    const dailyNumber = Number(counterResult.rows[0].last_number);

    await client.query(
      `
        INSERT INTO bills
          (id, bill_date, daily_number, created_at, customer_name, customer_phone, payment_method,
           gst_enabled, gst_rate, subtotal_paise, cgst_paise, sgst_paise, total_paise, cogs_paise)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `,
      [
        id,
        billDate,
        dailyNumber,
        createdAt,
        input.customerName?.trim() || "",
        input.customerPhone?.trim() || "",
        input.paymentMethod,
        input.gstEnabled ? 1 : 0,
        allowedRate,
        subtotalPaise,
        cgstPaise,
        sgstPaise,
        totalPaise,
        cogsPaise,
      ],
    );

    for (const { item, quantity } of normalized) {
      await client.query(
        `
          INSERT INTO bill_items
            (bill_id, menu_item_id, product_id, name, category, unit_price_paise, unit_cost_paise, quantity, line_total_paise)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          id,
          item.id,
          item.productId,
          item.name,
          item.category,
          item.pricePaise,
          item.costPaise,
          quantity,
          item.pricePaise * quantity,
        ],
      );
    }

    await client.query("COMMIT");
    return { id, billDate, dailyNumber, totalPaise };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createMenuItem(input: {
  productId?: string;
  name: string;
  category: string;
  pricePaise: number;
  costPaise: number;
}) {
  await ensureDatabase();
  const pool = getDbPool();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    let productId = input.productId?.trim();
    if (!productId) {
      const sequenceResult = await pool.query<{ value: string | number }>(
        "SELECT nextval('menu_product_seq') AS value",
      );
      productId = `NN${String(Number(sequenceResult.rows[0].value)).padStart(4, "0")}`;
    }

    const now = new Date().toISOString();
    try {
      const result = await pool.query<Record<string, unknown>>(
        `
          INSERT INTO menu_items
            (product_id, name, category, price_paise, cost_paise, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, 1, $6, $6)
          RETURNING *
        `,
        [productId, input.name, input.category, input.pricePaise, input.costPaise, now],
      );
      return mapMenuRow(result.rows[0]);
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (!input.productId && code === "23505") continue;
      throw error;
    }
  }

  throw new Error("Unable to generate a unique Product ID. Please enter one manually.");
}

export async function updateMenuItem(
  id: number,
  input: {
    productId: string;
    name: string;
    category: string;
    pricePaise: number;
    costPaise: number;
    isActive: boolean;
  },
): Promise<MenuItem | null> {
  const result = await queryDb<Record<string, unknown>>(
    `
      UPDATE menu_items SET
        product_id = $1,
        name = $2,
        category = $3,
        price_paise = $4,
        cost_paise = $5,
        is_active = $6,
        updated_at = $7
      WHERE id = $8
      RETURNING *
    `,
    [
      input.productId,
      input.name,
      input.category,
      input.pricePaise,
      input.costPaise,
      input.isActive ? 1 : 0,
      new Date().toISOString(),
      id,
    ],
  );

  return result.rows[0] ? mapMenuRow(result.rows[0]) : null;
}

export async function addExpense(input: { expenseDate: string; amountPaise: number; note: string }) {
  await queryDb(
    `
      INSERT INTO expenses (expense_date, amount_paise, note, created_at)
      VALUES ($1, $2, $3, $4)
    `,
    [input.expenseDate, input.amountPaise, input.note, new Date().toISOString()],
  );
}

export async function updateBusinessSettings(input: Omit<BusinessSettings, "currencySymbol" | "timezone">) {
  const result = await queryDb<Record<string, unknown>>(
    `
      UPDATE business_settings SET
        restaurant_name = $1,
        address = $2,
        phone = $3,
        email = $4,
        gstin = $5,
        default_gst_rate = $6,
        printer_width_mm = $7
      WHERE id = 1
      RETURNING *
    `,
    [
      input.restaurantName,
      input.address,
      input.phone,
      input.email,
      input.gstin,
      input.defaultGstRate,
      input.printerWidthMm,
    ],
  );

  const row = result.rows[0];
  if (!row) throw new Error("Business settings were not found.");

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
  } satisfies BusinessSettings;
}

export type DashboardData = {
  day: { billCount: number; subtotalPaise: number; taxPaise: number; collectedPaise: number; cogsPaise: number; expensePaise: number };
  month: { billCount: number; subtotalPaise: number; taxPaise: number; collectedPaise: number; cogsPaise: number; expensePaise: number };
  dailyTrend: Array<{ date: string; salesPaise: number; billCount: number }>;
  dayTopItems: Array<{ productId: string; name: string; qty: number; revenuePaise: number }>;
  monthTopItems: Array<{ productId: string; name: string; qty: number; revenuePaise: number }>;
  dayPaymentMix: Array<{ method: string; bills: number; amountPaise: number }>;
  monthPaymentMix: Array<{ method: string; bills: number; amountPaise: number }>;
  dayMissingCostLines: number;
  monthMissingCostLines: number;
  dayExpenses: Array<{ id: number; date: string; amountPaise: number; note: string }>;
  bills: BillListRecord[];
};

export async function getDashboardData(day: string, month: string): Promise<DashboardData> {
  await ensureDatabase();
  const pool = getDbPool();
  const monthLike = `${month}-%`;

  const [
    daySummaryResult,
    monthSummaryResult,
    dayExpenseResult,
    monthExpenseResult,
    dailyTrendResult,
    dayTopItemsResult,
    monthTopItemsResult,
    dayPaymentMixResult,
    monthPaymentMixResult,
    dayMissingCostResult,
    monthMissingCostResult,
    dayExpensesResult,
    bills,
  ] = await Promise.all([
    pool.query<Record<string, unknown>>(
      `
        SELECT
          COUNT(*) AS bill_count,
          COALESCE(SUM(subtotal_paise),0) AS subtotal_paise,
          COALESCE(SUM(cgst_paise + sgst_paise),0) AS tax_paise,
          COALESCE(SUM(total_paise),0) AS collected_paise,
          COALESCE(SUM(cogs_paise),0) AS cogs_paise
        FROM bills WHERE bill_date = $1
      `,
      [day],
    ),
    pool.query<Record<string, unknown>>(
      `
        SELECT
          COUNT(*) AS bill_count,
          COALESCE(SUM(subtotal_paise),0) AS subtotal_paise,
          COALESCE(SUM(cgst_paise + sgst_paise),0) AS tax_paise,
          COALESCE(SUM(total_paise),0) AS collected_paise,
          COALESCE(SUM(cogs_paise),0) AS cogs_paise
        FROM bills WHERE bill_date LIKE $1
      `,
      [monthLike],
    ),
    pool.query<{ amount: string | number }>(
      "SELECT COALESCE(SUM(amount_paise),0) AS amount FROM expenses WHERE expense_date = $1",
      [day],
    ),
    pool.query<{ amount: string | number }>(
      "SELECT COALESCE(SUM(amount_paise),0) AS amount FROM expenses WHERE expense_date LIKE $1",
      [monthLike],
    ),
    pool.query<{ date: string; sales_paise: string | number; bill_count: string | number }>(
      `
        SELECT bill_date AS date,
          COALESCE(SUM(subtotal_paise),0) AS sales_paise,
          COUNT(*) AS bill_count
        FROM bills
        WHERE bill_date LIKE $1
        GROUP BY bill_date
        ORDER BY bill_date ASC
      `,
      [monthLike],
    ),
    pool.query<{ product_id: string; name: string; qty: string | number; revenue_paise: string | number }>(
      `
        SELECT bi.product_id, bi.name,
          SUM(bi.quantity) AS qty,
          SUM(bi.line_total_paise) AS revenue_paise
        FROM bill_items bi
        JOIN bills b ON b.id = bi.bill_id
        WHERE b.bill_date = $1
        GROUP BY bi.product_id, bi.name
        ORDER BY qty DESC, revenue_paise DESC
        LIMIT 8
      `,
      [day],
    ),
    pool.query<{ product_id: string; name: string; qty: string | number; revenue_paise: string | number }>(
      `
        SELECT bi.product_id, bi.name,
          SUM(bi.quantity) AS qty,
          SUM(bi.line_total_paise) AS revenue_paise
        FROM bill_items bi
        JOIN bills b ON b.id = bi.bill_id
        WHERE b.bill_date LIKE $1
        GROUP BY bi.product_id, bi.name
        ORDER BY qty DESC, revenue_paise DESC
        LIMIT 8
      `,
      [monthLike],
    ),
    pool.query<{ payment_method: string; bills: string | number; amount_paise: string | number }>(
      `
        SELECT payment_method, COUNT(*) AS bills, COALESCE(SUM(total_paise),0) AS amount_paise
        FROM bills WHERE bill_date = $1
        GROUP BY payment_method
        ORDER BY amount_paise DESC
      `,
      [day],
    ),
    pool.query<{ payment_method: string; bills: string | number; amount_paise: string | number }>(
      `
        SELECT payment_method, COUNT(*) AS bills, COALESCE(SUM(total_paise),0) AS amount_paise
        FROM bills WHERE bill_date LIKE $1
        GROUP BY payment_method
        ORDER BY amount_paise DESC
      `,
      [monthLike],
    ),
    pool.query<{ lines: string | number }>(
      `
        SELECT COUNT(*) AS lines
        FROM bill_items bi
        JOIN bills b ON b.id = bi.bill_id
        WHERE b.bill_date = $1 AND bi.unit_cost_paise = 0
      `,
      [day],
    ),
    pool.query<{ lines: string | number }>(
      `
        SELECT COUNT(*) AS lines
        FROM bill_items bi
        JOIN bills b ON b.id = bi.bill_id
        WHERE b.bill_date LIKE $1 AND bi.unit_cost_paise = 0
      `,
      [monthLike],
    ),
    pool.query<Record<string, unknown>>(
      "SELECT * FROM expenses WHERE expense_date = $1 ORDER BY id DESC",
      [day],
    ),
    getBillsForDate(day, 200),
  ]);

  const daySummary = daySummaryResult.rows[0] || {};
  const monthSummary = monthSummaryResult.rows[0] || {};
  const dayExpense = dayExpenseResult.rows[0]?.amount || 0;
  const monthExpense = monthExpenseResult.rows[0]?.amount || 0;

  const mapTopItems = (
    rows: Array<{ product_id: string; name: string; qty: string | number; revenue_paise: string | number }>,
  ) => rows.map((r) => ({
    productId: r.product_id,
    name: r.name,
    qty: Number(r.qty),
    revenuePaise: Number(r.revenue_paise),
  }));

  const mapPaymentMix = (
    rows: Array<{ payment_method: string; bills: string | number; amount_paise: string | number }>,
  ) => rows.map((r) => ({
    method: r.payment_method,
    bills: Number(r.bills),
    amountPaise: Number(r.amount_paise),
  }));

  return {
    day: {
      billCount: Number(daySummary.bill_count || 0),
      subtotalPaise: Number(daySummary.subtotal_paise || 0),
      taxPaise: Number(daySummary.tax_paise || 0),
      collectedPaise: Number(daySummary.collected_paise || 0),
      cogsPaise: Number(daySummary.cogs_paise || 0),
      expensePaise: Number(dayExpense),
    },
    month: {
      billCount: Number(monthSummary.bill_count || 0),
      subtotalPaise: Number(monthSummary.subtotal_paise || 0),
      taxPaise: Number(monthSummary.tax_paise || 0),
      collectedPaise: Number(monthSummary.collected_paise || 0),
      cogsPaise: Number(monthSummary.cogs_paise || 0),
      expensePaise: Number(monthExpense),
    },
    dailyTrend: dailyTrendResult.rows.map((r: { date: string; sales_paise: string | number; bill_count: string | number }) => ({
      date: r.date,
      salesPaise: Number(r.sales_paise),
      billCount: Number(r.bill_count),
    })),
    dayTopItems: mapTopItems(dayTopItemsResult.rows),
    monthTopItems: mapTopItems(monthTopItemsResult.rows),
    dayPaymentMix: mapPaymentMix(dayPaymentMixResult.rows),
    monthPaymentMix: mapPaymentMix(monthPaymentMixResult.rows),
    dayMissingCostLines: Number(dayMissingCostResult.rows[0]?.lines || 0),
    monthMissingCostLines: Number(monthMissingCostResult.rows[0]?.lines || 0),
    dayExpenses: dayExpensesResult.rows.map((r: Record<string, unknown>) => ({
      id: Number(r.id),
      date: String(r.expense_date),
      amountPaise: Number(r.amount_paise),
      note: String(r.note),
    })),
    bills,
  };
}
