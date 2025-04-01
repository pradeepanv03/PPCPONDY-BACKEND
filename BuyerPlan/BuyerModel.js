const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  planName: { type: String, required: true },
  planAmount: { type: String, required: true },
  planValidity: { type: String, required: true },
  numberOfAssistants: { type: String, required: true },
  serviceType: { type: String, required: true },
  createDate: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['active', 'hide'],
    default: 'active'
},
});

const BuyerPlan = mongoose.model('BuyerPlan', planSchema);

module.exports = BuyerPlan;
