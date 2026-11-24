import Stripe from "stripe";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseCliArgs, usage } from "./lib/cli.js";
import { writeCsv } from "./lib/csv.js";
import { fetchRows } from "./lib/fetch-transactions.js";
import { createLogger } from "./lib/log.js";
import {
    exportFilename,
    formatLastDate,
    parseConfig,
    parseLastDate
} from "./lib/transform.js";

const lastDateFilename = "lastdatefile.dat";
// Used when there is no last date file yet. 3 Oct 2016, local time.
const defaultStartDate = new Date(2016, 9, 3);

async function loadConfig(workingDir) {
    const path = join(workingDir, "config.json");
    try {
        return parseConfig(await readFile(path, "utf8"));
    } catch (err) {
        throw new Error(`Could not load config file ${path}: ${err.message}`, {
            cause: err
        });
    }
}

/**
 * Returns the unix timestamp (seconds) of the last exported transaction.
 */
async function getLastDate(workingDir) {
    const path = join(workingDir, lastDateFilename);
    let contents;
    try {
        contents = await readFile(path, "utf8");
    } catch (err) {
        if (err.code === "ENOENT") {
            return Math.floor(defaultStartDate.getTime() / 1000);
        }
        throw err;
    }
    try {
        return parseLastDate(contents);
    } catch (err) {
        throw new Error(`${path}: ${err.message}`, { cause: err });
    }
}

async function main(workingDir, logger) {
    const config = await loadConfig(workingDir);
    const stripe = new Stripe(config.apiKey);
    const since = await getLastDate(workingDir);

    const { rows, count, latest } = await fetchRows(stripe, since, { logger });
    if (count === 0) {
        logger.info(`No new transactions since ${formatLastDate(since)}`);
        return;
    }

    const exportDir = join(workingDir, "exports");
    await mkdir(exportDir, { recursive: true });
    const outFilename = exportFilename(since);
    await writeCsv(join(exportDir, outFilename), rows);

    // Only move the marker once the file is safely written, and only up to the
    // last transaction actually exported, so nothing can be skipped.
    await writeFile(join(workingDir, lastDateFilename), formatLastDate(latest));
    logger.info(`${count} transactions saved to ${join(exportDir, outFilename)}`);
}

let options;
try {
    options = parseCliArgs(process.argv.slice(2), import.meta.dirname);
} catch (err) {
    process.stderr.write(`${err.message}\n\n${usage}`);
    process.exitCode = 1;
}

if (options?.help) {
    process.stdout.write(usage);
} else if (options) {
    const logger = createLogger({ dir: join(options.dir, "logs") });
    try {
        await main(options.dir, logger);
    } catch (err) {
        logger.error(err);
        process.exitCode = 1;
    }
    await logger.flush();
}
