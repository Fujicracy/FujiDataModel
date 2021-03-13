const fetch = require('node-fetch');
const {request} =  require ('graphql-request');
const { ethers } = require("ethers");
const fs = require('fs');
const ss = require('simple-statistics');

const dataTable = './RegRecords.csv';
const statsTable = './StatsRecords.csv';
const testTable = './TestRecords.csv';

const url = 'https://mainnet.infura.io/v3/4d5f1b5afb094856bd8dcd86c7bd8dc1';
const defiKey = '200c5b8de7c545ced1b58e8d060a4c6bca115cbd555eea0b2508031a2359';
const provider = new ethers.providers.JsonRpcProvider(url);

const DAIaddr = "0x6b175474e89094c44da98b954eedeac495271d0f";
const cDAIaddr = "0x5d3a536e4d6dbd6114cc1ead35777bab948e3643";
const crDAIaddr = "0x92b767185fb3b04f881e3ac8e5b0662a027a1d9f"
const USDCaddr = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const cUSDCaddr = "0x39aa39c021dfbae8fac545936693ac917d5e7563";
const crUSDCaddr = "0x44fbebd2f576670a6c33f6fc0b00aa8c5753b322";
const sUSDaddr = "0x57ab1ec28d129707052df4df418d58a2d46d5f51";
const USDTaddr = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const cUSDTaddr = "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9";
const crUSDTaddr = "0x797aab1ce7c01eb727ab980762ba88e7133d2157"
const TUSDaddr = "0x0000000000085d4780b73119b644ae5ecd22b376";
const bUSDaddr = "0x4fabb145d64652a948d72533023f6e7a623c7c53";
const crbUSDaddr = "0x1ff8cdb51219a8838b52e9cac09b71e591bc998e";
const gUSDaddr = "0x056fd409e1d7a124bd7017459dfea2f387b6d5cd";

class rateRecord {

  constructor(_protocol, _symbol, _timestamp, _borrow_rate, totalLiquidity, utilratio){
    this.protocol = _protocol;
    this.symbol = _symbol;
    this.timestamp = _timestamp;
    this.borrow_rate = _borrow_rate;
    this.total_liquidity = totalLiquidity;
    this.utilization_ratio = utilratio;
  }
}

class recordStats {

  constructor(_marketSymbol,
              _averageRate,
              _stdev,
              _variance,
              _minRateRecord,
              _maxRateRecord,
              _GASPrice,
              _ETHPrice,
              _timestamp
  ){
    this.marketSymbol = _marketSymbol;
    this.averageRate = _averageRate;
    this.stdev = _stdev;
    this.variance = _variance;
    this.minRate = _minRateRecord;
    this.maxRate = _maxRateRecord;
    this.GasPrice = _GASPrice;
    this.ETHPrice = _ETHPrice;
    this.timestamp = _timestamp;
  }
}

async function getAaveBorrowRatesGraphQ(asset, block_number, _timestamp){
  try {

    let query = `{ reserve (id:"${asset}0xb53c1a33016b2dc2ff3653530bff1848a515c8c5", block: {number: ${block_number}})
    {symbol variableBorrowRate utilizationRate totalLiquidity decimals}}`;
    let serverresponse = await request('https://api.thegraph.com/subgraphs/name/aave/protocol-v2', query);

    let totalLiq = parseFloat((parseFloat(serverresponse.reserve.totalLiquidity)/10**(serverresponse.reserve.decimals)).toFixed(0))

    let rObject = new rateRecord(
              'Aave-V2',
              serverresponse.reserve.symbol,
              _timestamp,
              parseFloat((parseFloat(serverresponse.reserve.variableBorrowRate)/1e27).toFixed(8)),
              totalLiq,
              parseFloat(serverresponse.reserve.utilizationRate)
            );

    return rObject;

  } catch (e) {

    console.log(`Aave-V2: Fetch error: ${_timestamp}`);
    console.log(e);

    let rObject = new rateRecord(
              'Aave-V2',
              'error',
              _timestamp,
              0
            );

    return rObject;
  }
};

async function getCompoundBorrowRatesGraphQ(asset, block_number, _timestamp){
  try {

    let query = `{market (id: "${asset}",block: {number: ${block_number}}) {borrowRate underlyingSymbol cash reserves totalBorrows}}`
    let serverresponse = await request('https://api.thegraph.com/subgraphs/name/graphprotocol/compound-v2', query);

    let totalCash = parseFloat(parseFloat(serverresponse.market.cash).toFixed(0));
    let tBorrowed = parseFloat(parseFloat(serverresponse.market.totalBorrows).toFixed(0));
    let reserv = parseFloat(serverresponse.market.reserves).toFixed(0);
    let utilR = tBorrowed / (totalCash + tBorrowed - reserv);
    utilR = parseFloat(utilR.toFixed(8));

    let rObject = new rateRecord(
              'Compound-V2',
              serverresponse.market.underlyingSymbol,
              _timestamp,
              parseFloat(parseFloat(serverresponse.market.borrowRate).toFixed(8)),
              totalCash+tBorrowed,
              utilR
            );
    return rObject;
  } catch (e) {

    console.log(`Compound-V2: Fetch error: ${_timestamp}`);
    console.log(e);

    let rObject = new rateRecord(
              'Compound-V2',
              'error',
              _timestamp,
              0
            );

    return rObject;

  }
};

async function getDyDxBorrowRatesAPI(asset, _timestamp){

  if (asset == DAIaddr) {
    var id = 3;
    var decimals = 18;
  } else if (asset == USDCaddr) {
    var id = 2;
    var decimals = 6;
  }

  try {

    let APIuri = `https://api.dydx.exchange/v1/markets/${id}`;
    let serverresponse = await fetch(APIuri);
    let rO = await serverresponse.json();

    let tBorrowed = parseFloat(rO.market.totalBorrowWei)/10**decimals;
    let tSupplied = parseFloat(rO.market.totalSupplyWei)/10**decimals;
    tSupplied = parseFloat(tSupplied.toFixed(0));
    let utilR = tBorrowed / tSupplied;
    utilR = parseFloat(utilR.toFixed(8));

    let rObject = new rateRecord(
              'DyDx-V1',
              rO.market.symbol,
              _timestamp,
              parseFloat(parseFloat(rO.market.totalBorrowAPR).toFixed(8)),
              tSupplied,
              utilR
            );

    return rObject;

  } catch (e) {

    console.log(`DyDx-V1: Fetch error: ${_timestamp}`);
    console.log(e);

    let rObject = new rateRecord(
              'DyDx-V1',
              'error',
              _timestamp,
              0
            );

    return rObject;

  }
};

async function getCreamFiBorrowRatesGraphQ(asset, block_number, _timestamp){
  try {

    let query = `{market (id: "${asset}",block: {number: ${block_number}}) {borrowRate underlyingSymbol cash reserves totalBorrows}}`
    let serverresponse = await request('https://api.thegraph.com/subgraphs/name/creamfinancedev/cream-lending', query);

    let totalCash = parseFloat(parseFloat(serverresponse.market.cash).toFixed(0));
    let tBorrowed = parseFloat(parseFloat(serverresponse.market.totalBorrows).toFixed(0));
    let reserv = parseFloat(serverresponse.market.reserves).toFixed(0);
    let utilR = tBorrowed / (totalCash + tBorrowed - reserv);
    utilR = parseFloat(utilR.toFixed(8));

    let rObject = new rateRecord(
              'CreamFi-V1',
              serverresponse.market.underlyingSymbol,
              _timestamp,
              parseFloat(parseFloat(serverresponse.market.borrowRate).toFixed(8)),
              totalCash+tBorrowed,
              utilR
            );
    return rObject;
  } catch (e) {

    console.log(`CreamFi-V1: Fetch error: ${_timestamp}`);
    console.log(e);

    let rObject = new rateRecord(
              'CreamFi-V1',
              'error',
              _timestamp,
              0
            );

    return rObject;

  }
};

async function buildStatRecord(_marketSymbol, records){

  let gPrice = await getGasPrice();
  let ethPrice = await getETHPrice();
  let statsArray = computeStats(records);

  let statRecord = new recordStats(
              _marketSymbol,
              statsArray[0],
              statsArray[1],
              statsArray[2],
              records[statsArray[3]],
              records[statsArray[4]],
              gPrice,
              ethPrice,
              records[0].timestamp);

  return statRecord;
}

async function getGasPrice(){
  let APIuri = `https://ethgasstation.info/api/ethgasAPI.json?api-key=${defiKey}`;
  let serverresponse = await fetch(APIuri);
  let r0 = await serverresponse.json();
  return r0.average/10;
};

async function getETHPrice(){
  let APIuri = `https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd`;
  let serverresponse = await fetch(APIuri);
  let r0 = await serverresponse.json();
  return r0.ethereum.usd;
};

function computeStats(_RateArray){
  let values =[];
  for (var i = 0; i < _RateArray.length; i++) {
    values.push(_RateArray[i].borrow_rate);
  }
  let minpos = values.indexOf(ss.min(values));
  let maxpos = values.indexOf(ss.max(values));
  return [ss.mean(values), ss.standardDeviation(values), ss.variance(values), minpos, maxpos];
};


function addRatesDataTable(_document, records){
  for (var i = 0; i < records.length; i++) {
    fs.appendFile(_document,
      records[i].protocol+', '+
      records[i].symbol+', '+
      records[i].timestamp+', '+
      records[i].borrow_rate+', '+
      records[i].total_liquidity+', '+
      records[i].utilization_ratio+'\n',
      function (err) {
        if (err) throw err;
      });
  }
  console.log(records[0].timestamp, ' Rates Registered!');
};

function addStatsDataTable(_document, srecords){
  for (var i = 0; i < srecords.length; i++) {
    fs.appendFile(_document,
      srecords[i].marketSymbol+', '+
      srecords[i].averageRate+', '+
      srecords[i].stdev+', '+
      srecords[i].variance+', '+
      srecords[i].minRate.borrow_rate+', '+
      srecords[i].maxRate.borrow_rate+', '+
      srecords[i].GasPrice+', '+
      srecords[i].ETHPrice+', '+
      srecords[i].timestamp+'\n',
      function (err) {
        if (err) throw err;
      });
      console.log(srecords[i].marketSymbol, ' Stats Rates Registered!');
  };
};


let main = async () => {

  let currentblock = await provider.getBlockNumber();
  let back5blocks = currentblock-5;
  let bdata = await provider.getBlock(back5blocks);
  let timestamp =  bdata.timestamp;

  console.log(back5blocks,timestamp);

  let aaveresp = await getAaveBorrowRatesGraphQ(DAIaddr,back5blocks,timestamp);
  let compresp = await getCompoundBorrowRatesGraphQ(cDAIaddr,back5blocks,timestamp);
  let dydxresp = await getDyDxBorrowRatesAPI(DAIaddr, timestamp);
  let creamresp = await getCreamFiBorrowRatesGraphQ(crDAIaddr, back5blocks, timestamp);
  let aaveresp2 = await getAaveBorrowRatesGraphQ(USDCaddr,back5blocks,timestamp);
  let compresp2 = await getCompoundBorrowRatesGraphQ(cUSDCaddr,back5blocks,timestamp);
  let dydxresp2 = await getDyDxBorrowRatesAPI(USDCaddr, timestamp);
  let creamresp2 = await getCreamFiBorrowRatesGraphQ(crUSDCaddr, back5blocks, timestamp);
  let aaveresp3 = await getAaveBorrowRatesGraphQ(sUSDaddr,back5blocks,timestamp);
  let aaveresp4 = await getAaveBorrowRatesGraphQ(USDTaddr,back5blocks,timestamp);
  let compresp4 = await getCompoundBorrowRatesGraphQ(cUSDTaddr,back5blocks,timestamp);
  let creamresp4 = await getCreamFiBorrowRatesGraphQ(crUSDTaddr, back5blocks, timestamp);
  let aaveresp5 = await getAaveBorrowRatesGraphQ(TUSDaddr,back5blocks,timestamp);
  let aaveresp6 = await getAaveBorrowRatesGraphQ(bUSDaddr,back5blocks,timestamp);
  let creamresp6 = await getCreamFiBorrowRatesGraphQ(crbUSDaddr, back5blocks, timestamp);
  let aaveresp7 = await getAaveBorrowRatesGraphQ(gUSDaddr,back5blocks,timestamp);

  let infoarray = [aaveresp, compresp, dydxresp, creamresp, aaveresp2, compresp2, dydxresp2,
                  creamresp2, aaveresp3, aaveresp4, compresp4,creamresp4, aaveresp5,aaveresp6,
                  creamresp6, aaveresp7
                  ];

  console.log(infoarray);
  addRatesDataTable(dataTable, infoarray);

  let daiStatsRecord = await buildStatRecord('DAI',[aaveresp, compresp, dydxresp, creamresp]);
  let usdcStatsRecord = await buildStatRecord('USDC',[aaveresp2, compresp2, dydxresp2, creamresp2]);
  let usdtStatsRecord = await buildStatRecord('USDT',[aaveresp4, compresp4, creamresp4]);
  let stablecoinStatRecord = await buildStatRecord('StableCoins',infoarray);

  let statsArray = [daiStatsRecord, usdcStatsRecord, usdtStatsRecord, stablecoinStatRecord];

  console.log(statsArray);
  addStatsDataTable(statsTable,statsArray);


  let theborrowMarket = 0;

  for (var i = 0; i < infoarray.length; i++) {
    theborrowMarket = theborrowMarket + infoarray[i].total_liquidity;
  }
  console.log(`The borrowMarket $${theborrowMarket}`)
};

setInterval(() => {
 main();
}, 60000);

//main();

let test = async () => {

};

//test();
