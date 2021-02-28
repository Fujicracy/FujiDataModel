var ethers = require('ethers');
var url = 'https://mainnet.infura.io/v3/4d5f1b5afb094856bd8dcd86c7bd8dc1';

var provider = new ethers.providers.JsonRpcProvider(url);
address = "0xEA7D443EcB40E2189d674256DfF3CC32b35C1430"
signer = new ethers.VoidSigner(address, provider);



const DAIaddress = "0x6b175474e89094c44da98b954eedeac495271d0f";



// Query information for Aave_V2
const aaveLendingPool = "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9";

//AaveLendingPool Contract ABI (this is the Human-Readable ABI format)
const aaveLPoolAbi = [
  "function getReserveData(address asset) external view returns (DataTypes.ReserveData)",
];

// Query information for Compound_V2
const compoundcDAI = "0x5d3a536e4d6dbd6114cc1ead35777bab948e3643";

//Compound Contract ABI (this is the Human-Readable ABI format)
const cTokenAbi = [
  "function borrowRatePerBlock() returns (uint)",
];


// The Aave Contract object
const aaveLPoolContract = new ethers.Contract(aaveLendingPool, aaveLPoolAbi, signer);


// The Aave Contract object
const compoundcDAIContract = new ethers.Contract(compoundcDAI, cTokenAbi, signer);




//Main Function

const main = async () => {
  //let accounts = await ethers.provider.listAccounts();
  //console.log(acc);
  let aaveRate = await aaveLPoolContract.getReserveData(DAIaddress);
  console.log(aaveRate);
  //let compoundRate = await compoundcDAIContract.estimateGas.borrowRatePerBlock();
  //console.log(compoundRate);
  //let currentblock = await provider.getBlockNumber();
  //let bdata = await provider.getBlock(currentblock);
  //let timestamp =  bdata.timestamp;
  //console.log(currentblock, timestamp);
}

main();
