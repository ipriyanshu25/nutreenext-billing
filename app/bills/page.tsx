import { getAllBills } from "@/lib/queries";
import { getSettings } from "@/lib/db";
import BillsClient from "./BillsClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function BillsPage() {
  const [bills, settings] = await Promise.all([getAllBills(), getSettings()]);
  return <BillsClient bills={bills} timezone={settings.timezone} />;
}
