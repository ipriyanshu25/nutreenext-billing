import Link from "next/link";
import DashboardActions from "./DashboardActions";
import DashboardPeriodFilter from "./DashboardPeriodFilter";
import BillDeleteButton from "./BillDeleteButton";
import { getDashboardData } from "@/lib/queries";
import { getSettings } from "@/lib/db";
import {
  dateKeyInTimeZone,
  formatDateTime,
  formatMoney,
  makeBillDisplayNumber,
  monthKeyInTimeZone,
  sanitizeDateKey,
  sanitizeMonthKey,
} from "@/lib/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DashboardView = "today" | "day" | "month";

type TrendPoint = {
  date: string;
  salesPaise: number;
  billCount: number;
};

function formatDayLabel(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, date)));
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function buildMonthSeries(monthKey: string, trend: TrendPoint[]) {
  const [year, month] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const map = new Map(trend.map((point) => [point.date, point]));

  return Array.from({ length: daysInMonth }, (_, index) => {
    const dayNumber = index + 1;
    const date = `${monthKey}-${String(dayNumber).padStart(2, "0")}`;
    const row = map.get(date);
    return {
      date,
      dayNumber,
      salesPaise: row?.salesPaise ?? 0,
      billCount: row?.billCount ?? 0,
    };
  });
}

function PaymentBars({
  rows,
}: {
  rows: Array<{ method: string; bills: number; amountPaise: number }>;
}) {
  const max = Math.max(1, ...rows.map((row) => row.amountPaise));

  if (!rows.length) {
    return <div className="chart-empty">No payments recorded for this period.</div>;
  }

  return (
    <div className="payment-bars">
      {rows.map((row) => {
        const width = Math.max(4, Math.round((row.amountPaise / max) * 100));
        return (
          <div className="payment-bar-row" key={row.method}>
            <div className="payment-bar-label">
              <span>{row.method}</span>
              <b>{formatMoney(row.amountPaise)}</b>
            </div>
            <div className="payment-track" aria-label={`${row.method}: ${formatMoney(row.amountPaise)}`}>
              <span style={{ width: `${width}%` }} />
            </div>
            <small>{row.bills} bill{row.bills === 1 ? "" : "s"}</small>
          </div>
        );
      })}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; day?: string; month?: string }>;
}) {
  const params = await searchParams;
  const settings = await getSettings();
  const today = dateKeyInTimeZone(new Date(), settings.timezone);
  const currentMonth = monthKeyInTimeZone(new Date(), settings.timezone);

  const requestedView = params.view;
  const view: DashboardView =
    requestedView === "day" || requestedView === "month" || requestedView === "today"
      ? requestedView
      : "today";

  const selectedDay = view === "today" ? today : sanitizeDateKey(params.day, today);
  const selectedMonth = sanitizeMonthKey(params.month, currentMonth);
  const data = await getDashboardData(selectedDay, selectedMonth);

  const summary = view === "month" ? data.month : data.day;
  const profitPaise = summary.subtotalPaise - summary.cogsPaise - summary.expensePaise;
  const averageBillPaise = summary.billCount ? Math.round(summary.subtotalPaise / summary.billCount) : 0;
  const topItems = view === "month" ? data.monthTopItems : data.dayTopItems;
  const paymentMix = view === "month" ? data.monthPaymentMix : data.dayPaymentMix;
  const missingCostLines = view === "month" ? data.monthMissingCostLines : data.dayMissingCostLines;
  const scopeLabel =
    view === "month"
      ? formatMonthLabel(selectedMonth)
      : view === "today"
        ? `Today · ${formatDayLabel(today)}`
        : formatDayLabel(selectedDay);

  const monthSeries = buildMonthSeries(selectedMonth, data.dailyTrend);
  const maxMonthSales = Math.max(0, ...monthSeries.map((point) => point.salesPaise));
  const monthChartDivisor = Math.max(1, maxMonthSales);
  const activeDays = monthSeries.filter((point) => point.billCount > 0);

  return (
    <main className="page-shell dashboard-page dashboard-v2">
      <div className="page-heading dashboard-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Sales and profit overview for {scopeLabel}.</p>
        </div>
        <DashboardActions settings={settings} selectedDay={selectedDay} />
      </div>

      <DashboardPeriodFilter
        view={view}
        today={today}
        selectedDay={selectedDay}
        selectedMonth={selectedMonth}
      />

      <section className="dashboard-stat-grid">
        <article className="metric-card primary-metric">
          <span className="metric-label">Sales before GST</span>
          <strong>{formatMoney(summary.subtotalPaise)}</strong>
          <small>{scopeLabel}</small>
        </article>

        <article className="metric-card">
          <span className="metric-label">{profitPaise >= 0 ? "Profit" : "Loss"}</span>
          <strong className={profitPaise < 0 ? "metric-loss" : ""}>{formatMoney(Math.abs(profitPaise))}</strong>
          <small>After item cost and expenses</small>
        </article>

        <article className="metric-card">
          <span className="metric-label">Bills</span>
          <strong>{summary.billCount.toLocaleString("en-IN")}</strong>
          <small>Saved bills in this period</small>
        </article>

        <article className="metric-card">
          <span className="metric-label">Average bill</span>
          <strong>{formatMoney(averageBillPaise)}</strong>
          <small>Average sales before GST</small>
        </article>
      </section>

      {missingCostLines > 0 && (
        <div className="cost-warning">
          <b>Profit may be higher than the real value.</b>
          <span>{missingCostLines} sold item line{missingCostLines === 1 ? " has" : "s have"} ₹0 cost. Add cost prices from Items.</span>
          <Link href="/items">Open Items</Link>
        </div>
      )}

      <section className="dashboard-main-grid">
        <article className="card dashboard-visual-card">
          <div className="dashboard-card-head">
            <div>
              <span className="eyebrow">{view === "month" ? "Sales trend" : "Payments"}</span>
              <h2>{view === "month" ? "Daily sales this month" : "Payment breakdown"}</h2>
            </div>
            <span className="period-chip">{scopeLabel}</span>
          </div>

          {view === "month" ? (
            <div className="month-chart" aria-label={`Daily sales for ${scopeLabel}`}>
              <div className="month-chart-bars" style={{ gridTemplateColumns: `repeat(${monthSeries.length}, minmax(5px, 1fr))` }}>
                {monthSeries.map((point) => {
                  const height = point.salesPaise > 0
                    ? Math.max(5, Math.round((point.salesPaise / monthChartDivisor) * 100))
                    : 0;
                  const showLabel = point.dayNumber === 1 || point.dayNumber % 5 === 0 || point.dayNumber === monthSeries.length;
                  return (
                    <div className="month-bar-column" key={point.date} title={`${formatDayLabel(point.date)} · ${formatMoney(point.salesPaise)} · ${point.billCount} bills`}>
                      <div className="month-bar-track">
                        <span className="month-bar-fill" style={{ height: `${height}%` }} />
                      </div>
                      <small>{showLabel ? point.dayNumber : ""}</small>
                    </div>
                  );
                })}
              </div>
              <div className="chart-axis-labels">
                <span>Day of month</span>
                <span>Highest day: {formatMoney(maxMonthSales)}</span>
              </div>
            </div>
          ) : (
            <PaymentBars rows={paymentMix} />
          )}
        </article>

        <article className="card finance-card">
          <div className="dashboard-card-head compact-card-head">
            <div>
              <span className="eyebrow">Financial summary</span>
              <h2>{scopeLabel}</h2>
            </div>
          </div>
          <div className="finance-lines">
            <div><span>Sales before GST</span><b>{formatMoney(summary.subtotalPaise)}</b></div>
            <div><span>GST collected</span><b>{formatMoney(summary.taxPaise)}</b></div>
            <div><span>Total collected</span><b>{formatMoney(summary.collectedPaise)}</b></div>
            <div><span>Item cost</span><b>− {formatMoney(summary.cogsPaise)}</b></div>
            <div><span>Other expenses</span><b>− {formatMoney(summary.expensePaise)}</b></div>
            <div className="finance-total">
              <span>{profitPaise >= 0 ? "Net profit" : "Net loss"}</span>
              <b className={profitPaise < 0 ? "metric-loss" : ""}>{formatMoney(Math.abs(profitPaise))}</b>
            </div>
          </div>
        </article>
      </section>

      <section className="dashboard-secondary-grid">
        <article className="card ranking-card">
          <div className="dashboard-card-head compact-card-head">
            <div>
              <span className="eyebrow">Best sellers</span>
              <h2>Top items</h2>
            </div>
          </div>
          {topItems.length ? (
            <div className="ranking-list">
              {topItems.map((item, index) => (
                <div className="ranking-row" key={item.productId}>
                  <span className="rank-number">{index + 1}</span>
                  <div className="rank-item">
                    <b>{item.name}</b>
                    <small>{item.productId} · {item.qty} sold</small>
                  </div>
                  <strong>{formatMoney(item.revenuePaise)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="dashboard-empty">No item sales for this period.</div>
          )}
        </article>

        {view === "month" ? (
          <article className="card activity-card">
            <div className="dashboard-card-head compact-card-head">
              <div>
                <span className="eyebrow">Daily performance</span>
                <h2>Days with sales</h2>
              </div>
            </div>
            {activeDays.length ? (
              <div className="compact-table-wrap">
                <table className="compact-dashboard-table">
                  <thead>
                    <tr><th>Date</th><th className="number">Bills</th><th className="number">Sales</th></tr>
                  </thead>
                  <tbody>
                    {activeDays.slice().reverse().map((point) => (
                      <tr key={point.date}>
                        <td><Link href={`/dashboard?view=day&day=${point.date}`}>{formatDayLabel(point.date)}</Link></td>
                        <td className="number">{point.billCount}</td>
                        <td className="number"><b>{formatMoney(point.salesPaise)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="dashboard-empty">No sales recorded this month.</div>
            )}
          </article>
        ) : (
          <article className="card activity-card">
            <div className="dashboard-card-head compact-card-head">
              <div>
                <span className="eyebrow">Expenses</span>
                <h2>Expenses for this day</h2>
              </div>
            </div>
            {data.dayExpenses.length ? (
              <div className="expense-mini-list">
                {data.dayExpenses.map((expense) => (
                  <div key={expense.id}>
                    <span>{expense.note}</span>
                    <b>{formatMoney(expense.amountPaise)}</b>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dashboard-empty">No expenses recorded for this day.</div>
            )}
          </article>
        )}
      </section>

      {view !== "month" && (
        <section className="card dashboard-bills-card">
          <div className="dashboard-card-head bills-card-head">
            <div>
              <span className="eyebrow">Bill records</span>
              <h2>{scopeLabel}</h2>
            </div>
            <span className="period-chip">{data.bills.length} bill{data.bills.length === 1 ? "" : "s"}</span>
          </div>

          {data.bills.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Bill</th>
                    <th>Time</th>
                    <th>Items</th>
                    <th>Payment</th>
                    <th>GST</th>
                    <th className="number">Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.bills.map((bill) => (
                    <tr key={bill.id}>
                      <td>
                        <b>#{bill.dailyNumber}</b>
                        <div className="muted table-subtext">{makeBillDisplayNumber(bill.billDate, bill.dailyNumber)}</div>
                      </td>
                      <td>{formatDateTime(bill.createdAt, settings.timezone)}</td>
                      <td>{bill.itemCount}</td>
                      <td>{bill.paymentMethod}</td>
                      <td>{bill.gstEnabled ? `${bill.gstRate}%` : "No GST"}</td>
                      <td className="number"><b>{formatMoney(bill.totalPaise)}</b></td>
                      <td className="number">
                        <div className="bill-row-actions">
                          <Link className="table-link" href={`/receipt/${bill.id}`}>View</Link>
                          <BillDeleteButton billId={bill.id} billNumber={bill.dailyNumber} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="dashboard-empty dashboard-empty-large">No bills saved for this date.</div>
          )}
        </section>
      )}
    </main>
  );
}
