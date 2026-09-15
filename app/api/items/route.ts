import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db, mapMenuRow } from "@/lib/db";
import { getMenuItems } from "@/lib/queries";

export const runtime = "nodejs";

function nextGeneratedId() {
  const rows = db.prepare("SELECT product_id FROM menu_items WHERE product_id LIKE 'NN%' ORDER BY id DESC").all() as Array<{ product_id: string }>;
  let max = 0;
  for (const row of rows) {
    const m = /^NN(\d+)$/.exec(row.product_id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `NN${String(max + 1).padStart(4, "0")}`;
}

export async function GET() {
  return NextResponse.json({ items: getMenuItems(true) });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const category = String(body.category || "").trim();
    const priceRupees = Number(body.priceRupees);
    const costRupees = Number(body.costRupees || 0);
    const productId = String(body.productId || nextGeneratedId()).trim().toUpperCase().replace(/\s+/g, "");

    if (!name) return NextResponse.json({ error: "Item name is required." }, { status: 400 });
    if (!category) return NextResponse.json({ error: "Category is required." }, { status: 400 });
    if (!Number.isFinite(priceRupees) || priceRupees < 0) return NextResponse.json({ error: "Selling price must be valid." }, { status: 400 });
    if (!Number.isFinite(costRupees) || costRupees < 0) return NextResponse.json({ error: "Cost price must be valid." }, { status: 400 });
    if (!/^[A-Z0-9_-]{2,20}$/.test(productId)) return NextResponse.json({ error: "Product ID can use letters, numbers, _ or -." }, { status: 400 });

    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO menu_items (product_id, name, category, price_paise, cost_paise, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).run(productId, name, category, Math.round(priceRupees * 100), Math.round(costRupees * 100), now, now);
    const row = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(result.lastInsertRowid) as Record<string, unknown>;
    revalidatePath("/billing");
    return NextResponse.json({ ok: true, item: mapMenuRow(row) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to add item.";
    if (message.includes("UNIQUE constraint failed")) return NextResponse.json({ error: "That Product ID already exists." }, { status: 409 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
