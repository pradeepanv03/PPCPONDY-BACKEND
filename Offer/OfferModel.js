


const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
    price: { type: Number, required: true },
    ppcId: { type: Number, required: true },
    phoneNumber: { type: String, required: true }, // Buyer phone
    originalPrice: { type: Number },
    postedUserPhoneNumber: { type: String }, // Owner phone
    status: {
        type: String,
        enum: ['accept', 'reject', 'pending', 'offerSend', 'delete'],
        default: 'pending',
    },
    previousStatus: {
        type: String,
        enum: ['pending', 'accept', 'reject', 'delete']
    },
    bedrooms: { type: String },
    totalArea: { type: Number },
    
    areaUnit: { type: String },

    propertyMode: { type: String },
    ownership: { type: String },
    propertyType: { type: String },
    createdAt: {
        type: Date,
        default: Date.now
    },
      // ... your existing fields ...
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
  },
  deletedBy: {
   type:String,
    default: 'Admin'
  }
});

const Offer = mongoose.model('Offer', offerSchema);
module.exports = Offer;
