Stripe to Xero
==============

A small node.js utility for pulling out the transactional data from stripe and creating a suitable import file for Xero accounting software

## Usage

Add your Stripe api key into a file named config.json as demonstrated in the config.example.json file.

Create a bank account for Stripe in Xero so that you can import the transactions into it.

In the index.js file, adjust the since date to the last imported date or the earliest date you want to get transactions from.

Run the utility and a csv file named stripestatement_since_XXXXX.csv will be created.

Import the csv file into Xero using the 'import a statement' utility on the bank account.
