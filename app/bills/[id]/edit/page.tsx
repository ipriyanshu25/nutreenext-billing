import { notFound } from "next/navigation";
import BillingClient from "@/app/billing/BillingClient";
import { getSettings } from "@/lib/db";
import { getBill, getMenuItems } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function EditBillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bill = await getBill(id);
  if (!bill) notFound();
  const [items, settings] = await Promise.all([getMenuItems(true), getSettings()]);
  return <BillingClient key={bill.id} initialItems={items} settings={settings}
    initialBillDate={bill.billDate} initialNextNumber={bill.dailyNumber} existingBill={bill} />;
}
