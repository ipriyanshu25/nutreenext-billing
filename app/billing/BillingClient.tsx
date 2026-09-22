"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { BusinessSettings, MenuItem } from "@/lib/db";
import type { BillRecord } from "@/lib/queries";
import { formatMoney, makeBillDisplayNumber } from "@/lib/utils";

type BillMeta = {
  customerName: string;
  customerPhone: string;
  paymentMethod: "Cash" | "UPI" | "Card";
  gstEnabled: boolean;
  gstRate: number;
};

export default function BillingClient({ initialItems, settings, initialBillDate, initialNextNumber, existingBill }: {
  initialItems: MenuItem[];
  settings: BusinessSettings;
  initialBillDate: string;
  initialNextNumber: number;
  existingBill?: BillRecord;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<Record<number, number>>(() => Object.fromEntries(
    (existingBill?.items || []).map((line) => [-line.id, line.quantity]),
  ));
  const [checkoutOpen, setCheckoutOpen] = useState(Boolean(existingBill));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState<BillMeta>({
    customerName: existingBill?.customerName || "",
    customerPhone: existingBill?.customerPhone || "",
    paymentMethod: (existingBill?.paymentMethod || "Cash") as BillMeta["paymentMethod"],
    gstEnabled: existingBill?.gstEnabled || false,
    gstRate: existingBill?.gstEnabled ? existingBill.gstRate : settings.defaultGstRate,
  });

  const items = useMemo(() => {
    // Negative UI IDs identify saved bill lines, independently of current menu IDs.
    const originalItems: MenuItem[] = (existingBill?.items || []).map((line) => ({
      id: -line.id, productId: line.productId, name: line.name, category: line.category,
      pricePaise: line.unitPricePaise, costPaise: line.unitCostPaise, isActive: true,
    }));
    const originalMenuIds = new Set(existingBill?.items.map((line) => line.menuItemId));
    return [...originalItems, ...initialItems.filter((item) => item.isActive && !originalMenuIds.has(item.id))];
  }, [initialItems, existingBill]);
  const categories = useMemo(
    () => ["All", ...Array.from(new Set(items.map((item) => item.category))).sort()],
    [items],
  );

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory = category === "All" || item.category === category;
      const matchesSearch = !q || `${item.productId} ${item.name} ${item.category}`.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [items, category, search]);

  const cartLines = useMemo(() => Object.entries(cart).map(([id, quantity]) => {
    const item = items.find((entry) => entry.id === Number(id));
    return item ? { item, quantity } : null;
  }).filter(Boolean) as Array<{ item: MenuItem; quantity: number }>, [cart, items]);

  const itemQty = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotalPaise = cartLines.reduce((sum, line) => sum + line.item.pricePaise * line.quantity, 0);
  const totalTaxPaise = meta.gstEnabled ? Math.round(subtotalPaise * meta.gstRate / 100) : 0;
  const cgstPaise = Math.floor(totalTaxPaise / 2);
  const sgstPaise = totalTaxPaise - cgstPaise;
  const totalPaise = subtotalPaise + totalTaxPaise;

  function updateMeta<K extends keyof BillMeta>(key: K, value: BillMeta[K]) {
    setMeta((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function addItem(itemId: number) {
    setCart((current) => ({ ...current, [itemId]: (current[itemId] || 0) + 1 }));
    setError("");
  }

  function changeQty(itemId: number, delta: number) {
    setCart((current) => {
      const next = { ...current };
      const quantity = (next[itemId] || 0) + delta;
      if (quantity <= 0) delete next[itemId];
      else next[itemId] = quantity;
      return next;
    });
    setError("");
  }

  async function completeBill() {
    if (saving) return;
    if (!cartLines.length) {
      setError("Add at least one item to the bill.");
      return;
    }

    if (meta.gstEnabled && !settings.gstin.trim()) {
      setError("GSTIN is not set. Add it from Dashboard → Business Settings or turn GST off for this bill.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(existingBill ? `/api/bills/${encodeURIComponent(existingBill.id)}` : "/api/bills", {
        method: existingBill ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...meta,
          items: cartLines.map((line) => line.item.id < 0
            ? { lineId: -line.item.id, quantity: line.quantity }
            : { itemId: line.item.id, quantity: line.quantity }),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Unable to save bill.");
        return;
      }

      window.location.assign(`/receipt/${encodeURIComponent(existingBill?.id || data.id)}?autoprint=1`);
    } catch {
      setError("Unable to save the bill. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page-shell billing-page generate-bill-page">
      <div className="page-heading compact-heading">
        <div>
          <h1>{existingBill ? "Edit Bill" : "Generate Bill"}</h1>
          <p>{existingBill
            ? `Update ${makeBillDisplayNumber(initialBillDate, initialNextNumber)} and print the updated receipt.`
            : "Search items, add quantities, then review and print the bill."}</p>
          {existingBill && <Link className="table-link" href="/bills">Cancel editing</Link>}
        </div>
        <button
          type="button"
          className="btn btn-primary bill-review-top"
          disabled={!itemQty}
          onClick={() => { setError(""); setCheckoutOpen(true); }}
        >
          Review Bill ({itemQty})
        </button>
      </div>

      <section className="card billing-list-card">
        <div className="generate-toolbar">
          <div className="search-wrap generate-search">
            <span className="search-icon">⌕</span>
            <input
              className="input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search item name or Product ID"
              autoFocus
            />
          </div>

          <div className="category-select-wrap">
            <label htmlFor="category-filter">Category</label>
            <select
              id="category-filter"
              className="select"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {categories.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </div>
        </div>

        <div className="menu-list simplified-menu-list">
          <div className="menu-list-head">
            <span>Code</span>
            <span>Item</span>
            <span>Price</span>
            <span>Add</span>
          </div>

          {visibleItems.map((item) => {
            const selectedQty = cart[item.id] || 0;
            return (
              <div className={`menu-row ${selectedQty ? "selected" : ""}`} key={item.id}>
                <div className="menu-code">{item.productId}</div>
                <div className="menu-name-wrap">
                  <b>{item.name}</b>
                  <small>{item.category}{selectedQty > 0 ? ` · ${selectedQty} added` : ""}</small>
                </div>
                <div className="menu-row-price">{formatMoney(item.pricePaise)}</div>
                {selectedQty > 0 ? (
                  <div className="qty-control menu-qty-control">
                    <button type="button" onClick={() => changeQty(item.id, -1)} aria-label={`Decrease ${item.name}`}>−</button>
                    <span>{selectedQty}</span>
                    <button type="button" onClick={() => changeQty(item.id, 1)} aria-label={`Increase ${item.name}`}>+</button>
                  </div>
                ) : (
                  <button type="button" className="btn btn-small btn-primary" onClick={() => addItem(item.id)}>+ Add</button>
                )}
              </div>
            );
          })}
        </div>

        {!visibleItems.length && <div className="empty-state menu-empty">No item found.</div>}
      </section>

      <div className="bill-dock no-print">
        <div className="bill-dock-summary">
          <span>{itemQty ? `${itemQty} item${itemQty === 1 ? "" : "s"} in bill` : "Bill is empty"}</span>
          <b>{formatMoney(totalPaise)}</b>
        </div>
        <button
          type="button"
          className="btn btn-primary bill-dock-button"
          disabled={!itemQty}
          onClick={() => { setError(""); setCheckoutOpen(true); }}
        >
          {existingBill ? "Review Updated Bill" : "Review & Print Bill"}
        </button>
      </div>

      {checkoutOpen && (
        <div className="modal-backdrop checkout-backdrop" onMouseDown={(event) => event.currentTarget === event.target && setCheckoutOpen(false)}>
          <div className="modal checkout-modal" role="dialog" aria-modal="true" aria-label="Current bill">
            <div className="modal-head checkout-head">
              <div>
                <span className="bill-label">{existingBill ? "EDITING SAVED BILL" : "CURRENT BILL"}</span>
                <h2>Bill #{initialNextNumber}</h2>
                <small>{makeBillDisplayNumber(initialBillDate, initialNextNumber)}</small>
              </div>
              <button className="modal-close" type="button" onClick={() => setCheckoutOpen(false)} aria-label="Close bill">×</button>
            </div>

            <div className="checkout-scroll">
              <div className="checkout-section">
                <div className="bill-detail-grid">
                  <div className="field">
                    <label>Customer name <span>(optional)</span></label>
                    <input
                      className="input"
                      value={meta.customerName}
                      onChange={(event) => updateMeta("customerName", event.target.value)}
                      placeholder="Walk-in customer"
                    />
                  </div>

                  <div className="field">
                    <label>Mobile <span>(optional)</span></label>
                    <input
                      className="input"
                      value={meta.customerPhone}
                      onChange={(event) => updateMeta("customerPhone", event.target.value)}
                      placeholder="10-digit number"
                      inputMode="numeric"
                    />
                  </div>

                  <div className="field full">
                    <label>Payment method</label>
                    <select
                      className="select"
                      value={meta.paymentMethod}
                      onChange={(event) => updateMeta("paymentMethod", event.target.value as BillMeta["paymentMethod"])}
                    >
                      <option>Cash</option>
                      <option>UPI</option>
                      <option>Card</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="checkout-section checkout-gst-section">
                <label className="gst-toggle-row">
                  <input
                    type="checkbox"
                    checked={meta.gstEnabled}
                    onChange={(event) => updateMeta("gstEnabled", event.target.checked)}
                  />
                  <span>
                    <b>Include GST</b>
                    <small>Add GST on top of menu prices</small>
                  </span>
                </label>

                {meta.gstEnabled && (
                  <div className="field gst-rate-field">
                    <label>GST rate</label>
                    <select
                      className="select"
                      value={String(meta.gstRate)}
                      onChange={(event) => updateMeta("gstRate", Number(event.target.value))}
                    >
                      <option value="5">5% total (2.5% CGST + 2.5% SGST)</option>
                      <option value="18">18% total (9% CGST + 9% SGST)</option>
                    </select>
                  </div>
                )}

                {meta.gstEnabled && !settings.gstin.trim() && (
                  <div className="inline-warning">GSTIN is not set. Add it in Dashboard → Business Settings.</div>
                )}
              </div>

              <div className="checkout-items-head">
                <span>Items</span>
                <span>{itemQty} qty</span>
              </div>

              <div className="checkout-items">
                {cartLines.length ? cartLines.map(({ item, quantity }) => (
                  <div className="cart-row" key={item.id}>
                    <div className="cart-row-info">
                      <b>{item.name}</b>
                      <small>{item.productId} · {formatMoney(item.pricePaise)}</small>
                    </div>
                    <div className="qty-control">
                      <button type="button" onClick={() => changeQty(item.id, -1)}>−</button>
                      <span>{quantity}</span>
                      <button type="button" onClick={() => changeQty(item.id, 1)}>+</button>
                    </div>
                    <b className="cart-line-total">{formatMoney(item.pricePaise * quantity)}</b>
                    <button
                      type="button"
                      className="remove-x"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => changeQty(item.id, -quantity)}
                    >
                      ×
                    </button>
                  </div>
                )) : (
                  <div className="cart-empty">No items added yet. Close this window and add items from the list.</div>
                )}
              </div>
            </div>

            <div className="checkout-footer">
              {error && <p className="notice danger checkout-error">{error}</p>}

              <div className="total-row"><span>Subtotal</span><b>{formatMoney(subtotalPaise)}</b></div>
              {meta.gstEnabled && (
                <>
                  <div className="total-row"><span>CGST @ {meta.gstRate / 2}%</span><b>{formatMoney(cgstPaise)}</b></div>
                  <div className="total-row"><span>SGST @ {meta.gstRate / 2}%</span><b>{formatMoney(sgstPaise)}</b></div>
                </>
              )}
              <div className="total-row grand"><span>Total</span><span>{formatMoney(totalPaise)}</span></div>

              <div className="checkout-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setCheckoutOpen(false)}>Add More Items</button>
                <button
                  type="button"
                  className="btn btn-primary save-print-btn"
                  disabled={!cartLines.length || saving || (meta.gstEnabled && !settings.gstin.trim())}
                  onClick={completeBill}
                >
                  {saving ? "Saving Bill…" : existingBill ? "Update & Print Bill" : "Save & Print Bill"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
