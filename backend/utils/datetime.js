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

/**
 * End of the given IST day, as a UTC instant.
 *
 * A term paid "until the 26th" includes all of the 26th in the customer's own
 * timezone. 23:59:59.999 IST is 18:29:59.999 UTC the same day.
 */
function endOfISTDay(dateStr) {
  return new Date(`${dateStr}T18:29:59.999Z`);
}

module.exports = { IST, formatISTDate, formatISTDateShort, formatISTDateTime, endOfISTDay };
