import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Returns the log file name for a date, using the machine's local date,
 * e.g. stripe-xero.log.2024-05-01.
 */
export function logFilename(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `stripe-xero.log.${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Formats a log message. Errors include their stack trace.
 */
export function formatMessage(message) {
    if (message instanceof Error) {
        return message.stack ?? message.message;
    }
    return String(message);
}

/**
 * Creates a logger that writes to the console and appends to a daily log file
 * in `dir`. Writes to the file happen in order; `flush()` resolves once they
 * have all finished. A failure to write the log file is reported on stderr
 * but never throws.
 */
export function createLogger({
    dir,
    now = () => new Date(),
    stdout = process.stdout,
    stderr = process.stderr
}) {
    let pending = mkdir(dir, { recursive: true });
    let fileFailed = false;

    function log(level, message) {
        const date = now();
        const text = formatMessage(message);
        (level === "info" ? stdout : stderr).write(`${level}: ${text}\n`);

        const line = `${date.toISOString()} ${level}: ${text}\n`;
        pending = pending
            .then(() => appendFile(join(dir, logFilename(date)), line))
            .catch((err) => {
                if (!fileFailed) {
                    fileFailed = true;
                    stderr.write(`Could not write to log file: ${err.message}\n`);
                }
            });
    }

    return {
        info: (message) => log("info", message),
        warn: (message) => log("warn", message),
        error: (message) => log("error", message),
        flush: () => pending
    };
}
