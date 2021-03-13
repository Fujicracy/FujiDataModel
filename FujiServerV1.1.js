require('dotenv').config();

const fetch = require('node-fetch');
const { request } =  require ('graphql-request');
const { ethers } = require("ethers");
const fs = require('fs');
const ss = require('simple-statistics');
const mongoose = require('mongoose');

const Rate = require('./models/rate');
const Stat = require('./models/stat');

const dataTable = './RegRecords.csv';
const statsTable = './StatsRecords.csv';
const testTable = './TestRecords.csv';

const url = `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`;
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

const dbURI = `imongodb+srv://${process.env.MONGO_DB_USER}:${process.env.MONGO_DB_PASSWORD}@cluster0.nsht4.mongodb.net/${process.env.MONGO_DB_DATABASE}?retryWrites=true&w=majority`;
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(res => {
    console.log("Connected to DB");
    main();
  })
  .catch(err => console.log(err));

class rateRecord {

  constructor(_protocol, _symbol, _timestamp, _borrowRate, _totalLiquidity, _utilRatio){
    this.protocol = _protocol;
    this.symbol = _symbol;
    this.timestamp = _timestamp;
    this.borrowRate = _borrowRate;
    this.totalLiquidity = _totalLiquidity;
    this.utilizationRatio = _utilRatio;
  }
}

class recordStats {

  constructor(_marketSymbol,
              _averageRate,
              _stdev,
              _variance,
              _minRateRecord,
              _maxRateRecord,
              _gasPrice,
              _ethPrice,
              _timestamp
  ){
    this.marketSymbol = _marketSymbol;
    this.averageRate = _averageRate;
    this.stdev = _stdev;
    this.variance = _variance;
    this.minRate = _minRateRecord;
    this.maxRate = _maxRateRecord;
    this.gasPrice = _gasPrice;
    this.ethPrice = _ethPrice;
    this.timestamp = _timestamp;
  }
}

async function getAaveBorrowRatesGraphQ(asset, blockNumber, _timestamp){
  try {

    let query = `{ reserve (id:"${asset}0xb53c1a33016b2dc2ff3653530bff1848a515c8c5", block: {number: ${blockNumber}})
    {symbol variableBorrowRate utilizationRate totalLiquidity decimals}}`;
    let apiResponse = await request('https://api.thegraph.com/subgraphs/name/aave/protocol-v2', query);

    let totalLiq = parseFloat((parseFloat(apiResponse.reserve.totalLiquidity)/10**(apiResponse.reserve.decimals)).toFixed(0))

    return new rateRecord(
      'Aave-V2',
      apiResponse.reserve.symbol,
      _timestamp,
      parseFloat((parseFloat(apiResponse.reserve.variableBorrowRate)/1e27).toFixed(8)),
      totalLiq,
      parseFloat(apiResponse.reserve.utilizationRate)
    );
  } catch (e) {

    console.log(`Aave-V2: Fetch error: ${_timestamp}`);
    console.log(e);

    return new rateRecord(
      'Aave-V2',
      'error',
      _timestamp,
      0
    );
  }
};

async function getCompoundBorrowRatesGraphQ(asset, blockNumber, _timestamp){
  try {

    let query = `{market (id: "${asset}",block: {number: ${blockNumber}}) {borrowRate underlyingSymbol cash reserves totalBorrows}}`
    let apiResponse = await request('https://api.thegraph.com/subgraphs/name/graphprotocol/compound-v2', query);

    let totalCash = parseFloat(parseFloat(apiResponse.market.cash).toFixed(0));
    let tBorrowed = parseFloat(parseFloat(apiResponse.market.totalBorrows).toFixed(0));
    let reserv = parseFloat(apiResponse.market.reserves).toFixed(0);
    let utilR = tBorrowed / (totalCash + tBorrowed - reserv);
    utilR = parseFloat(utilR.toFixed(8));

    return new rateRecord(
      'Compound-V2',
      apiResponse.market.underlyingSymbol,
      _timestamp,
      parseFloat(parseFloat(apiResponse.market.borrowRate).toFixed(8)),
      totalCash+tBorrowed,
      utilR
    );
  } catch (e) {

    console.log(`Compound-V2: Fetch error: ${_timestamp}`);
    console.log(e);

    return new rateRecord(
      'Compound-V2',
      'error',
      _timestamp,
      0
    );
  }
};

async function getDyDxBorrowRatesAPI(asset, _timestamp){

  const id = asset == DAIaddr ? 3 : 2;
  const decimals = asset == DAIaddr ? 18 : 6;

  try {

    let APIuri = `https://api.dydx.exchange/v1/markets/${id}`;
    let apiResponse = await fetch(APIuri, { timeout: 1000 });

    if (apiResponse.status !== 200) {
      throw 'dYdX API error';
    }

    let rO = await apiResponse.json();

    let tBorrowed = parseFloat(rO.market.totalBorrowWei)/10**decimals;
    let tSupplied = parseFloat(rO.market.totalSupplyWei)/10**decimals;
    tSupplied = parseFloat(tSupplied.toFixed(0));
    let utilR = tBorrowed / tSupplied;
    utilR = parseFloat(utilR.toFixed(8));

    return new rateRecord(
      'DyDx-V1',
      rO.market.symbol,
      _timestamp,
      parseFloat(parseFloat(rO.market.totalBorrowAPR).toFixed(8)),
      tSupplied,
      utilR
    );

  } catch (e) {

    console.log(`DyDx-V1: Fetch error: ${_timestamp}`);
    console.log(e);

    return new rateRecord(
      'DyDx-V1',
      'error',
      _timestamp,
      0
    );
  }
};

async function getCreamFiBorrowRatesGraphQ(asset, blockNumber, _timestamp){
  try {

    let query = `{market (id: "${asset}",block: {number: ${blockNumber}}) {borrowRate underlyingSymbol cash reserves totalBorrows}}`
    let apiResponse = await request('https://api.thegraph.com/subgraphs/name/creamfinancedev/cream-lending', query);

    let totalCash = parseFloat(parseFloat(apiResponse.market.cash).toFixed(0));
    let tBorrowed = parseFloat(parseFloat(apiResponse.market.totalBorrows).toFixed(0));
    let reserv = parseFloat(apiResponse.market.reserves).toFixed(0);
    let utilR = tBorrowed / (totalCash + tBorrowed - reserv);
    utilR = parseFloat(utilR.toFixed(8));

    return new rateRecord(
      'CreamFi-V1',
      apiResponse.market.underlyingSymbol,
      _timestamp,
      parseFloat(parseFloat(apiResponse.market.borrowRate).toFixed(8)),
      totalCash+tBorrowed,
      utilR
    );
  } catch (e) {

    console.log(`CreamFi-V1: Fetch error: ${_timestamp}`);
    console.log(e);

    return new rateRecord(
      'CreamFi-V1',
      'error',
      _timestamp,
      0
    );
  }
};

async function buildStatRecord(_marketSymbol, records){

  let gPrice = await getgasPrice();
  let ethPrice = await getethPrice();
  let statsArray = computeStats(records);

  return new recordStats(
    _marketSymbol,
    statsArray[0],
    statsArray[1],
    statsArray[2],
    records[statsArray[3]],
    records[statsArray[4]],
    gPrice,
    ethPrice,
    records[0].timestamp
  );
}

async function getgasPrice(){
  let APIuri = `https://ethgasstation.info/api/ethgasAPI.json?api-key=${process.env.GASSTATION_KEY}`;
  let apiResponse = await fetch(APIuri);
  let r0 = await apiResponse.json();
  return r0.average/10;
};

async function getethPrice(){
  let APIuri = `https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd`;
  let apiResponse = await fetch(APIuri);
  let r0 = await apiResponse.json();
  return r0.ethereum.usd;
};

function computeStats(_RateArray){
  let values =[];
  for (var i = 0; i < _RateArray.length; i++) {
    values.push(_RateArray[i].borrowRate);
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
      records[i].borrowRate+', '+
      records[i].totalLiquidity+', '+
      records[i].utilizationRatio+'\n',
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
      srecords[i].minRate.borrowRate+', '+
      srecords[i].maxRate.borrowRate+', '+
      srecords[i].gasPrice+', '+
      srecords[i].ethPrice+', '+
      srecords[i].timestamp+'\n',
      function (err) {
        if (err) throw err;
      });
      console.log(srecords[i].marketSymbol, ' Stats Rates Registered!');
  };
};

function saveRates(records) {
  records.forEach((record) => {
    const rateObj = new Rate({
      protocol: record.protocol,
      symbol: record.symbol,
      borrowRate: record.borrowRate,
      totalLiquidity: record.totalLiquidity,
      utilizationRatio: record.utilizationRatio,
    });

    rateObj.save();
  });
}

function saveStats(records) {
  records.forEach((record) => {
    const statObj = new Stat({
      symbol: record.marketSymbol,
      averageRate: record.averageRate,
      minRate: record.minRate.borrowRate,
      maxRate: record.maxRate.borrowRate,
      stdev: record.stdev,
      variance: record.variance,
      gasPrice: record.gasPrice,
      ethPrice: record.ethPrice,
    });

    statObj.save();
  });
}

async function main() {

  let currentblock = await provider.getBlockNumber().catch(console.log);
  let back5blocks = currentblock - 5;
  let bdata = await provider.getBlock(back5blocks).catch(console.log);
  let timestamp =  bdata.timestamp;

  console.log(back5blocks, timestamp);

  let aaveresp = await getAaveBorrowRatesGraphQ(DAIaddr, back5blocks, timestamp);
  let compresp = await getCompoundBorrowRatesGraphQ(cDAIaddr, back5blocks, timestamp);
  let dydxresp = await getDyDxBorrowRatesAPI(DAIaddr, timestamp);
  let creamresp = await getCreamFiBorrowRatesGraphQ(crDAIaddr, back5blocks, timestamp);
  let aaveresp2 = await getAaveBorrowRatesGraphQ(USDCaddr, back5blocks, timestamp);
  let compresp2 = await getCompoundBorrowRatesGraphQ(cUSDCaddr, back5blocks, timestamp);
  let dydxresp2 = await getDyDxBorrowRatesAPI(USDCaddr, timestamp);
  let creamresp2 = await getCreamFiBorrowRatesGraphQ(crUSDCaddr, back5blocks, timestamp);
  let aaveresp3 = await getAaveBorrowRatesGraphQ(sUSDaddr, back5blocks, timestamp);
  let aaveresp4 = await getAaveBorrowRatesGraphQ(USDTaddr, back5blocks, timestamp);
  let compresp4 = await getCompoundBorrowRatesGraphQ(cUSDTaddr, back5blocks, timestamp);
  let creamresp4 = await getCreamFiBorrowRatesGraphQ(crUSDTaddr, back5blocks, timestamp);
  let aaveresp5 = await getAaveBorrowRatesGraphQ(TUSDaddr, back5blocks, timestamp);
  let aaveresp6 = await getAaveBorrowRatesGraphQ(bUSDaddr, back5blocks, timestamp);
  let creamresp6 = await getCreamFiBorrowRatesGraphQ(crbUSDaddr, back5blocks, timestamp);
  let aaveresp7 = await getAaveBorrowRatesGraphQ(gUSDaddr, back5blocks, timestamp);

  let infoArray = [aaveresp, compresp, dydxresp, creamresp, aaveresp2, compresp2, dydxresp2,
                  creamresp2, aaveresp3, aaveresp4, compresp4,creamresp4, aaveresp5,aaveresp6,
                  creamresp6, aaveresp7];

  //console.log(infoArray);
  //addRatesDataTable(dataTable, infoArray);
  saveRates(infoArray);

  let daiStatsRecord = await buildStatRecord('DAI', [aaveresp, compresp, dydxresp, creamresp]);
  let usdcStatsRecord = await buildStatRecord('USDC', [aaveresp2, compresp2, dydxresp2, creamresp2]);
  let usdtStatsRecord = await buildStatRecord('USDT', [aaveresp4, compresp4, creamresp4]);
  let stablecoinStatRecord = await buildStatRecord('StableCoins', infoArray);

  let statsArray = [daiStatsRecord, usdcStatsRecord, usdtStatsRecord, stablecoinStatRecord];

  //console.log(statsArray);
  //addStatsDataTable(statsTable, statsArray);
  saveStats(statsArray);

  let theborrowMarket = 0;

  for (var i = 0; i < infoArray.length; i++) {
    theborrowMarket = theborrowMarket + infoArray[i].totalLiquidity;
  }
  console.log(`The borrowMarket $${theborrowMarket}`)

  setTimeout(() => main(), 60000);
}

let test = async () => {

  let x = [3,6,9,12,5,6,8,7,6,5,4,6,7,5,6,7,8];

  let justanumber = ss.mean(x);
  let themin =ss.min(x);
  let themax =ss.max(x);
  console.log(ss.mean(x), ss.standardDeviation(x), ss.variance(x));
  console.log(gPrice,ethPrice, justanumber, themin, themax);

};

//test();
