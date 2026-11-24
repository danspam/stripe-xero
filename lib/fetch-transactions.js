import { toRows } from "./transform.js";

/**
 * Fetches every balance transaction created after `since` (unix seconds) and
 * converts them to statement rows.
 *
 * Returns the rows, the number of transactions, and the `created` time of the
 * latest transaction (or `since` if there were none).
 */
export async function fetchRows(stripe, since, { logger, timeZone } = {}) {
    const rows = [];
    let count = 0;
    let latest = since;

    // Iterating the list auto-paginates through every page of results.
    for await (const transaction of stripe.balanceTransactions.list({
        created: { gt: since },
        limit: 100
    })) {
        let charge = null;
        if (transaction.type === "charge") {
            try {
                charge = await stripe.charges.retrieve(transaction.source, {
                    expand: ["customer"]
                });
            } catch (err) {
                logger?.warn(
                    `Could not look up charge ${transaction.source} for ${transaction.id}, payee left blank: ${err.message}`
                );
            }
        }
        rows.push(...toRows(transaction, charge, { timeZone }));
        count++;
        latest = Math.max(latest, transaction.created);
    }

    return { rows, count, latest };
}
