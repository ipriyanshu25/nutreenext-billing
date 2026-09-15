import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createMenuItem, getMenuItems } from "@/lib/queries";

export const runtime = "nodejs";

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && String(error.code) === "23505";
}

export async function GET() {
  try {
    return NextResponse.json({ items: await getMenuItems(true) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load items." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const category = String(body.category || "").trim();
    const priceRupees = Number(body.priceRupees);
    const costRupees = Number(body.costRupees || 0);
    const rawProductId = String(body.productId || "").trim().toUpperCase().replace(/\s+/g, "");

    if (!name) return NextResponse.json({ error: "Item name is required." }, { status: 400 });
    if (!category) return NextResponse.json({ error: "Category is required." }, { status: 400 });
    if (!Number.isFinite(priceRupees) || priceRupees < 0) {
      return NextResponse.json({ error: "Selling price must be valid." }, { status: 400 });
    }
    if (!Number.isFinite(costRupees) || costRupees < 0) {
      return NextResponse.json({ error: "Cost price must be valid." }, { status: 400 });
    }
    if (rawProductId && !/^[A-Z0-9_-]{2,20}$/.test(rawProductId)) {
      return NextResponse.json({ error: "Product ID can use letters, numbers, _ or -." }, { status: 400 });
    }

    const item = await createMenuItem({
      productId: rawProductId || undefined,
      name,
      category,
      pricePaise: Math.round(priceRupees * 100),
      costPaise: Math.round(costRupees * 100),
    });

    revalidatePath("/billing");
    revalidatePath("/items");
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "That Product ID already exists." }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to add item." },
      { status: 500 },
    );
  }
}
