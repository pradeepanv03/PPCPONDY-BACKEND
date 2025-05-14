// models/DeletedAddModel.js
const mongoose = require('mongoose');

const DeletedAddSchema = new mongoose.Schema({
  ppcId: String,
  propertyType: String,
  propertyMode: String,
phoneNumber: String,
  price: Number,
  status: String,
  deletedAt: {
    type: Date,
    default: Date.now
  }
});

const DeletedAddModel = mongoose.model('DeletedAddModel', DeletedAddSchema);

module.exports = DeletedAddModel;
