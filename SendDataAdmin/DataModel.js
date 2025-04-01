

const mongoose = require('mongoose');

const DataSchema = new mongoose.Schema({
  field: { type: String, required: true },  
  value: { type: String, required: true }, 

}, { timestamps: true }); 

const DataModel = mongoose.model('Data', DataSchema);

module.exports = DataModel;
