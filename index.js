var config;
var winston = require("winston");
var Dropbox = require("dropbox").Dropbox;
require("winston-daily-rotate-file");

//configure logging
const logger = winston.createLogger({
    level: "info",
    format: winston.format.simple(),
    transports: [
      new winston.transports.DailyRotateFile({
        filename: "stripe-xero.log",
        dirname: "D:\\node\\stripe-xero",
        datePattern: "YYYY-MM-DD",
        prepend: false,
        level: "info"
    }),
    new winston.transports.Console({
        format: winston.format.simple()
      })
    ]
});


try {
    config = require("./config.json");
} catch (err) {
    config = {};
    logger.error(err);
}

var async = require("async");
var moment = require("moment");
var stripe = require("stripe")(config.apiKey);
var csvWriter = require("csv-write-stream");
var fs = require("fs");
var since;
var lastdatefile = "lastdatefile.dat";

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

function uploadToDropbox(filename) {
    fs.readFile(filename, "utf8", function (err, data) {
        if (err) {
            return logger.error(err);
        }
        const dbx = new Dropbox({
            accessToken:config.dropbox
          });

          dbx.filesUpload({
            path: `/stripe-xero/${filename}`,
            contents: data
          })
          .then(() => {
            logger.info("Upload to dropbox complete");
          })
          .catch(err => {
            logger.error(err);
          });
    });
}

fs.readFile(lastdatefile, "utf8", function (err, data) {
    if (err) {
        since = moment("2016-10-03").unix();
    } else {
        since = moment(data).unix();
    }

    stripe.balanceTransactions
        .list({
            created: {
                gt: since
            },
            limit: 300
        })
        .then(function (transactions) {
            var writer = csvWriter();
            var outFile = "stripestatement_since_" + since + ".csv";

            writer.pipe(fs.createWriteStream(outFile));

            async.eachSeries(
                transactions.data,
                function (transaction, cb) {
                    if (transaction.type === "charge") {
                        stripe.charges.retrieve(
                            transaction.source,
                            {
                                expand: ["customer"]
                            },
                            function (err, charge) {
                                if (err) {
                                    logger.error(err);
                                }
                                writeToFile(writer, transaction, charge);
                                cb();
                            }
                        );
                    } else {
                        writeToFile(writer, transaction, null);
                        cb();
                    }
                },
                function () {
                    writer.end();

                    fs.writeFile(
                        lastdatefile,
                        moment().format(),
                        function (err) {
                            if (err) {
                                return logger.error(err);
                            }
                            logger.info("Transactions saved to " + outFile);
                            uploadToDropbox(outFile);
                        }
                    );
                }
            );
        })
        .catch(logger.error.bind(logger));
});
