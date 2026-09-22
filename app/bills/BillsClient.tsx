"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { BillListRecord } from "@/lib/queries";
import { formatDateTime, formatMoney, makeBillDisplayNumber } from "@/lib/utils";

export default function BillsClient({ bills, timezone }: { bills: BillListRecord[]; timezone: string }) {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState("newest");
  const invalidRange = Boolean(from && to && from > to);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return bills.filter((bill) => {
      const matchesSearch = !query || [
        makeBillDisplayNumber(bill.billDate, bill.dailyNumber),
        `#${bill.dailyNumber}`, bill.customerName, bill.customerPhone,
      ].some((value) => value.toLowerCase().includes(query));
      return matchesSearch && (!from || bill.billDate >= from) && (!to || bill.billDate <= to);
    }).sort((a, b) => {
      const order = a.billDate.localeCompare(b.billDate) || a.dailyNumber - b.dailyNumber;
      return sort === "oldest" ? order : -order;
    });
  }, [bills, search, from, to, sort]);

  function clearFilters() {
    setSearch("");
    setFrom("");
    setTo("");
    setSort("newest");
  }

  return (
    <main className="page-shell dashboard-v2">
      <div className="page-heading dashboard-heading">
        <div>
          <h1>All Bills</h1>
          <p>Browse every saved bill, or narrow the list with search and dates.</p>
        </div>
        <Link className="btn btn-primary" href="/billing">Generate Bill</Link>
      </div>

      <section className="card all-bills-filters" aria-label="Filter bills">
        <div className="field all-bills-search">
          <label htmlFor="bill-search">Search bills</label>
          <input id="bill-search" className="input" type="search" placeholder="Bill number, customer name or phone" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="bill-from">From date</label>
          <input id="bill-from" className="input" type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="bill-to">To date</label>
          <input id="bill-to" className="input" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="bill-sort">Sort by date</label>
          <select id="bill-sort" className="input" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
        <button className="btn btn-ghost" type="button" onClick={clearFilters}>Clear filters</button>
      </section>
      {invalidRange && <p className="notice" role="alert">From date must be on or before To date.</p>}

      <section className="card dashboard-bills-card">
        <div className="dashboard-card-head bills-card-head">
          <h2>Bill records</h2>
          <span className="period-chip" role="status">{filtered.length} of {bills.length} bills</span>
        </div>
        {filtered.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Bill</th><th>Date &amp; time</th><th>Customer</th><th>Items</th><th>Payment</th><th>GST</th><th className="number">Total</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map((bill) => (
                  <tr key={bill.id}>
                    <td><b>#{bill.dailyNumber}</b><div className="muted table-subtext">{makeBillDisplayNumber(bill.billDate, bill.dailyNumber)}</div></td>
                    <td>{formatDateTime(bill.createdAt, timezone)}</td>
                    <td>{bill.customerName || "Walk-in"}<div className="muted table-subtext">{bill.customerPhone}</div></td>
                    <td>{bill.itemCount}</td>
                    <td>{bill.paymentMethod}</td>
                    <td>{bill.gstEnabled ? `${bill.gstRate}%` : "No GST"}</td>
                    <td className="number"><b>{formatMoney(bill.totalPaise)}</b></td>
                    <td><div className="bill-row-actions">
                      <Link className="table-link" href={`/receipt/${bill.id}`} aria-label={`View bill ${makeBillDisplayNumber(bill.billDate, bill.dailyNumber)}`}>View</Link>
                      <Link className="table-link" href={`/bills/${bill.id}/edit`} aria-label={`Edit bill ${makeBillDisplayNumber(bill.billDate, bill.dailyNumber)}`}>Edit</Link>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="dashboard-empty dashboard-empty-large">
            {bills.length ? "No bills match your filters. Try another search or clear filters." : "No bills saved yet."}
          </div>
        )}
      </section>
    </main>
  );
}
