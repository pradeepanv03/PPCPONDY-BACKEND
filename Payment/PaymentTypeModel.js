const mongoose = require('mongoose');

const PaymentTypeSchema = new mongoose.Schema({
  paymentType: { type: String, required: true },
  createdDate: { type: Date, required: true }
});

module.exports = mongoose.model('PaymentType', PaymentTypeSchema);
