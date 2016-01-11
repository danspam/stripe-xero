try {
    config = require("./config.json")
}
catch (err) {
    config = {}
    console.log("unable to read file 'config.json': ", err);
}

var _ = require("underscore");
var moment = require("moment");
var stripe = require("stripe")(config.apiKey);
var csvWriter = require("csv-write-stream");
var winston = require('winston');
var fs = require("fs");

//TODO: CHANGE THIS TO THE CORRECT DATE EACH TIME IT IS RUN
var since = moment("2015-12-12").unix();

stripe.balance.listTransactions({
    created: {
        gt: since
    },
    limit: 100
}).then(function(transactions) {
    var writer = csvWriter();
    writer.pipe(fs.createWriteStream('stripestatement_since_'+ since +'.csv'));
    _.each(transactions.data, function(transaction){
        writer.write({
            Date: moment.unix(transaction.created).format("DD/MM/YYYY"),
            Amount: (transaction.amount/100.0).toFixed(2),
            Payee: "",
            Description: transaction.description,
            Reference: transaction.id
        });

        if (transaction.fee > 0) {
            writer.write({
                Date: moment.unix(transaction.created).format("DD/MM/YYYY"),
                Amount: ((0 - transaction.fee)/100.0).toFixed(2),
                Payee: "Stripe",
                Description: "Stripe processing Fee",
                Reference: transaction.id
            });
        }
    });
    writer.end();
}).catch(winston.error.bind(winston));