const fetch = require('node-fetch');
const {request} =  require ('graphql-request');
const { ethers } = require("ethers");
const fs = require('fs');

const dataTable = './RegRecords.csv'

const url = 'https://mainnet.infura.io/v3/4d5f1b5afb094856bd8dcd86c7bd8dc1';
const provider = new ethers.providers.JsonRpcProvider(url);

const DAIaddr = "0x6b175474e89094c44da98b954eedeac495271d0f";
const cDAIaddr = "0x5d3a536e4d6dbd6114cc1ead35777bab948e3643";
const USDCaddr = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const cUSDCaddr = "0x39aa39c021dfbae8fac545936693ac917d5e7563";

class rateRecord {
  constructor(_protocol, _symbol, _timestamp, _borrow_rate){
    this.protocol = _protocol;
    this.symbol = _symbol;
    this.timestamp = _timestamp;
    this.borrow_rate = _borrow_rate;
  }
}

async function getAaveBorrowRatesGraphQ(asset, block_number, _timestamp){
  try {
    let query2 = `{reserve(id:"${asset}0xb53c1a33016b2dc2ff3653530bff1848a515c8c5",block: {number:${block_number}}) {symbol variableBorrowRate}}`;
    let serverresponse = await request('https://api.thegraph.com/subgraphs/name/aave/protocol-v2', query2);
    let rObject = new rateRecord(
              'Aave-V2',
              serverresponse.reserve.symbol,
              _timestamp,
              parseFloat((parseFloat(serverresponse.reserve.variableBorrowRate)/1e27).toFixed(8))
            );
    return rObject;
  } catch (e) {
    console.log(`Aave-V2: Fetch error: ${_timestamp}`);
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
    let query = `{market (id: "${asset}",block: {number: ${block_number}}) {borrowRate underlyingSymbol}}`
    let serverresponse = await request('https://api.thegraph.com/subgraphs/name/graphprotocol/compound-v2', query);
    let rObject = new rateRecord(
              'Compound-V2',
              serverresponse.market.underlyingSymbol,
              _timestamp,
              parseFloat(parseFloat(serverresponse.market.borrowRate).toFixed(8))
            );
    return rObject;
  } catch (e) {
    console.log(`Compound-V2: Fetch error: ${_timestamp}`);
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
      let APIuri = `https://api.dydx.exchange/v1/markets/${id}`;
      let serverresponse = await fetch(APIuri);
      let rO = await serverresponse.json();
      let rObject = new rateRecord(
                'DyDx-V1',
                rO.market.name,
                _timestamp,
                parseFloat(parseFloat(rO.market.totalBorrowAPR).toFixed(8))
              );
      return rObject;
    } else if (asset == USDCaddr) {
        let id = 2;
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
    }
  } catch (e) {
    console.log(`DyDx-V1: Fetch error: ${_timestamp}`);
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
      let arr = rO.borrowRates.filter(resp => resp.tokenSymbol == id);
      let rObject = new rateRecord(
                'CreamFi-V1',
                arr[0].tokenSymbol,
                _timestamp,
                parseFloat(parseFloat(arr[0].apr).toFixed(8))
              );
      return rObject;
    } else if (asset == USDCaddr) {
      let id = 'USDC';
      let arr = rO.borrowRates.filter(resp => resp.tokenSymbol == id);
      let rObject = new rateRecord(
                'CreamFi-V1',
                arr[0].tokenSymbol,
                _timestamp,
                parseFloat(parseFloat(arr[0].apr).toFixed(8))
              );
      return rObject;
    }
  } catch (e) {
    console.log(`CreamFi-V1: Fetch error: ${_timestamp}`);
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

let mainDAI = async () => {
  let currentblock = await provider.getBlockNumber();
  let back5blocks = currentblock-5;
  let bdata = await provider.getBlock(back5blocks);
  let timestamp =  bdata.timestamp;
  console.log(currentblock,timestamp);
  let aaveresp = await getAaveBorrowRatesGraphQ(DAIaddr,back5blocks,timestamp);
  let compresp = await getCompoundBorrowRatesGraphQ(cDAIaddr,back5blocks,timestamp);
  let dydxresp = await getDyDxBorrowRatesAPI(DAIaddr, timestamp);
  let creamresp = await getCreamFiBorrowRatesAPI(DAIaddr, back5blocks, timestamp);
  console.log(aaveresp, compresp, dydxresp,creamresp);
  addDataTable(dataTable,[aaveresp, compresp, dydxresp,creamresp]);

}

let mainUSDC = async () => {
  let currentblock = await provider.getBlockNumber();
  let back5blocks = currentblock-5;
  let bdata = await provider.getBlock(back5blocks);
  let timestamp =  bdata.timestamp;
  let aaveresp = await getAaveBorrowRatesGraphQ(USDCaddr,back5blocks,timestamp);
  let compresp = await getCompoundBorrowRatesGraphQ(cUSDCaddr,back5blocks,timestamp);
  let dydxresp = await getDyDxBorrowRatesAPI(USDCaddr, timestamp);
  let creamresp = await getCreamFiBorrowRatesAPI(USDCaddr, back5blocks, timestamp);
  console.log(aaveresp, compresp, dydxresp,creamresp);
  addDataTable(dataTable,[aaveresp, compresp, dydxresp,creamresp]);

}

setInterval(() => {
  mainDAI();
  mainUSDC();
}, 60000);
