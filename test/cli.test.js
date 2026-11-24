import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { parseCliArgs } from "../lib/cli.js";

const defaultDir = resolve("/opt/stripe-xero");

describe("parseCliArgs", () => {
    it("defaults to the given folder", () => {
        assert.deepEqual(parseCliArgs([], defaultDir), { dir: defaultDir });
    });

    it("accepts --dir and -d", () => {
        const expected = { dir: resolve("/data/stripe") };
        assert.deepEqual(parseCliArgs(["--dir", "/data/stripe"], defaultDir), expected);
        assert.deepEqual(parseCliArgs(["--dir=/data/stripe"], defaultDir), expected);
        assert.deepEqual(parseCliArgs(["-d", "/data/stripe"], defaultDir), expected);
    });

    it("resolves a relative --dir against the current folder", () => {
        assert.deepEqual(parseCliArgs(["--dir", "data"], defaultDir), {
            dir: resolve("data")
        });
    });

    it("returns help for --help and -h", () => {
        assert.deepEqual(parseCliArgs(["--help"], defaultDir), { help: true });
        assert.deepEqual(parseCliArgs(["-h"], defaultDir), { help: true });
    });

    it("throws on unknown options or a missing value", () => {
        assert.throws(() => parseCliArgs(["--since", "2024-01-01"], defaultDir));
        assert.throws(() => parseCliArgs(["--dir"], defaultDir));
    });
});
