"use client";

import { useRouter } from "next/navigation";

type DashboardView = "today" | "day" | "month";

export default function DashboardPeriodFilter({
  view,
  today,
  selectedDay,
  selectedMonth,
}: {
  view: DashboardView;
  today: string;
  selectedDay: string;
  selectedMonth: string;
}) {
  const router = useRouter();

  function go(nextView: DashboardView, value?: string) {
    const params = new URLSearchParams();
    params.set("view", nextView);

    if (nextView === "day") params.set("day", value || selectedDay || today);
    if (nextView === "month") params.set("month", value || selectedMonth || today.slice(0, 7));

    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <div className="dashboard-period-bar" aria-label="Dashboard period">
      <div className="period-tabs" role="tablist" aria-label="Select report period">
        <button
          type="button"
          className={view === "today" ? "active" : ""}
          onClick={() => go("today")}
        >
          Today
        </button>
        <button
          type="button"
          className={view === "day" ? "active" : ""}
          onClick={() => go("day")}
        >
          Previous Day
        </button>
        <button
          type="button"
          className={view === "month" ? "active" : ""}
          onClick={() => go("month")}
        >
          Month
        </button>
      </div>

      {view === "day" && (
        <label className="period-picker">
          <span>Date</span>
          <input
            className="input"
            type="date"
            value={selectedDay}
            max={today}
            onChange={(event) => go("day", event.target.value)}
          />
        </label>
      )}

      {view === "month" && (
        <label className="period-picker">
          <span>Month</span>
          <input
            className="input"
            type="month"
            value={selectedMonth}
            max={today.slice(0, 7)}
            onChange={(event) => go("month", event.target.value)}
          />
        </label>
      )}
    </div>
  );
}
