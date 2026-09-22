import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { deleteBill, updateBill } from "@/lib/queries";

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (!body || typeof body !== "object" || !Array.isArray(body.items) ||
      typeof body.gstEnabled !== "boolean" || body.items.some((item: unknown) => !item || typeof item !== "object")) {
      return NextResponse.json({ error: "Invalid bill data." }, { status: 400 });
    }
    const result = await updateBill(id, {
      customerName: String(body.customerName || ""),
      customerPhone: String(body.customerPhone || ""),
      paymentMethod: String(body.paymentMethod || ""),
      gstEnabled: body.gstEnabled,
      gstRate: Number(body.gstRate || 0),
      items: body.items.map((item: { lineId?: unknown; itemId?: unknown; quantity?: unknown }) => ({
        lineId: item.lineId == null ? undefined : Number(item.lineId),
        itemId: item.itemId == null ? undefined : Number(item.itemId),
        quantity: Number(item.quantity),
      })),
    });
    if (!result) return NextResponse.json({ error: "Bill not found." }, { status: 404 });
    revalidatePath("/bills");
    revalidatePath("/dashboard");
    revalidatePath(`/bills/${id}/edit`);
    revalidatePath(`/receipt/${id}`);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update bill." }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const billId = String(id || "").trim();

    if (!billId) {
      return NextResponse.json({ error: "Bill ID is required." }, { status: 400 });
    }

    const deleted = await deleteBill(billId);
    if (!deleted) {
      return NextResponse.json({ error: "Bill not found." }, { status: 404 });
    }

    revalidatePath("/dashboard");
    revalidatePath("/billing");
    revalidatePath("/bills");

    return NextResponse.json({
      ok: true,
      deletedBill: deleted,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete bill." },
      { status: 500 },
    );
  }
}
