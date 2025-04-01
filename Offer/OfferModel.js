

const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
    price: {
        type: Number,
        required: true
    },
    ppcId: {
        type: Number,
        required: true
    },
    phoneNumber: {
        type: String,
        required: true,
    },
    originalPrice: { type: Number },  // ✅ Add this field
    postedUserPhoneNumber: { type: String }, // ✅ Add this field
    status: {
        type: String,
        enum:['accept','reject','pending','offerSend','delete'],
        default: 'pending',
      },
      previousStatus: { type: String, enum: ["pending", "accept", "reject","delete"] }, 

    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Create the model from the schema
const Offer = mongoose.model('Offer', offerSchema);

module.exports = Offer;


