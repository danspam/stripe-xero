import csvWriter from "csv-write-stream";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

/**
 * Writes rows to a CSV file. Resolves once the file is fully written, and
 * rejects if it could not be.
 */
export async function writeCsv(path, rows) {
    const writer = csvWriter();
    const done = pipeline(writer, createWriteStream(path));
    for (const row of rows) {
        writer.write(row);
    }
    writer.end();
    await done;
}
