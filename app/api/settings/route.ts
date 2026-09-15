import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db, getSettings } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getSettings());
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const restaurantName = String(body.restaurantName || "").trim();
    const address = String(body.address || "").trim();
    const phone = String(body.phone || "").trim();
    const email = String(body.email || "").trim();
    const gstin = String(body.gstin || "").trim().toUpperCase();
    const defaultGstRate = Number(body.defaultGstRate);
    const printerWidthMm = Number(body.printerWidthMm);

    if (!restaurantName) return NextResponse.json({ error: "Restaurant name is required." }, { status: 400 });
    if (![5, 18].includes(defaultGstRate)) return NextResponse.json({ error: "Default GST rate must be 5% or 18%." }, { status: 400 });
    if (![58, 80].includes(printerWidthMm)) return NextResponse.json({ error: "Printer width must be 58 mm or 80 mm." }, { status: 400 });
    if (gstin && !/^[0-9A-Z]{15}$/.test(gstin)) return NextResponse.json({ error: "GSTIN must be 15 letters/numbers." }, { status: 400 });

    db.prepare(`
      UPDATE business_settings SET
        restaurant_name = ?, address = ?, phone = ?, email = ?, gstin = ?,
        default_gst_rate = ?, printer_width_mm = ?
      WHERE id = 1
    `).run(restaurantName, address, phone, email, gstin, defaultGstRate, printerWidthMm);

    revalidatePath("/dashboard");
    revalidatePath("/billing");
    return NextResponse.json({ ok: true, settings: getSettings() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save settings." }, { status: 500 });
  }
}
