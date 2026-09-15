import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createBill, getBillsForDate } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Valid date required." }, { status: 400 });
    }
    return NextResponse.json({ bills: await getBillsForDate(date, 100) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load bills." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const paymentMethod = String(body.paymentMethod || "Cash");
    if (!["Cash", "UPI", "Card"].includes(paymentMethod)) {
      return NextResponse.json({ error: "Payment method is invalid." }, { status: 400 });
    }

    const items = Array.isArray(body.items)
      ? body.items.map((x: { itemId?: unknown; quantity?: unknown }) => ({
          itemId: Number(x.itemId),
          quantity: Number(x.quantity),
        }))
      : [];

    if (
      !items.length ||
      items.some(
        (x: { itemId: number; quantity: number }) =>
          !Number.isInteger(x.itemId) || !Number.isInteger(x.quantity) || x.quantity <= 0,
      )
    ) {
      return NextResponse.json({ error: "Add valid items and quantities." }, { status: 400 });
    }

    const result = await createBill({
      customerName: String(body.customerName || ""),
      customerPhone: String(body.customerPhone || ""),
      paymentMethod,
      gstEnabled: Boolean(body.gstEnabled),
      gstRate: Number(body.gstRate || 0),
      items,
    });

    revalidatePath("/dashboard");
    revalidatePath("/billing");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create bill." },
      { status: 400 },
    );
  }
}
