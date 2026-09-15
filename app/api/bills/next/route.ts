import { NextResponse } from "next/server";
import { getSettings } from "@/lib/db";
import { getNextDailyNumber } from "@/lib/queries";
import { dateKeyInTimeZone } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET() {
  try {
    const settings = await getSettings();
    const date = dateKeyInTimeZone(new Date(), settings.timezone);
    return NextResponse.json({ date, nextDailyNumber: await getNextDailyNumber(date) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to get next bill number." },
      { status: 500 },
    );
  }
}
