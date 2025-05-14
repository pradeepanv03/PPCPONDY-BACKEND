

const mongoose = require('mongoose');

const CallUserListSchema = new mongoose.Schema({
  ppcId: {
    type: Number,
    required: true,
    index: true,
  },
  phoneNumber: { // the number of the person who clicked "call"
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['callRequestWaiting', 'calledUser', 'callFailed'],
    default: 'callRequestWaiting',
  },
  
  date: {
    type: Date,
    default: Date.now,
  },

  // Additional fields from the AddSchema
  propertyPhoneNumber: String,
  propertyMode: String,
  propertyType: String,
  postedBy: String,
  area: String,
  city: String,
  district: String,
  state: String,
  bestTimeToCall:String,
  areaUnit:String,
  totalArea:String,
  bedrooms:String,
  facing:String,
  ownership:String,
  isDeleted: {
    type: Boolean,
    default: false,
  }

}, {
  timestamps: true,
});

module.exports = mongoose.model('CallUserList', CallUserListSchema);