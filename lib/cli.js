import { parseArgs } from "node:util";
import { resolve } from "node:path";

export const usage = `Usage: node stripe-xero.mjs [--dir <path>]

Exports new Stripe balance transactions to a CSV file for importing into Xero.

Options:
  -d, --dir <path>  Folder holding config.json, lastdatefile.dat, exports/ and
                    logs/. Defaults to the folder the script is in.
  -h, --help        Show this help.
`;

/**
 * Parses command line arguments. Throws on unknown options.
 *
 * Returns { help: true } when help was requested, otherwise { dir } with the
 * working folder resolved to an absolute path.
 */
export function parseCliArgs(args, defaultDir) {
    const { values } = parseArgs({
        args,
        options: {
            dir: { type: "string", short: "d" },
            help: { type: "boolean", short: "h" }
        }
    });
    if (values.help) {
        return { help: true };
    }
    return { dir: resolve(values.dir ?? defaultDir) };
}
