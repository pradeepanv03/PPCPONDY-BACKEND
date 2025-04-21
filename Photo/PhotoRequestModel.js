const mongoose = require("mongoose");

const PhotoRequestSchema = new mongoose.Schema(
  {
    ppcId: { type: Number },
    requesterPhoneNumber: { type: String, required: true }, // Buyer's phone number
    postedUserPhoneNumber: { type: String}, // Owner's phone number
    propertyMode: { type: String}, // Sale / Rent
    price: { type: Number },
    propertyType: { type: String}, // Apartment, Villa, etc.
    city: { type: String },
    district: { type: String },
    area: { type: String },
    streetName: { type: String },
    bestTimeToCall: { type: String },
    areaUnit: { type: String },
    length: { type: Number },
    breadth: { type: Number },
    totalArea: { type: Number },
  
    ownership: { type: String },
    photoURL: String,  // Ensure this field exists

    status: {
      type: String,
      enum: ["photo request pending", "photo send", "photo request rejected", "deleted"],
      default: "photo request pending",
    },
    previousStatus: { type: String, default: "" }, // ✅ Stores previous status for Undo

    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PhotoRequest", PhotoRequestSchema);
