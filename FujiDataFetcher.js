const fs = require('fs');
const fetch = require('node-fetch');
const {request} =  require ('graphql-request');

/**
 * Returns Compound Borrow Rates from time range.
 *
 * @param {string} asset The cToken Address to get Borrowing rates.
 * @param {string} maxDate The earliest date in format 'YYYY.MM.DD'
 * @param {string} minDate The oldest date in format 'YYYY.MM.DD'
 * @param {string} numbuckets Optional - Sort borrowing rates in n buckets
 * @return {Object} Borrowing Rates Array of Objects
 */
async function getCompoundBorrowRates(asset, maxDate, minDate, numbuckets='30'){
    let maxblocktimestamp = new Date(maxDate).getTime() / 1000;
    let minblocktimestamp = new Date(minDate).getTime() / 1000;
    let APIuri = "https://api.compound.finance/api/v2/market_history/graph?asset="+
                asset+
                "&min_block_timestamp="+
                minblocktimestamp+
                "&max_block_timestamp="+
                maxblocktimestamp+
                "&num_buckets="+numbuckets;
    let serverresponse = await fetch(APIuri);
    let rObject = await serverresponse.json();
    console.log(rObject.borrow_rates);
   };

   /**
    * Returns Aave Borrow Rates from time range.
    *
    * @param {string} asset The ERC20 Address to get Borrowing rates, ALL LOWER CASE.
    * @param {string} number The number of data points from now
    * @return {Object} Borrowing Rates Array of Objects
    */

   async function getAaveBorrowRates(asset, number){
     let queryAave = `
     {
       reserve (id: "${asset}0xb53c1a33016b2dc2ff3653530bff1848a515c8c5") {
         paramsHistory(first: ${number}, orderDirection: desc, orderBy: timestamp) {
           variableBorrowRate
           utilizationRate
           liquidityRate
           timestamp
         }
       }
     }
     `
     //console.log(queryAave);
     let serverresponse = await request('https://api.thegraph.com/subgraphs/name/aave/protocol-v2', queryAave);
     console.log(serverresponse.reserve.paramsHistory);
    };


getCompoundBorrowRates("0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643","2021.02.18", "2021.02.17",'24');
getAaveBorrowRates("0x6b175474e89094c44da98b954eedeac495271d0f", 10);
