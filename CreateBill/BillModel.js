const mongoose = require('mongoose');

const BillSchema = new mongoose.Schema({
  adminOffice: { type: String, required: true },
  adminName: { type: String, required: true },
  ppId: { type: String, required: true },
  billNo: { type: String, required: true },
  billDate: { type: String, required: true },
  ownerPhone: { type: String, required: true },
  paymentType: { type: String, required: true },
  planName: { type: String, required: true },
  billAmount: { type: Number, required: true },
  validity: { type: Number, required: true },
  noOfAds: { type: Number, required: true },
  featuredAmount: { type: Number, required: true },
  featuredValidity: { type: Number, required: true },
  featuredMaxAds: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  netAmount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  billCreatedBy:{type:String,
    default:"User",
  }
});

module.exports = mongoose.model('Bill', BillSchema);
