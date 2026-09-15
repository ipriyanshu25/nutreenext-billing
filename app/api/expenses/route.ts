import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { addExpense } from "@/lib/queries";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const expenseDate = String(body.expenseDate || "");
    const amountRupees = Number(body.amountRupees);
    const note = String(body.note || "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
      return NextResponse.json({ error: "Choose a valid expense date." }, { status: 400 });
    }
    if (!Number.isFinite(amountRupees) || amountRupees <= 0) {
      return NextResponse.json({ error: "Expense amount must be greater than zero." }, { status: 400 });
    }
    if (!note) {
      return NextResponse.json({ error: "Add a short expense note." }, { status: 400 });
    }

    await addExpense({
      expenseDate,
      amountPaise: Math.round(amountRupees * 100),
      note,
    });

    revalidatePath("/dashboard");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to add expense." },
      { status: 500 },
    );
  }
}
