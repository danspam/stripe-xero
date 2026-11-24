import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeCsv } from "../lib/csv.js";

describe("writeCsv", () => {
    let dir;

    before(async () => {
        dir = await mkdtemp(join(tmpdir(), "stripe-xero-test-"));
    });

    after(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    it("writes a header and rows, quoting values where needed", async () => {
        const path = join(dir, "out.csv");
        await writeCsv(path, [
            {
                Date: "01/05/2024",
                Amount: "50.00",
                Payee: "Smith, John",
                Description: 'The "big" order',
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

        const lines = (await readFile(path, "utf8")).trimEnd().split("\n");
        assert.deepEqual(lines, [
            "Date,Amount,Payee,Description,Reference",
            '01/05/2024,50.00,"Smith, John","The ""big"" order",ch_1',
            "01/05/2024,-1.75,Stripe,Stripe processing Fee,txn_1"
        ]);
    });

    it("rejects when the file cannot be written", async () => {
        const path = join(dir, "missing-folder", "out.csv");
        await assert.rejects(
            writeCsv(path, [{ Date: "01/05/2024" }]),
            { code: "ENOENT" }
        );
        assert.equal(existsSync(path), false);
    });
});
