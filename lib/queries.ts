import { randomUUID } from "node:crypto";
import { db, getSettings, mapMenuRow, type MenuItem } from "@/lib/db";
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
    gstEnabled: Boolean(row.gst_enabled),
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

export function getMenuItems(includeInactive = false): MenuItem[] {
  const rows = db.prepare(`
    SELECT * FROM menu_items
    ${includeInactive ? "" : "WHERE is_active = 1"}
    ORDER BY category ASC, name ASC
  `).all() as Record<string, unknown>[];
  return rows.map(mapMenuRow);
}

export function getNextDailyNumber(dateKey = dateKeyInTimeZone()) {
  const row = db.prepare("SELECT COALESCE(MAX(daily_number), 0) AS maxNo FROM bills WHERE bill_date = ?").get(dateKey) as { maxNo: number };
  return Number(row.maxNo) + 1;
}

export function getBill(id: string): BillRecord | null {
  const row = db.prepare("SELECT * FROM bills WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  const items = db.prepare("SELECT * FROM bill_items WHERE bill_id = ? ORDER BY id ASC").all(id) as Record<string, unknown>[];
  return { ...mapBill(row), items: items.map(mapBillLine) };
}

export function getBillsForDate(dateKey: string, limit = 100) {
  const rows = db.prepare(`
    SELECT b.*,
      (SELECT COALESCE(SUM(quantity),0) FROM bill_items bi WHERE bi.bill_id = b.id) AS item_count
    FROM bills b
    WHERE bill_date = ?
    ORDER BY daily_number DESC
    LIMIT ?
  `).all(dateKey, limit) as Record<string, unknown>[];
  return rows.map((row) => ({ ...mapBill(row), itemCount: Number(row.item_count) }));
}

export function createBill(input: {
  customerName?: string;
  customerPhone?: string;
  paymentMethod: string;
  gstEnabled: boolean;
  gstRate: number;
  items: Array<{ itemId: number; quantity: number }>;
}) {
  const settings = getSettings();
  if (input.items.length === 0) throw new Error("Add at least one item to the bill.");
  if (input.gstEnabled && !settings.gstin.trim()) {
    throw new Error("Set your GSTIN in Dashboard → Business Settings before creating a GST invoice.");
  }

  const allowedRate = input.gstEnabled ? input.gstRate : 0;
  if (input.gstEnabled && ![5, 18].includes(allowedRate)) {
    throw new Error("GST rate must be 5% or 18%.");
  }

  const itemStmt = db.prepare("SELECT * FROM menu_items WHERE id = ? AND is_active = 1");
  const normalized = input.items.map(({ itemId, quantity }) => {
    const row = itemStmt.get(itemId) as Record<string, unknown> | undefined;
    if (!row) throw new Error(`Menu item ${itemId} is unavailable.`);
    const item = mapMenuRow(row);
    const qty = Math.max(1, Math.floor(quantity));
    return { item, quantity: qty };
  });

  const subtotalPaise = normalized.reduce((sum, x) => sum + x.item.pricePaise * x.quantity, 0);
  const cogsPaise = normalized.reduce((sum, x) => sum + x.item.costPaise * x.quantity, 0);
  const totalTaxPaise = input.gstEnabled ? Math.round((subtotalPaise * allowedRate) / 100) : 0;
  const cgstPaise = Math.floor(totalTaxPaise / 2);
  const sgstPaise = totalTaxPaise - cgstPaise;
  const totalPaise = subtotalPaise + cgstPaise + sgstPaise;
  const billDate = dateKeyInTimeZone(new Date(), settings.timezone);
  const createdAt = new Date().toISOString();
  const id = randomUUID();

  const tx = db.transaction(() => {
    const next = getNextDailyNumber(billDate);
    db.prepare(`
      INSERT INTO bills
        (id, bill_date, daily_number, created_at, customer_name, customer_phone, payment_method,
         gst_enabled, gst_rate, subtotal_paise, cgst_paise, sgst_paise, total_paise, cogs_paise)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      billDate,
      next,
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
      cogsPaise
    );

    const insertLine = db.prepare(`
      INSERT INTO bill_items
        (bill_id, menu_item_id, product_id, name, category, unit_price_paise, unit_cost_paise, quantity, line_total_paise)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const { item, quantity } of normalized) {
      insertLine.run(
        id,
        item.id,
        item.productId,
        item.name,
        item.category,
        item.pricePaise,
        item.costPaise,
        quantity,
        item.pricePaise * quantity
      );
    }
    return next;
  });

  const dailyNumber = tx();
  return { id, billDate, dailyNumber, totalPaise };
}

export function getDashboardData(day: string, month: string) {
  const daySummary = db.prepare(`
    SELECT
      COUNT(*) AS bill_count,
      COALESCE(SUM(subtotal_paise),0) AS subtotal_paise,
      COALESCE(SUM(cgst_paise + sgst_paise),0) AS tax_paise,
      COALESCE(SUM(total_paise),0) AS collected_paise,
      COALESCE(SUM(cogs_paise),0) AS cogs_paise
    FROM bills WHERE bill_date = ?
  `).get(day) as Record<string, unknown>;

  const monthSummary = db.prepare(`
    SELECT
      COUNT(*) AS bill_count,
      COALESCE(SUM(subtotal_paise),0) AS subtotal_paise,
      COALESCE(SUM(cgst_paise + sgst_paise),0) AS tax_paise,
      COALESCE(SUM(total_paise),0) AS collected_paise,
      COALESCE(SUM(cogs_paise),0) AS cogs_paise
    FROM bills WHERE bill_date LIKE ?
  `).get(`${month}-%`) as Record<string, unknown>;

  const dayExpense = db.prepare("SELECT COALESCE(SUM(amount_paise),0) AS amount FROM expenses WHERE expense_date = ?").get(day) as { amount: number };
  const monthExpense = db.prepare("SELECT COALESCE(SUM(amount_paise),0) AS amount FROM expenses WHERE expense_date LIKE ?").get(`${month}-%`) as { amount: number };

  const dailyTrend = db.prepare(`
    SELECT bill_date AS date,
      COALESCE(SUM(subtotal_paise),0) AS sales_paise,
      COUNT(*) AS bill_count
    FROM bills
    WHERE bill_date LIKE ?
    GROUP BY bill_date
    ORDER BY bill_date ASC
  `).all(`${month}-%`) as Array<{ date: string; sales_paise: number; bill_count: number }>;

  const dayTopItems = db.prepare(`
    SELECT bi.product_id, bi.name,
      SUM(bi.quantity) AS qty,
      SUM(bi.line_total_paise) AS revenue_paise
    FROM bill_items bi
    JOIN bills b ON b.id = bi.bill_id
    WHERE b.bill_date = ?
    GROUP BY bi.product_id, bi.name
    ORDER BY qty DESC, revenue_paise DESC
    LIMIT 8
  `).all(day) as Array<{ product_id: string; name: string; qty: number; revenue_paise: number }>;

  const monthTopItems = db.prepare(`
    SELECT bi.product_id, bi.name,
      SUM(bi.quantity) AS qty,
      SUM(bi.line_total_paise) AS revenue_paise
    FROM bill_items bi
    JOIN bills b ON b.id = bi.bill_id
    WHERE b.bill_date LIKE ?
    GROUP BY bi.product_id, bi.name
    ORDER BY qty DESC, revenue_paise DESC
    LIMIT 8
  `).all(`${month}-%`) as Array<{ product_id: string; name: string; qty: number; revenue_paise: number }>;

  const dayPaymentMix = db.prepare(`
    SELECT payment_method, COUNT(*) AS bills, COALESCE(SUM(total_paise),0) AS amount_paise
    FROM bills WHERE bill_date = ?
    GROUP BY payment_method
    ORDER BY amount_paise DESC
  `).all(day) as Array<{ payment_method: string; bills: number; amount_paise: number }>;

  const monthPaymentMix = db.prepare(`
    SELECT payment_method, COUNT(*) AS bills, COALESCE(SUM(total_paise),0) AS amount_paise
    FROM bills WHERE bill_date LIKE ?
    GROUP BY payment_method
    ORDER BY amount_paise DESC
  `).all(`${month}-%`) as Array<{ payment_method: string; bills: number; amount_paise: number }>;

  const dayMissingCost = db.prepare(`
    SELECT COUNT(*) AS lines
    FROM bill_items bi
    JOIN bills b ON b.id = bi.bill_id
    WHERE b.bill_date = ? AND bi.unit_cost_paise = 0
  `).get(day) as { lines: number };

  const monthMissingCost = db.prepare(`
    SELECT COUNT(*) AS lines
    FROM bill_items bi
    JOIN bills b ON b.id = bi.bill_id
    WHERE b.bill_date LIKE ? AND bi.unit_cost_paise = 0
  `).get(`${month}-%`) as { lines: number };

  const dayExpenses = db.prepare("SELECT * FROM expenses WHERE expense_date = ? ORDER BY id DESC").all(day) as Record<string, unknown>[];

  const mapTopItems = (rows: Array<{ product_id: string; name: string; qty: number; revenue_paise: number }>) =>
    rows.map((r) => ({ productId: r.product_id, name: r.name, qty: Number(r.qty), revenuePaise: Number(r.revenue_paise) }));

  const mapPaymentMix = (rows: Array<{ payment_method: string; bills: number; amount_paise: number }>) =>
    rows.map((r) => ({ method: r.payment_method, bills: Number(r.bills), amountPaise: Number(r.amount_paise) }));

  return {
    day: {
      billCount: Number(daySummary.bill_count),
      subtotalPaise: Number(daySummary.subtotal_paise),
      taxPaise: Number(daySummary.tax_paise),
      collectedPaise: Number(daySummary.collected_paise),
      cogsPaise: Number(daySummary.cogs_paise),
      expensePaise: Number(dayExpense.amount),
    },
    month: {
      billCount: Number(monthSummary.bill_count),
      subtotalPaise: Number(monthSummary.subtotal_paise),
      taxPaise: Number(monthSummary.tax_paise),
      collectedPaise: Number(monthSummary.collected_paise),
      cogsPaise: Number(monthSummary.cogs_paise),
      expensePaise: Number(monthExpense.amount),
    },
    dailyTrend: dailyTrend.map((r) => ({ date: r.date, salesPaise: Number(r.sales_paise), billCount: Number(r.bill_count) })),
    dayTopItems: mapTopItems(dayTopItems),
    monthTopItems: mapTopItems(monthTopItems),
    dayPaymentMix: mapPaymentMix(dayPaymentMix),
    monthPaymentMix: mapPaymentMix(monthPaymentMix),
    dayMissingCostLines: Number(dayMissingCost.lines),
    monthMissingCostLines: Number(monthMissingCost.lines),
    dayExpenses: dayExpenses.map((r) => ({ id: Number(r.id), date: String(r.expense_date), amountPaise: Number(r.amount_paise), note: String(r.note) })),
    bills: getBillsForDate(day, 200),
  };
}
