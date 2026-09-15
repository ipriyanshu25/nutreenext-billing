import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db, mapMenuRow } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);
    const body = await request.json();
    const existing = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(numericId) as Record<string, unknown> | undefined;
    if (!existing) return NextResponse.json({ error: "Item not found." }, { status: 404 });

    const name = String(body.name ?? existing.name).trim();
    const category = String(body.category ?? existing.category).trim();
    const productId = String(body.productId ?? existing.product_id).trim().toUpperCase().replace(/\s+/g, "");
    const priceRupees = body.priceRupees == null ? Number(existing.price_paise) / 100 : Number(body.priceRupees);
    const costRupees = body.costRupees == null ? Number(existing.cost_paise) / 100 : Number(body.costRupees);
    const isActive = body.isActive == null ? Boolean(existing.is_active) : Boolean(body.isActive);

    if (!name || !category) return NextResponse.json({ error: "Name and category are required." }, { status: 400 });
    if (!/^[A-Z0-9_-]{2,20}$/.test(productId)) return NextResponse.json({ error: "Product ID is invalid." }, { status: 400 });
    if (!Number.isFinite(priceRupees) || priceRupees < 0 || !Number.isFinite(costRupees) || costRupees < 0) return NextResponse.json({ error: "Prices must be zero or greater." }, { status: 400 });

    db.prepare(`
      UPDATE menu_items SET product_id = ?, name = ?, category = ?, price_paise = ?, cost_paise = ?, is_active = ?, updated_at = ? WHERE id = ?
    `).run(productId, name, category, Math.round(priceRupees * 100), Math.round(costRupees * 100), isActive ? 1 : 0, new Date().toISOString(), numericId);

    const row = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(numericId) as Record<string, unknown>;
    revalidatePath("/billing");
    revalidatePath("/dashboard");
    return NextResponse.json({ ok: true, item: mapMenuRow(row) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update item.";
    if (message.includes("UNIQUE constraint failed")) return NextResponse.json({ error: "That Product ID already exists." }, { status: 409 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
