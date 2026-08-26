// utils/datetime.js
// Date formatting for an Indian audience.
//
// The server runs in UTC, so toLocaleDateString("en-IN") without an explicit
// timeZone formats the UTC instant and can name the wrong day: a term ending
// 23:59 IST on the 26th is 18:29 UTC on the 26th, but one ending 23:59 UTC on
// the 26th is 05:29 IST on the 27th. Customers, invoices and support
// conversations are all in IST, so that off-by-one is a real
// "my subscription says the wrong date" bug rather than a cosmetic one.

const IST = "Asia/Kolkata";

/** "26 August 2027" */
function formatISTDate(d, opts = {}) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric", timeZone: IST, ...opts,
  });
}

/** "26 Aug 2027" */
const formatISTDateShort = (d) => formatISTDate(d, { month: "short" });

/** "26 August 2027, 11:59 pm" */
function formatISTDateTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: IST,
  });
}

/** "11:59 pm" */
function formatISTTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", timeZone: IST,
  });
}

/**
 * "2027-08-26" — the IST calendar day, for filenames, log lines and CSV cells.
 *
 * toISOString().slice(0, 10) is the UTC day, which rolls over at 05:30 IST.
 * A lead created at 00:30 IST on the 2nd exports as the 1st under that, so
 * anything a customer reads must go through here instead. en-CA is used only
 * because it is the locale that formats as YYYY-MM-DD.
 */
function istDateKey(d = new Date()) {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: IST });
}

/**
 * End of the given IST day, as a UTC instant.
 *
 * A term paid "until the 26th" includes all of the 26th in the customer's own
 * timezone. 23:59:59.999 IST is 18:29:59.999 UTC the same day.
 */
function endOfISTDay(dateStr) {
  return new Date(`${dateStr}T18:29:59.999Z`);
}

module.exports = {
  IST, formatISTDate, formatISTDateShort, formatISTDateTime, formatISTTime, istDateKey, endOfISTDay,
};
