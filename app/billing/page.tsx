import BillingClient from "./BillingClient";
import { getSettings } from "@/lib/db";
import { getMenuItems, getNextDailyNumber } from "@/lib/queries";
import { dateKeyInTimeZone } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function BillingPage() {
  const settings = await getSettings();
  const items = await getMenuItems(true);
  const billDate = dateKeyInTimeZone(new Date(), settings.timezone);
  const nextDailyNumber = await getNextDailyNumber(billDate);
  return <BillingClient initialItems={items} settings={settings} initialBillDate={billDate} initialNextNumber={nextDailyNumber} />;
}
