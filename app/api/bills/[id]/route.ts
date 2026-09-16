import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { deleteBill } from "@/lib/queries";

export const runtime = "nodejs";

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
