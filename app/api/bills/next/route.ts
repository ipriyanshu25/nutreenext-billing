import { NextResponse } from "next/server";
import { getSettings } from "@/lib/db";
import { getNextDailyNumber } from "@/lib/queries";
import { dateKeyInTimeZone } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET() {
  const settings = getSettings();
  const date = dateKeyInTimeZone(new Date(), settings.timezone);
  return NextResponse.json({ date, nextDailyNumber: getNextDailyNumber(date) });
}
