Stripe to Xero
==============

A small Node.js utility that exports new Stripe balance transactions (payments, refunds, payouts and Stripe fees) to a CSV file that can be imported into Xero as a bank statement.

## Setup

1. Create a bank account for Stripe in Xero so that you can import the transactions into it.
2. Create a data folder containing a `config.json` with your Stripe API key, as shown in `config.example.json`. A [restricted key](https://docs.stripe.com/keys#limit-access) with read access to balance transactions, charges and customers is all the tool needs.

The data folder also holds:

- `lastdatefile.dat` - the time of the last exported transaction. The next run exports everything after it. If it is missing, the export starts from 3 Oct 2016.
- `exports/` - the generated `stripestatement_since_XXXXX.csv` files.
- `logs/` - daily log files.

## Usage

```
node stripe-xero.mjs --dir <data folder>
```

If `--dir` is left out, the folder the script is in is used. Import the generated csv file into Xero using the 'import a statement' utility on the bank account.

The script exits with code 1 if anything fails, and only updates `lastdatefile.dat` once the csv file has been written, so a failed run can simply be run again.

## Development

Requires Node.js 22.13 or later for the dev tools (the script itself runs on Node.js 22.0+).

```
npm ci
npm test          # run the tests
npm run lint      # run eslint
npm start -- --dir <data folder>   # run from source
```

## Deploying

```
npm run build
```

This lints, runs the tests, and bundles the tool and all its dependencies into a single file, `dist/stripe-xero.mjs`. Copy that file to the server and run it with Node.js 22 or later; no `npm install` is needed there.
