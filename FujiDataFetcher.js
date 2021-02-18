
const fs = require('fs');
const fetch = require('node-fetch');

/**
 * Returns Compound Borrow Rates from time range.
 *
 * @param {string} asset The cToken Address to get Borrowing rates.
 * @param {string} maxDate The earliest date in format 'YYYY.MM.DD'
 * @param {string} minDate The oldest date in format 'YYYY.MM.DD'
 * @param {string} numbuckets Optional - Sort borrowing rates in n buckets
 * @return {Object} Borrowing Rates Array of Objects
 */
async function getCompoundBorrowRates(asset, maxDate, minDate, numbuckets='24'){
    let maxblocktimestamp = new Date(maxDate).getTime() / 1000;
    let minblocktimestamp = new Date(minDate).getTime() / 1000;
    let APIuri = "https://api.compound.finance/api/v2/market_history/graph?asset="+
                asset+
                "&min_block_timestamp="+
                minblocktimestamp+
                "&max_block_timestamp="+
                maxblocktimestamp+
                "&num_buckets="+numbuckets;
    console.log(APIuri);
    let serverresponse = await fetch(APIuri);
    let rObject = await serverresponse.json();
    console.log(rObject.borrow_rates);
   };

getCompoundBorrowRates("0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643","2021.02.18", "2021.01.18");
