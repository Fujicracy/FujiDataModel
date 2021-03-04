const fetch = require('node-fetch');
const {request} =  require ('graphql-request');
const { ethers } = require("ethers");
const fs = require('fs');

const dataTable = './RegRecords.csv'
const testTable = './TestRecords.csv'

const url = 'https://mainnet.infura.io/v3/4d5f1b5afb094856bd8dcd86c7bd8dc1';
const provider = new ethers.providers.JsonRpcProvider(url);

const DAIaddr = "0x6b175474e89094c44da98b954eedeac495271d0f";
const cDAIaddr = "0x5d3a536e4d6dbd6114cc1ead35777bab948e3643";
const USDCaddr = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const cUSDCaddr = "0x39aa39c021dfbae8fac545936693ac917d5e7563";
const sUSDaddr = "0x57ab1ec28d129707052df4df418d58a2d46d5f51";
const USDTaddr = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const cUSDTaddr = "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9";
const TUSDaddr = "0x0000000000085d4780b73119b644ae5ecd22b376";
const bUSDaddr = "0x4fabb145d64652a948d72533023f6e7a623c7c53";
const gUSDaddr = "0x056fd409e1d7a124bd7017459dfea2f387b6d5cd"

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

async function getAaveBorrowRatesGraphQ(asset, block_number, _timestamp){
  try {
    let query = `{ reserve (id:"${asset}0xb53c1a33016b2dc2ff3653530bff1848a515c8c5", block: {number: ${block_number}})
    {symbol variableBorrowRate utilizationRate totalLiquidity}}`;
    let serverresponse = await request('https://api.thegraph.com/subgraphs/name/aave/protocol-v2', query);
    let rObject = new rateRecord(
              'Aave-V2',
              serverresponse.reserve.symbol,
              _timestamp,
              parseFloat((parseFloat(serverresponse.reserve.variableBorrowRate)/1e27).toFixed(8)),
              parseFloat((parseFloat(serverresponse.reserve.totalLiquidity)/1e18).toFixed(0)),
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

    console.log(totalCash, tBorrowed, reserv, utilR);

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
  try {
    if (asset == DAIaddr) {
      let id = 3;
    } else if (asset == USDCaddr) {
      let id = 2;
    }
    let APIuri = `https://api.dydx.exchange/v1/markets/${id}`;
    let serverresponse = await fetch(APIuri);
    let rO = await serverresponse.json();
    let rObject = new rateRecord(
              'DyDx-V1',
              'USDC',
              _timestamp,
              parseFloat(parseFloat(rO.market.totalBorrowAPR).toFixed(8))
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
}

async function getCreamFiBorrowRatesAPI(asset, block_number, _timestamp){
  try {
    let APIuri = `https://api.cream.finance/api/v1/rates?block_number=${block_number}&comptroller=eth`;
    let serverresponse = await fetch(APIuri);
    let rO = await serverresponse.json();

    if (asset == DAIaddr) {
      let id = 'DAI';
    } else if (asset == USDCaddr) {
      let id = 'USDC';
    } else if (asset == USDTaddr) {
      let id = 'USDT';
    } else if (asset == bUSDaddr) {
      let id = 'BUSD';
    }

    let arr = rO.borrowRates.filter(resp => resp.tokenSymbol == id);
    let rObject = new rateRecord(
              'CreamFi-V1',
              arr[0].tokenSymbol,
              _timestamp,
              parseFloat(parseFloat(arr[0].apr).toFixed(8))
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
}



function addDataTable(_document, records){
  for (var i = 0; i < records.length; i++) {
    fs.appendFile(_document,
      records[i].protocol+', '+
      records[i].symbol+', '+
      records[i].timestamp+', '+
      records[i].borrow_rate+'\n',
      function (err) {
        if (err) throw err;
      });
  }
  console.log(records[0].timestamp, ' Rates Registered!');
};

let main = async () => {
  let currentblock = await provider.getBlockNumber();
  let back5blocks = currentblock-5;
  let bdata = await provider.getBlock(back5blocks);
  let timestamp =  bdata.timestamp;
  console.log(currentblock,timestamp);
  let aaveresp = await getAaveBorrowRatesGraphQ(DAIaddr,back5blocks,timestamp);
  let compresp = await getCompoundBorrowRatesGraphQ(cDAIaddr,back5blocks,timestamp);
  let dydxresp = await getDyDxBorrowRatesAPI(DAIaddr, timestamp);
  let creamresp = await getCreamFiBorrowRatesAPI(DAIaddr, back5blocks, timestamp);
  let aaveresp2 = await getAaveBorrowRatesGraphQ(USDCaddr,back5blocks,timestamp);
  let compresp2 = await getCompoundBorrowRatesGraphQ(cUSDCaddr,back5blocks,timestamp);
  let dydxresp2 = await getDyDxBorrowRatesAPI(USDCaddr, timestamp);
  let creamresp2 = await getCreamFiBorrowRatesAPI(USDCaddr, back5blocks, timestamp);
  let aaveresp3 = await getAaveBorrowRatesGraphQ(sUSDaddr,back5blocks,timestamp);
  let aaveresp4 = await getAaveBorrowRatesGraphQ(USDTaddr,back5blocks,timestamp);
  let compresp4 = await getCompoundBorrowRatesGraphQ(cUSDTaddr,back5blocks,timestamp);
  let creamresp4 = await getCreamFiBorrowRatesAPI(USDTaddr, back5blocks, timestamp);
  let aaveresp5 = await getAaveBorrowRatesGraphQ(TUSDaddr,back5blocks,timestamp);
  let aaveresp6 = await getAaveBorrowRatesGraphQ(bUSDaddr,back5blocks,timestamp);
  let creamresp6 = await getCreamFiBorrowRatesAPI(bUSDaddr, back5blocks, timestamp);
  let aaveresp7 = await getAaveBorrowRatesGraphQ(gUSDaddr,back5blocks,timestamp);
  console.log(aaveresp, compresp, dydxresp,creamresp, aaveresp2, compresp2, dydxresp2,creamresp2,
              aaveresp3, aaveresp4, compresp4,creamresp4,aaveresp5,aaveresp6,creamresp6,
              aaveresp7
            );
  addDataTable(dataTable,[aaveresp, compresp, dydxresp, creamresp, aaveresp2, compresp2, dydxresp2,
                          creamresp2, aaveresp3, aaveresp4, compresp4,creamresp4, aaveresp5,aaveresp6,
                          creamresp6, aaveresp7
                        ]);
}

//setInterval(() => {
//  main();
//}, 60000);


let test = async () => {
  let currentblock = await provider.getBlockNumber();
  let back5blocks = currentblock-5;
  let bdata = await provider.getBlock(back5blocks);
  let timestamp =  bdata.timestamp;
  console.log(currentblock, back5blocks, timestamp);
  let aaveresp = await getAaveBorrowRatesGraphQ(DAIaddr,back5blocks,timestamp);
  let compresp = await getCompoundBorrowRatesGraphQ(cDAIaddr,back5blocks,timestamp);
  //let dydxresp = await getDyDxBorrowRatesAPI(DAIaddr, timestamp);
  //let creamresp = await getCreamFiBorrowRatesAPI(DAIaddr, back5blocks, timestamp);
  console.log(aaveresp,compresp);
}

test();
