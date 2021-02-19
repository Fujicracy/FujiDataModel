var ethers = require('ethers');
var url = 'https://mainnet.infura.io/v3/4d5f1b5afb094856bd8dcd86c7bd8dc1';
var provider = new ethers.providers.JsonRpcProvider(url);

const DAIaddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const randomWallet = ethers.Wallet.createRandom().connect(provider);
console.log(randomWallet);


// Query information for Aave_V2
const aaveLendingPool = "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9";

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
const aaveLPoolContract = new ethers.Contract(aaveLendingPool, aaveLPoolAbi, randomWallet);

// The Aave Contract object
const compoundcDAIContract = new ethers.Contract(compoundcDAI, cTokenAbi, randomWallet);




//Main Function

const main = async () => {
  let aaveRate = await aaveLPoolContract.getReserveData(DAIaddress);
  console.log(aaveRate);
  //let compoundRate = await compoundcDAIContract.estimateGas.borrowRatePerBlock();
  //console.log(compoundRate);
}

main();
