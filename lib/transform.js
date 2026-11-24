/**
 * Pure functions for turning Stripe data into Xero statement rows.
 */

/**
 * Formats a unix timestamp (seconds) as DD/MM/YYYY, which Xero expects.
 * Uses the machine's local time zone unless one is given.
 */
export function formatDate(unixSeconds, timeZone) {
    // Assemble from parts rather than relying on the en-AU locale's layout, as
    // Node builds without full ICU data fall back to US-style MM/DD/YYYY.
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            timeZone
        })
            .formatToParts(new Date(unixSeconds * 1000))
            .map(({ type, value }) => [type, value])
    );
    return `${parts.day}/${parts.month}/${parts.year}`;
}

/**
 * Formats an amount in cents as a decimal string, e.g. 1234 -> "12.34".
 */
export function formatAmount(cents) {
    return (cents / 100).toFixed(2);
}

/**
 * Converts a Stripe balance transaction (and its charge, if any) into one
 * statement row, plus a second row for the Stripe fee when there is one.
 */
export function toRows(transaction, charge, { timeZone } = {}) {
    const date = formatDate(transaction.created, timeZone);
    const rows = [
        {
            Date: date,
            Amount: formatAmount(transaction.amount),
            Payee: charge?.customer?.description ?? "",
            Description: transaction.description ?? "",
            Reference: transaction.source ?? ""
        }
    ];

    // Fees can be negative when Stripe refunds or adjusts them.
    if (transaction.fee !== 0) {
        rows.push({
            Date: date,
            Amount: formatAmount(-transaction.fee),
            Payee: "Stripe",
            Description:
                transaction.fee > 0
                    ? "Stripe processing Fee"
                    : "Stripe processing Fee refund",
            Reference: transaction.id
        });
    }

    return rows;
}

/**
 * Parses the contents of the last date file into a unix timestamp (seconds).
 */
export function parseLastDate(contents) {
    const ms = Date.parse(contents.trim());
    if (Number.isNaN(ms)) {
        throw new Error(`Invalid last date: "${contents}"`);
    }
    return Math.floor(ms / 1000);
}

/**
 * Formats a unix timestamp (seconds) for storing in the last date file.
 */
export function formatLastDate(unixSeconds) {
    return new Date(unixSeconds * 1000).toISOString();
}

/**
 * Parses and validates the contents of config.json.
 */
export function parseConfig(text) {
    const config = JSON.parse(text);
    if (typeof config?.apiKey !== "string" || config.apiKey === "") {
        throw new Error("No apiKey set");
    }
    return config;
}

export function exportFilename(since) {
    return `stripestatement_since_${since}.csv`;
}
