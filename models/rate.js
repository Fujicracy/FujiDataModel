const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const rateSchema= new Schema({
  protocol: {
    type: String,
    required: true
  },
  symbol: {
    type: String,
    required: true
  },
  borrowRate: {
    type: Number,
    required: true
  },
  totalLiquidity: {
    type: Number,
    required: true
  },
  utilizationRatio: {
    type: Number,
    required: true
  },
}, { timestamps: true });

const Rate = mongoose.model('Rate', rateSchema);

module.exports = Rate;
