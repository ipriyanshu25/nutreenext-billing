"use client";

import { FormEvent, useMemo, useState } from "react";
import type { MenuItem } from "@/lib/db";
import { formatMoney } from "@/lib/utils";

export default function ItemsClient({ initialItems }: { initialItems: MenuItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
  }, [items, search, category]);

  async function addMenuItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: String(form.get("productId") || ""),
          name: String(form.get("name") || ""),
          category: String(form.get("category") || ""),
          priceRupees: Number(form.get("priceRupees") || 0),
          costRupees: Number(form.get("costRupees") || 0),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Unable to add item.");
        return;
      }
      setItems((current) => [...current, data.item]);
      formElement.reset();
      setAddOpen(false);
    } catch {
      setError("Unable to add item. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEditedItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/items/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: String(form.get("productId") || ""),
          name: String(form.get("name") || ""),
          category: String(form.get("category") || ""),
          priceRupees: Number(form.get("priceRupees") || 0),
          costRupees: Number(form.get("costRupees") || 0),
          isActive: editing.isActive,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Unable to update item.");
        return;
      }
      setItems((current) => current.map((item) => item.id === data.item.id ? data.item : item));
      setEditing(null);
    } catch {
      setError("Unable to update item. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleItem(item: MenuItem) {
    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Unable to update item.");
        return;
      }
      setItems((current) => current.map((entry) => entry.id === data.item.id ? data.item : entry));
    } catch {
      setError("Unable to update item. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page-shell items-page">
      <div className="page-heading compact-heading">
        <div>
          <h1>Items</h1>
          <p>Add dishes, update prices and hide items that are not available.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => { setError(""); setAddOpen(true); }}>+ Add Item</button>
      </div>

      {error && <p className="notice danger page-notice">{error}</p>}

      <section className="card items-card">
        <div className="items-toolbar">
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input
              className="input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search item name or Product ID"
            />
          </div>

          <div className="category-select-wrap">
            <label htmlFor="items-category">Category</label>
            <select id="items-category" className="select" value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </div>
        </div>

        <div className="table-wrap items-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product ID</th>
                <th>Item</th>
                <th>Category</th>
                <th className="number">Selling</th>
                <th className="number">Cost</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr key={item.id} className={!item.isActive ? "item-hidden-row" : ""}>
                  <td><b className="product-id-text">{item.productId}</b></td>
                  <td><b>{item.name}</b></td>
                  <td>{item.category}</td>
                  <td className="number"><b>{formatMoney(item.pricePaise)}</b></td>
                  <td className="number">{formatMoney(item.costPaise)}</td>
                  <td>{item.isActive ? <span className="badge badge-orange">Active</span> : <span className="badge badge-gray">Hidden</span>}</td>
                  <td className="number">
                    <div className="action-row row-actions">
                      <button type="button" className="btn btn-small btn-soft" onClick={() => { setError(""); setEditing(item); }}>Edit</button>
                      <button
                        type="button"
                        className={`btn btn-small ${item.isActive ? "btn-ghost" : "btn-primary"}`}
                        disabled={saving}
                        onClick={() => toggleItem(item)}
                      >
                        {item.isActive ? "Hide" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!visibleItems.length && <div className="empty-state items-empty">No item found.</div>}
      </section>

      {addOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => event.currentTarget === event.target && setAddOpen(false)}>
          <div className="modal">
            <div className="modal-head">
              <h2>Add Item</h2>
              <button type="button" className="modal-close" onClick={() => setAddOpen(false)}>×</button>
            </div>
            <form className="modal-body" onSubmit={addMenuItem}>
              <div className="form-grid">
                <div className="field">
                  <label>Product ID <span>(optional)</span></label>
                  <input className="input" name="productId" placeholder="Auto if left blank" />
                </div>
                <div className="field">
                  <label>Category</label>
                  <input className="input" name="category" placeholder="e.g. Burgers" required />
                </div>
                <div className="field full">
                  <label>Item name</label>
                  <input className="input" name="name" placeholder="e.g. Paneer Burger" required />
                </div>
                <div className="field">
                  <label>Selling price (₹)</label>
                  <input className="input" type="number" step="0.01" min="0" name="priceRupees" required />
                </div>
                <div className="field">
                  <label>Cost price (₹)</label>
                  <input className="input" type="number" step="0.01" min="0" name="costRupees" placeholder="Used for profit" />
                </div>
              </div>

              <p className="notice">Cost price is only used to calculate profit/loss. It is never printed on the customer bill.</p>
              {error && <p className="notice danger">{error}</p>}
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
                <button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Add Item"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal-backdrop" onMouseDown={(event) => event.currentTarget === event.target && setEditing(null)}>
          <div className="modal">
            <div className="modal-head">
              <h2>Edit Item</h2>
              <button type="button" className="modal-close" onClick={() => setEditing(null)}>×</button>
            </div>
            <form className="modal-body" onSubmit={saveEditedItem}>
              <div className="form-grid">
                <div className="field">
                  <label>Product ID</label>
                  <input className="input" name="productId" defaultValue={editing.productId} required />
                </div>
                <div className="field">
                  <label>Category</label>
                  <input className="input" name="category" defaultValue={editing.category} required />
                </div>
                <div className="field full">
                  <label>Item name</label>
                  <input className="input" name="name" defaultValue={editing.name} required />
                </div>
                <div className="field">
                  <label>Selling price (₹)</label>
                  <input className="input" type="number" step="0.01" min="0" name="priceRupees" defaultValue={editing.pricePaise / 100} required />
                </div>
                <div className="field">
                  <label>Cost price (₹)</label>
                  <input className="input" type="number" step="0.01" min="0" name="costRupees" defaultValue={editing.costPaise / 100} required />
                </div>
              </div>

              <p className="notice">Cost price is only used to calculate profit/loss. It is never printed on the customer bill.</p>
              {error && <p className="notice danger">{error}</p>}
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                <button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
