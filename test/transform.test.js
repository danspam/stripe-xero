import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    exportFilename,
    formatAmount,
    formatDate,
    formatLastDate,
    parseConfig,
    parseLastDate,
    toRows
} from "../lib/transform.js";

const timeZone = "Australia/Brisbane";
const toUnix = (iso) => Date.parse(iso) / 1000;

describe("formatDate", () => {
    it("formats as DD/MM/YYYY", () => {
        assert.equal(formatDate(toUnix("2024-03-05T02:00:00Z"), timeZone), "05/03/2024");
    });

    it("uses the given time zone, not UTC", () => {
        // 11:30pm UTC on 30 April is 9:30am on 1 May in Brisbane.
        assert.equal(formatDate(toUnix("2024-04-30T23:30:00Z"), timeZone), "01/05/2024");
        assert.equal(formatDate(toUnix("2024-04-30T23:30:00Z"), "UTC"), "30/04/2024");
    });
});

describe("formatAmount", () => {
    it("converts cents to a two decimal string", () => {
        assert.equal(formatAmount(1234), "12.34");
        assert.equal(formatAmount(5), "0.05");
        assert.equal(formatAmount(0), "0.00");
        assert.equal(formatAmount(-59), "-0.59");
        assert.equal(formatAmount(100000), "1000.00");
    });
});

describe("toRows", () => {
    const transaction = {
        id: "txn_1",
        created: toUnix("2024-05-01T00:00:00Z"),
        amount: 5000,
        fee: 175,
        type: "charge",
        source: "ch_1",
        description: "Invoice 42"
    };
    const charge = { id: "ch_1", customer: { description: "Acme Pty Ltd" } };

    it("creates a payment row and a fee row", () => {
        assert.deepEqual(toRows(transaction, charge, { timeZone }), [
            {
                Date: "01/05/2024",
                Amount: "50.00",
                Payee: "Acme Pty Ltd",
                Description: "Invoice 42",
                Reference: "ch_1"
            },
            {
                Date: "01/05/2024",
                Amount: "-1.75",
                Payee: "Stripe",
                Description: "Stripe processing Fee",
                Reference: "txn_1"
            }
        ]);
    });

    it("omits the fee row when there is no fee", () => {
        const rows = toRows({ ...transaction, fee: 0 }, charge, { timeZone });
        assert.equal(rows.length, 1);
    });

    it("adds a positive fee refund row for negative fees", () => {
        const rows = toRows({ ...transaction, fee: -30 }, charge, { timeZone });
        assert.equal(rows.length, 2);
        assert.equal(rows[1].Amount, "0.30");
        assert.equal(rows[1].Description, "Stripe processing Fee refund");
    });

    it("leaves the payee blank when there is no charge or customer", () => {
        assert.equal(toRows(transaction, null, { timeZone })[0].Payee, "");
        assert.equal(toRows(transaction, { customer: null }, { timeZone })[0].Payee, "");
        assert.equal(toRows(transaction, { customer: {} }, { timeZone })[0].Payee, "");
    });

    it("uses empty strings for a missing description or source", () => {
        const [row] = toRows(
            { ...transaction, description: null, source: null },
            null,
            { timeZone }
        );
        assert.equal(row.Description, "");
        assert.equal(row.Reference, "");
    });

    it("keeps the sign of negative amounts such as payouts", () => {
        const [row] = toRows(
            { ...transaction, type: "payout", amount: -250000, fee: 0, source: "po_1" },
            null,
            { timeZone }
        );
        assert.equal(row.Amount, "-2500.00");
    });
});

describe("parseLastDate", () => {
    it("reads the old moment format with an offset", () => {
        assert.equal(
            parseLastDate("2024-04-15T10:23:26+10:00"),
            toUnix("2024-04-15T00:23:26Z")
        );
    });

    it("reads ISO dates and ignores surrounding whitespace", () => {
        assert.equal(
            parseLastDate("2024-05-07T05:00:00.000Z\r\n"),
            toUnix("2024-05-07T05:00:00Z")
        );
    });

    it("round trips with formatLastDate", () => {
        const seconds = toUnix("2025-01-02T03:04:05Z");
        assert.equal(parseLastDate(formatLastDate(seconds)), seconds);
    });

    it("throws on invalid contents", () => {
        assert.throws(() => parseLastDate("garbage"), /Invalid last date/);
        assert.throws(() => parseLastDate(""), /Invalid last date/);
    });
});

describe("parseConfig", () => {
    it("returns the config when apiKey is set", () => {
        assert.deepEqual(parseConfig('{"apiKey":"rk_test_123"}'), {
            apiKey: "rk_test_123"
        });
    });

    it("throws when apiKey is missing or empty", () => {
        assert.throws(() => parseConfig("{}"), /No apiKey set/);
        assert.throws(() => parseConfig('{"apiKey":""}'), /No apiKey set/);
        assert.throws(() => parseConfig("null"), /No apiKey set/);
    });

    it("throws on invalid JSON", () => {
        assert.throws(() => parseConfig("{"), SyntaxError);
    });
});

describe("exportFilename", () => {
    it("includes the start timestamp", () => {
        assert.equal(exportFilename(1712881537), "stripestatement_since_1712881537.csv");
    });
});
