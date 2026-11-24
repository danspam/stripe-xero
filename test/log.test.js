import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLogger, formatMessage, logFilename } from "../lib/log.js";

function fakeStream() {
    const chunks = [];
    return { chunks, write: (chunk) => chunks.push(chunk) };
}

describe("logFilename", () => {
    it("uses the local date, zero padded", () => {
        assert.equal(logFilename(new Date(2024, 4, 1, 23, 59)), "stripe-xero.log.2024-05-01");
        assert.equal(logFilename(new Date(2025, 11, 31)), "stripe-xero.log.2025-12-31");
    });
});

describe("formatMessage", () => {
    it("returns strings unchanged", () => {
        assert.equal(formatMessage("hello"), "hello");
    });

    it("includes the stack for errors", () => {
        const err = new Error("boom");
        assert.equal(formatMessage(err), err.stack);
        assert.match(formatMessage(err), /^Error: boom\n\s+at /);
    });

    it("falls back to the message when there is no stack", () => {
        const err = new Error("boom");
        err.stack = undefined;
        assert.equal(formatMessage(err), "boom");
    });
});

describe("createLogger", () => {
    let root;
    const now = () => new Date(2024, 4, 1, 9, 30);

    before(async () => {
        root = await mkdtemp(join(tmpdir(), "stripe-xero-log-"));
    });

    after(async () => {
        await rm(root, { recursive: true, force: true });
    });

    it("writes info to stdout, and warnings and errors to stderr", async () => {
        const stdout = fakeStream();
        const stderr = fakeStream();
        const logger = createLogger({ dir: join(root, "console"), now, stdout, stderr });

        logger.info("started");
        logger.warn("careful");
        logger.error(new Error("failed"));
        await logger.flush();

        assert.deepEqual(stdout.chunks, ["info: started\n"]);
        assert.equal(stderr.chunks[0], "warn: careful\n");
        assert.match(stderr.chunks[1], /^error: Error: failed\n\s+at /);
    });

    it("creates the folder and appends timestamped lines in order", async () => {
        const dir = join(root, "nested", "logs");
        const logger = createLogger({ dir, now, stdout: fakeStream(), stderr: fakeStream() });

        for (let i = 0; i < 20; i++) {
            logger.info(`line ${i}`);
        }
        await logger.flush();

        const lines = (await readFile(join(dir, logFilename(now())), "utf8"))
            .trimEnd()
            .split("\n");
        assert.equal(lines.length, 20);
        lines.forEach((line, i) => {
            assert.equal(line, `${now().toISOString()} info: line ${i}`);
        });
    });

    it("appends to an existing log file", async () => {
        const dir = join(root, "existing");
        const options = { dir, now, stdout: fakeStream(), stderr: fakeStream() };

        const first = createLogger(options);
        first.info("run 1");
        await first.flush();
        const second = createLogger(options);
        second.info("run 2");
        await second.flush();

        const contents = await readFile(join(dir, logFilename(now())), "utf8");
        assert.match(contents, /run 1\n.*run 2\n$/);
    });

    it("reports a log file failure once on stderr without throwing", async () => {
        // A file where the logs folder should be makes every write fail.
        const dir = join(root, "not-a-folder");
        await writeFile(dir, "");
        const stdout = fakeStream();
        const stderr = fakeStream();
        const logger = createLogger({ dir, now, stdout, stderr });

        logger.info("one");
        logger.info("two");
        await logger.flush();

        assert.deepEqual(stdout.chunks, ["info: one\n", "info: two\n"]);
        assert.equal(stderr.chunks.length, 1);
        assert.match(stderr.chunks[0], /^Could not write to log file: /);
    });
});
