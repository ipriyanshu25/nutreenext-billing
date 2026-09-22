import { notFound } from "next/navigation";
import { getSettings } from "@/lib/db";
import { getBill } from "@/lib/queries";
import { formatDateTime, formatMoney, makeBillDisplayNumber } from "@/lib/utils";
import PrintControls from "./PrintControls";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ReceiptPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autoprint?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const bill = await getBill(id);
  if (!bill) notFound();
  const safeBill = bill!;
  const settings = await getSettings();
  const width = settings.printerWidthMm === 58 ? 58 : 80;

  return (
    <main className="receipt-page">
      <style>{`@page { size: ${width}mm auto; margin: 0; } @media print { html, body { width: ${width}mm; } }`}</style>
      <PrintControls autoPrint={query.autoprint === "1"} billId={safeBill.id} />
      <article className="receipt-sheet" style={{ width: `${width}mm`, maxWidth: "100%" }}>
        <div className="receipt-logo">
          <h1>{settings.restaurantName}</h1>
          {settings.address && <p>{settings.address}</p>}
          {settings.phone && <p>Phone: {settings.phone}</p>}
          {settings.email && <p>{settings.email}</p>}
          {safeBill.gstEnabled && settings.gstin && <p><b>GSTIN: {settings.gstin}</b> · SAC: 9963</p>}
        </div>
        <div className="receipt-rule" />
        <div style={{ textAlign: "center", fontWeight: 900, fontSize: 12 }}>{safeBill.gstEnabled ? "TAX INVOICE" : "CASH MEMO"}</div>
        <div className="receipt-rule" />
        <div className="receipt-meta">
          <span>Bill No.</span><b>#{safeBill.dailyNumber}</b>
          <span>Invoice</span><b>{makeBillDisplayNumber(safeBill.billDate, safeBill.dailyNumber)}</b>
          <span>Date</span><span>{formatDateTime(safeBill.createdAt, settings.timezone)}</span>
          <span>Payment</span><span>{safeBill.paymentMethod}</span>
          {safeBill.customerName && <><span>Customer</span><span>{safeBill.customerName}</span></>}
          {safeBill.customerPhone && <><span>Mobile</span><span>{safeBill.customerPhone}</span></>}
        </div>
        <div className="receipt-rule" />
        <table className="receipt-items">
          <thead><tr><th>Item</th><th style={{ textAlign: "center" }}>Qty</th><th style={{ textAlign: "right" }}>Amt</th></tr></thead>
          <tbody>{safeBill.items.map((item) => <tr key={item.id}>
            <td><b>{item.name}</b><div style={{ fontSize: 8 }}>{item.productId} · {formatMoney(item.unitPricePaise)}</div></td>
            <td style={{ textAlign: "center" }}>{item.quantity}</td>
            <td style={{ textAlign: "right" }}>{formatMoney(item.lineTotalPaise)}</td>
          </tr>)}</tbody>
        </table>
        <div className="receipt-rule" />
        <div className="receipt-total-row"><span>Subtotal</span><b>{formatMoney(safeBill.subtotalPaise)}</b></div>
        {safeBill.gstEnabled && <>
          <div className="receipt-total-row"><span>CGST @ {safeBill.gstRate / 2}%</span><b>{formatMoney(safeBill.cgstPaise)}</b></div>
          <div className="receipt-total-row"><span>SGST @ {safeBill.gstRate / 2}%</span><b>{formatMoney(safeBill.sgstPaise)}</b></div>
        </>}
        <div className="receipt-total-row grand"><span>GRAND TOTAL</span><span>{formatMoney(safeBill.totalPaise)}</span></div>
        <div className="receipt-rule" />
        <div className="receipt-thanks">
          <b>Freshly Made With Love ♥</b><br />
          Thank you for choosing {settings.restaurantName}.<br />
          Please visit again!
        </div>
      </article>
    </main>
  );
}
