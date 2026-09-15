"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { BusinessSettings } from "@/lib/db";

export default function DashboardActions({ settings, selectedDay }: { settings: BusinessSettings; selectedDay: string }) {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function saveSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true); setError("");
    const form = new FormData(e.currentTarget);
    const payload = {
      restaurantName: String(form.get("restaurantName") || ""),
      address: String(form.get("address") || ""),
      phone: String(form.get("phone") || ""),
      email: String(form.get("email") || ""),
      gstin: String(form.get("gstin") || ""),
      defaultGstRate: Number(form.get("defaultGstRate") || 5),
      printerWidthMm: Number(form.get("printerWidthMm") || 80),
    };
    const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data.error || "Unable to save settings.");
    setSettingsOpen(false);
    router.refresh();
  }

  async function addExpense(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true); setError("");
    const form = new FormData(e.currentTarget);
    const payload = {
      expenseDate: String(form.get("expenseDate") || selectedDay),
      amountRupees: Number(form.get("amountRupees") || 0),
      note: String(form.get("note") || ""),
    };
    const res = await fetch("/api/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data.error || "Unable to add expense.");
    setExpenseOpen(false);
    router.refresh();
  }

  return (
    <>
      <div className="action-row dashboard-actions">
        <button className="btn btn-soft btn-compact" onClick={() => { setError(""); setExpenseOpen(true); }}>+ Expense</button>
        <button className="btn btn-ghost btn-compact" onClick={() => { setError(""); setSettingsOpen(true); }}>Settings</button>
      </div>

      {expenseOpen && (
        <div className="modal-backdrop" onMouseDown={(e) => e.currentTarget === e.target && setExpenseOpen(false)}>
          <div className="modal">
            <div className="modal-head"><h2>Add business expense</h2><button className="modal-close" onClick={() => setExpenseOpen(false)}>×</button></div>
            <form className="modal-body" onSubmit={addExpense}>
              <div className="form-grid">
                <div className="field"><label>Date</label><input className="input" type="date" name="expenseDate" defaultValue={selectedDay} required /></div>
                <div className="field"><label>Amount (₹)</label><input className="input" type="number" min="0.01" step="0.01" name="amountRupees" placeholder="e.g. 850" required /></div>
                <div className="field full"><label>Expense note</label><input className="input" name="note" placeholder="e.g. Vegetables, gas cylinder, packaging" required /></div>
              </div>
              {error && <p className="notice danger">{error}</p>}
              <div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={() => setExpenseOpen(false)}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save Expense"}</button></div>
            </form>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="modal-backdrop" onMouseDown={(e) => e.currentTarget === e.target && setSettingsOpen(false)}>
          <div className="modal">
            <div className="modal-head"><h2>Business & print settings</h2><button className="modal-close" onClick={() => setSettingsOpen(false)}>×</button></div>
            <form className="modal-body" onSubmit={saveSettings}>
              <div className="form-grid">
                <div className="field"><label>Restaurant name</label><input className="input" name="restaurantName" defaultValue={settings.restaurantName} required /></div>
                <div className="field"><label>Phone</label><input className="input" name="phone" defaultValue={settings.phone} /></div>
                <div className="field full"><label>Address</label><input className="input" name="address" defaultValue={settings.address} placeholder="Printed on the bill" /></div>
                <div className="field"><label>Email</label><input className="input" type="email" name="email" defaultValue={settings.email} /></div>
                <div className="field"><label>GSTIN</label><input className="input" name="gstin" defaultValue={settings.gstin} placeholder="Required before GST billing" /></div>
                <div className="field"><label>Default GST rate</label><select className="select" name="defaultGstRate" defaultValue={String(settings.defaultGstRate)}><option value="5">5% total (2.5% + 2.5%)</option><option value="18">18% total (9% + 9%)</option></select></div>
                <div className="field"><label>Thermal paper width</label><select className="select" name="printerWidthMm" defaultValue={String(settings.printerWidthMm)}><option value="58">58 mm (portable / small roll)</option><option value="80">80 mm</option></select></div>
              </div>
              <p className="notice">For a normal standalone restaurant, 5% GST is generally the applicable restaurant-service rate without input tax credit. Use 18% only when your business falls under the applicable 18% category. The system always treats the selected rate as the <b>total</b> GST and splits it equally into CGST and SGST.</p>
              {error && <p className="notice danger">{error}</p>}
              <div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={() => setSettingsOpen(false)}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save Settings"}</button></div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
