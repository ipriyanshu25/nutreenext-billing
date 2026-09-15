const DEFAULT_TZ = "Asia/Kolkata";

export function formatMoney(paise: number, symbol = "₹") {
  return `${symbol}${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function dateKeyInTimeZone(date = new Date(), timezone = DEFAULT_TZ) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function monthKeyInTimeZone(date = new Date(), timezone = DEFAULT_TZ) {
  return dateKeyInTimeZone(date, timezone).slice(0, 7);
}

export function formatDateTime(iso: string, timezone = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function sanitizeDateKey(value: string | undefined, fallback: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

export function sanitizeMonthKey(value: string | undefined, fallback: string) {
  return value && /^\d{4}-\d{2}$/.test(value) ? value : fallback;
}

export function makeBillDisplayNumber(dateKey: string, dailyNumber: number) {
  return `NN-${dateKey.replaceAll("-", "")}-${String(dailyNumber).padStart(3, "0")}`;
}
