const mongoose = require('mongoose');

const OfficeSchema = new mongoose.Schema({
  officeName: {
    type: String,
    required: true,
  },
  landLine: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
   

  mobile: {
    type: String,
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('OfficeModel', OfficeSchema);
