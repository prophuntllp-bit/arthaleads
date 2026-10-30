// How a DateRangePicker value reads in a sentence ("... created in the last 30
// days"), so every figure can say what it covers. Shared by the Dashboard and
// the Performance page.
const RANGE_PHRASES = {
  today: "today", yesterday: "yesterday", todayYesterday: "today and yesterday",
  last7days: "in the last 7 days", last14days: "in the last 14 days", last28days: "in the last 28 days", last30days: "in the last 30 days",
  thisweek: "this week", lastweek: "last week", thismonth: "this month", lastmonth: "last month",
  thisyear: "this year", lastyear: "last year",
};

export function describeRange(range) {
  if (range && typeof range === "object") {
    const f = (k) => new Date(`${k}T12:00:00+05:30`).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
    return range.from && range.to ? `from ${f(range.from)} to ${f(range.to)}` : "in this period";
  }
  if (!range) return "across all time";
  return RANGE_PHRASES[range] || "in this period";
}

// The query params /leads/analytics takes for a picker value (none = all time).
export function analyticsRangeParams(range) {
  if (range && typeof range === "object") return { from: range.from, to: range.to };
  return range ? { dateRange: range } : {};
}
