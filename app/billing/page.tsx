import BillingClient from "./BillingClient";
import { getSettings } from "@/lib/db";
import { getMenuItems, getNextDailyNumber } from "@/lib/queries";
import { dateKeyInTimeZone } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function BillingPage() {
  const settings = getSettings();
  const items = getMenuItems(true);
  const billDate = dateKeyInTimeZone(new Date(), settings.timezone);
  const nextDailyNumber = getNextDailyNumber(billDate);
  return <BillingClient initialItems={items} settings={settings} initialBillDate={billDate} initialNextNumber={nextDailyNumber} />;
}
