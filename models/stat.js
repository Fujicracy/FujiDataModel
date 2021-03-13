const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const statSchema= new Schema({
  symbol: {
    type: String,
    required: true
  },
  averageRate: {
    type: String,
    required: true
  },
  minRate: {
    type: Number,
    required: true
  },
  maxRate: {
    type: Number,
    required: true
  },
  stdev: {
    type: Number,
    required: true
  },
  variance: {
    type: Number,
    required: true
  },
  gasPrice: {
    type: Number,
    required: true
  },
  ethPrice: {
    type: Number,
    required: true
  },
}, { timestamps: true });

const Stat = mongoose.model('Stat', statSchema);

module.exports = Stat;

