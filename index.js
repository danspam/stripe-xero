import { createLogger, format, transports } from "winston";
import "winston-daily-rotate-file";
import { eachSeries } from "async";
import moment from "moment";
import Stripe from "stripe";
import csvWriter from "csv-write-stream";
import { readFile, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { join } from "node:path";

const lastDateFilename = "lastdatefile.dat";
const workingDir = "CHANGE_ME";

const logger = createLogger({
    level: "info",
    format: format.simple(),
    transports: [
        new transports.DailyRotateFile({
            filename: "stripe-xero.log",
            dirname: join(workingDir, "logs"),
            datePattern: "YYYY-MM-DD",
            prepend: false,
            level: "info"
        }),
        new transports.Console({
            format: format.simple()
        })
    ]
});

async function loadConfig() {
    try {
        return JSON.parse(
            await readFile(join(workingDir, "config.json"), "utf8")
        );
    } catch (err) {
        logger.error(err);
        return {};
    }
}

async function getLastDate() {
    try {
        const date = await readFile(join(workingDir, lastDateFilename), "utf8");
        return moment(date).unix();
    } catch (err) {
        return moment("2016-10-03").unix();
    }
}

function writeToFile(writer, transaction, charge) {
    writer.write({
        Date: moment.unix(transaction.created).format("DD/MM/YYYY"),
        Amount: (transaction.amount / 100.0).toFixed(2),
        Payee:
            charge && charge.customer && charge.customer.description
                ? charge.customer.description
                : "",
        Description: transaction.description,
        Reference: transaction.source
    });

    if (transaction.fee > 0) {
        writer.write({
            Date: moment.unix(transaction.created).format("DD/MM/YYYY"),
            Amount: ((0 - transaction.fee) / 100.0).toFixed(2),
            Payee: "Stripe",
            Description: "Stripe processing Fee",
            Reference: transaction.id
        });
    }
}

const config = await loadConfig();
const stripe = new Stripe(config.apiKey);
const since = await getLastDate();
const outFilename = "stripestatement_since_" + since + ".csv";

try {
    const transactions = await stripe.balanceTransactions.list({
        created: { gt: since },
        limit: 300
    });
    const writer = csvWriter();

    writer.pipe(createWriteStream(join(workingDir, "exports", outFilename)));

    eachSeries(
        transactions.data,
        async function (transaction) {
            let charges = null;
            if (transaction.type === "charge") {
                try {
                    charges = await stripe.charges.retrieve(
                        transaction.source,
                        { expand: ["customer"] }
                    );
                } catch (err) {
                    logger.error(err);
                }
            }
            writeToFile(writer, transaction, charges);
        },
        async function () {
            writer.end();
            await writeFile(lastDateFilename, moment().format());
            logger.info("Transactions saved to " + outFilename);
        }
    );
} catch (err) {
    logger.error(err);
}
