// models/FollowUp.js
const mongoose = require('mongoose');

const followUpSchema = new mongoose.Schema({
ppcId:{
    type:String
},
phoneNumber:{
  type:String
},
adminName:{
  type:String
},
  followupStatus: {
    type: String,
    enum: ['Ring', 'Ready To Pay', 'Not Decided', 'Not Interested-Closed', 'Paid Closed'],
    required: true
  },
  followupType: {
    type: String,
    enum: ['Payment Followup', 'Data Followup', 'Enquiry Followup'],
    required: true
  },
  followupDate: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('FollowUp', followUpSchema);
