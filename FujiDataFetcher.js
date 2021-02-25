const fs = require('fs');
const fetch = require('node-fetch');
const {request} =  require ('graphql-request');

const dataTable = './Data.csv'

/**
 * Returns Unix Epoch time.
 *
 * @param {string} _date The latest date in format 'YYYY-MM-DDTHH:MM:SSZ'
 * @return {int} Unix epoch timestamp
 */
function getUnixT(_date){
  let ndate = new Date(_date).getTime() / 1000;
  return ndate
}

/**
 * Returns a meanRateRecord Object.
 *
 * @param {array} array_rateRecords An array of RateRecord Objects
 * @return {float} mean Rate between two time periods
 */
function computeMeanRate(array_rateRecords, unix_startDate, unix_endDate) {
  let areaSum = 0;
  let timespanSum =0;
  for (var i = 0; i < array_rateRecords.length; i++) {
    if (i==0) {
      let timespan = array_rateRecords[i].timestamp - unix_startDate;
      areaSum = areaSum + timespan*array_rateRecords[i].borrow_rate
      timespanSum = timespanSum + timespan;
    } else if (i == array_rateRecords.length-1) {
      let timespan = unix_endDate-array_rateRecords[i].timestamp;
      areaSum = areaSum + timespan*array_rateRecords[i].borrow_rate;
      timespanSum = timespanSum + timespan;
    } else {
      let timespan = array_rateRecords[i].timestamp- array_rateRecords[i-1].timestamp;
      areaSum = areaSum + timespan*array_rateRecords[i].borrow_rate;
      timespanSum = timespanSum + timespan;
    }
  }
  return (areaSum/timespanSum);
}

class rateRecord {
  constructor(_timestamp, _borrow_rate){
    this.timestamp = _timestamp;
    this.borrow_rate = _borrow_rate;
  }
}

class meanRateRecord {
  constructor(_protocol, _timestamp0, _timestamp1, _borrow_rate){
    this.protocol = _protocol;
    this.timestamp0 = _timestamp0;
    this.timestamp1 = _timestamp1;
    this.borrow_rate = _borrow_rate;
  }
}

function addDataTable(_document, record){
  fs.appendFile(_document,
    record.protocol+', '+
    record.timestamp0+', '+
    record.timestamp1+', '+
    record.borrow_rate+'\n',
    function (err) {
      if (err) throw err;
      console.log('It\'s saved!');
    });
};

/**
 * Returns Compound-Protocol's MeanRateRecord Object in a specified time range USING API.
 *
 * @param {string} asset The Compound-Protocol cToken Address to get Borrowing rates.
 * @param {string} maxDate The latest date in format 'YYYY-MM-DDTHH:MM:SSZ'
 * @param {string} minDate The oldest date in format 'YYYY-MM-DDTHH:MM:SSZ'
 * @return {Object} Borrowing Rates Array of Objects
 */
async function getCompoundBorrowRatesAPI(asset, minDate, maxDate){

  let minblocktimestamp = getUnixT(minDate);
  let maxblocktimestamp = getUnixT(maxDate);

  let APIuri = "https://api.compound.finance/api/v2/market_history/graph?asset="+
                asset+
                "&min_block_timestamp="+
                minblocktimestamp+
                "&max_block_timestamp="+
                maxblocktimestamp+
                "&num_buckets=3600";
  let serverresponse = await fetch(APIuri);
  let rObject = await serverresponse.json();
  rObject = rObject.borrow_rates;
  let uniqueRates = [];
  for (var i = 0; i < rObject.length; i++) {
    uniqueRates.push(rObject[i].rate);
  }
  uniqueRates = [...new Set(uniqueRates)];
  let setObject =[];
  for (var i = 0; i < uniqueRates.length; i++) {
    let temp = rObject.filter( aObject => aObject.rate == uniqueRates[i]);
    let newItem = new rateRecord(parseInt(temp[0].block_timestamp), temp[0].rate);
    setObject.push(newItem);
  }
  let mObject = new meanRateRecord(
    'Compound-V2',
    minblocktimestamp,
    maxblocktimestamp,
    computeMeanRate(setObject, minblocktimestamp, maxblocktimestamp)
  );
  return mObject;
};

/**
* Returns Aave-Protocol V2 MeanRateRecord Object in a specified time range using GraphQL.
*
* @param {string} asset The ERC20 Address to get Borrowing rates, ALL LOWER CASE.
* @param {string} minDate The oldest date in format 'YYYY-MM-DDTHH:MM:SSZ'
* @param {string} maxDate The earliest date in format 'YYYY-MM-DDTHH:MM:SSZ'
* @return {Object} meanRateRecord Object
*/

async function getAaveBorrowRatesGraphQ(asset, minDate, maxDate){

  let minblocktimestamp = getUnixT(minDate);
  let maxblocktimestamp = getUnixT(maxDate);

  let query = `
    {
      reserve (id: "${asset}0xb53c1a33016b2dc2ff3653530bff1848a515c8c5") {
          name
          id
        paramsHistory(where: { timestamp_gt: ${minblocktimestamp}, timestamp_lte: ${maxblocktimestamp} }, orderDirection: asc, orderBy: timestamp) {
          variableBorrowRate
          totalLiquidity
          utilizationRate
          timestamp
        }
      }
    }
    `
  let serverresponse = await request('https://api.thegraph.com/subgraphs/name/aave/protocol-v2', query);
  let rObject = serverresponse.reserve.paramsHistory;
  let setObject =[];
  for (var i = 0; i < rObject.length; i++) {
    let rate = parseInt(rObject[i].variableBorrowRate)/(1e27);
    let newItem = new rateRecord(rObject[i].timestamp, rate);
    setObject.push(newItem);
  }
  let mObject = new meanRateRecord(
    'Aave-V2',
    minblocktimestamp,
    maxblocktimestamp,
    computeMeanRate(setObject, minblocktimestamp, maxblocktimestamp)
  );
  return mObject;
};

async function getDyDxBorrowRatesAPI(){
  let APIuri = "https://api.dydx.exchange/v1/markets/3";
  let serverresponse = await fetch(APIuri);
  let rObject = await serverresponse.json();
  console.log(rObject);
}

getDyDxBorrowRatesAPI();

async function getCreamFiBorrowRatesAPI(){
  let APIuri = "https://api.cream.finance/api/v1/rates?block_number=11924082&comptroller=eth";
  let serverresponse = await fetch(APIuri);
  let rObject = await serverresponse.json();
  console.log(rObject.block_number);
  console.log(rObject.borrowRates.filter(resp => resp.tokenSymbol == 'DAI'));
  console.log(rObject.borrowRates.filter(resp => resp.tokenSymbol == 'USDC'));
}

//https://api.cream.finance/api/documentations/#/Ethereum/AppController_rates
getCreamFiBorrowRatesAPI();

function builditerate(oldestdate1, latestdate2, step){
  let oldd1 = getUnixT(oldestdate1);
  let earlyd2 = getUnixT(latestdate2);
  let array =[];
  array.push(earlyd2);

  do {
    array.push(earlyd2-step);
    earlyd2=earlyd2-step;
  } while (earlyd2 >= oldd1);

  for (var i = 0; i < array.length; i++) {
    let temp =new Date(array[i]*1000);
    array[i]=temp.toISOString();
  }
  return array;
}

const main = async () => {

  let datearray = builditerate('2021-01-23T00:00:00Z','2021-02-24T21:00:00Z',3600);

  for (var i = 1; i < datearray.length-1; i++) {
    let resp1 = await getCompoundBorrowRatesAPI("0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643",datearray[i],datearray[i-1]);
    console.log(resp1);
    addDataTable(dataTable, resp1);
    let resp2 = await getAaveBorrowRatesGraphQ("0x6b175474e89094c44da98b954eedeac495271d0f",datearray[i],datearray[i-1]);
    console.log(resp2);
    addDataTable(dataTable, resp2);
  }
}

//main();
//const hours=['24','23','22','21','20','19','18','17','16','15','14','13','12','11','10','09','08','07','06','05','04','03','02','01','00'];
