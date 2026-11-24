import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { fetchRows } from "../lib/fetch-transactions.js";

const timeZone = "Australia/Brisbane";
const base = Date.parse("2024-05-01T00:00:00Z") / 1000;

function makeTransactions(count) {
    return Array.from({ length: count }, (_, i) => ({
        id: `txn_${i}`,
        created: base + i * 60,
        amount: 1000,
        fee: 50,
        type: "charge",
        source: `ch_${i}`,
        description: `Payment ${i}`
    }));
}

/**
 * A fake Stripe client. The list result is an async iterable, like the real
 * SDK's auto-paginating list, and yields newest first.
 */
function fakeStripe(transactions, { failCharges = [] } = {}) {
    return {
        balanceTransactions: {
            list: mock.fn(({ created }) => {
                const items = transactions
                    .filter((t) => t.created > created.gt)
                    .toReversed();
                return (async function* () {
                    yield* items;
                })();
            })
        },
        charges: {
            retrieve: mock.fn(async (id) => {
                if (failCharges.includes(id)) {
                    throw new Error("No such charge");
                }
                return { id, customer: { description: `Customer ${id}` } };
            })
        }
    };
}

describe("fetchRows", () => {
    it("returns rows for every transaction across multiple pages", async () => {
        const stripe = fakeStripe(makeTransactions(250));
        const result = await fetchRows(stripe, base - 1, { timeZone });

        assert.equal(result.count, 250);
        assert.equal(result.rows.length, 500);
        assert.equal(result.latest, base + 249 * 60);
    });

    it("requests transactions after `since` with a valid page size", async () => {
        const stripe = fakeStripe(makeTransactions(5));
        await fetchRows(stripe, base + 120, { timeZone });

        const [args] = stripe.balanceTransactions.list.mock.calls[0].arguments;
        assert.deepEqual(args.created, { gt: base + 120 });
        assert.ok(args.limit <= 100);
    });

    it("only includes transactions created after `since`", async () => {
        const stripe = fakeStripe(makeTransactions(5));
        const result = await fetchRows(stripe, base + 120, { timeZone });

        assert.equal(result.count, 2);
        assert.deepEqual(
            result.rows.map((r) => r.Reference).filter((r) => r.startsWith("ch_")),
            ["ch_4", "ch_3"]
        );
    });

    it("returns `since` as latest when there are no new transactions", async () => {
        const stripe = fakeStripe([]);
        const result = await fetchRows(stripe, base, { timeZone });

        assert.deepEqual(result, { rows: [], count: 0, latest: base });
    });

    it("looks up the customer for charges only", async () => {
        const transactions = makeTransactions(2);
        transactions[1] = { ...transactions[1], type: "payout", source: "po_1" };
        const stripe = fakeStripe(transactions);
        const result = await fetchRows(stripe, base - 1, { timeZone });

        assert.equal(stripe.charges.retrieve.mock.callCount(), 1);
        assert.deepEqual(stripe.charges.retrieve.mock.calls[0].arguments, [
            "ch_0",
            { expand: ["customer"] }
        ]);
        const payees = result.rows.filter((r) => r.Payee !== "Stripe").map((r) => r.Payee);
        assert.deepEqual(payees, ["", "Customer ch_0"]);
    });

    it("logs a warning and continues when a charge lookup fails", async () => {
        const stripe = fakeStripe(makeTransactions(3), { failCharges: ["ch_1"] });
        const logger = { warn: mock.fn() };
        const result = await fetchRows(stripe, base - 1, { logger, timeZone });

        assert.equal(result.count, 3);
        const failed = result.rows.find((r) => r.Reference === "ch_1");
        assert.equal(failed.Payee, "");
        assert.equal(logger.warn.mock.callCount(), 1);
        assert.match(logger.warn.mock.calls[0].arguments[0], /ch_1.*txn_1/);
    });

    it("lets errors from listing transactions propagate", async () => {
        const stripe = fakeStripe([]);
        stripe.balanceTransactions.list = () =>
            (async function* () {
                yield* [];
                throw new Error("API down");
            })();

        await assert.rejects(fetchRows(stripe, base, { timeZone }), /API down/);
    });
});
