import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getMenuItemById, updateMenuItem } from "@/lib/queries";

export const runtime = "nodejs";

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && String(error.code) === "23505";
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json({ error: "Item ID is invalid." }, { status: 400 });
    }

    const body = await request.json();
    const existing = await getMenuItemById(numericId);
    if (!existing) return NextResponse.json({ error: "Item not found." }, { status: 404 });

    const name = String(body.name ?? existing.name).trim();
    const category = String(body.category ?? existing.category).trim();
    const productId = String(body.productId ?? existing.productId).trim().toUpperCase().replace(/\s+/g, "");
    const priceRupees = body.priceRupees == null ? existing.pricePaise / 100 : Number(body.priceRupees);
    const costRupees = body.costRupees == null ? existing.costPaise / 100 : Number(body.costRupees);
    const isActive = body.isActive == null ? existing.isActive : Boolean(body.isActive);

    if (!name || !category) {
      return NextResponse.json({ error: "Name and category are required." }, { status: 400 });
    }
    if (!/^[A-Z0-9_-]{2,20}$/.test(productId)) {
      return NextResponse.json({ error: "Product ID is invalid." }, { status: 400 });
    }
    if (
      !Number.isFinite(priceRupees) ||
      priceRupees < 0 ||
      !Number.isFinite(costRupees) ||
      costRupees < 0
    ) {
      return NextResponse.json({ error: "Prices must be zero or greater." }, { status: 400 });
    }

    const item = await updateMenuItem(numericId, {
      productId,
      name,
      category,
      pricePaise: Math.round(priceRupees * 100),
      costPaise: Math.round(costRupees * 100),
      isActive,
    });

    if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });

    revalidatePath("/billing");
    revalidatePath("/items");
    revalidatePath("/dashboard");
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "That Product ID already exists." }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update item." },
      { status: 500 },
    );
  }
}
