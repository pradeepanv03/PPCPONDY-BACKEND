const mongoose = require("mongoose");

const BuyerAssistanceSchema = new mongoose.Schema({
  ba_id: { type: Number, required: true },  // Unique BA ID per user
  ppcId:{type: String},
  phoneNumber: { type: String, required: true },
  altPhoneNumber: String,
  city: { type: String, required: true },
  area: { type: String, required: true },
  loanInput: {
    type:String,
  },
  minPrice:{
    type:String,
  },
  maxPrice: {
    type:String,
  },
  totalArea:{
    type:String,
  },
  areaUnit: {
    type:String,
  },
  noOfBHK: {
    type:String,
  },
  propertyMode: {
    type:String,
  },
  propertyType:{
    type:String,
  },
  propertyAge:{
    type:String,
  },
  bankLoan: { type: String, }, 
  propertyApproved: { type: String,  }, 
  facing: {
    type:String,
  },
  state: { type: String},
  
  interestedUserPhone: { type: String }, // ✅ Store user who clicks interest

  ba_status:{
type:String,
ennum:["buyer-assiatance-interest","remove-assistance-interest"]
  },
 
  paymentType: { type: String, required: true },
  description: String,
  isDeleted: { type: Boolean, default: false },   // Soft delete flag
  deletedAt: { type: Date, default: null }  
}, { timestamps: true });


module.exports = mongoose.model("BuyerAssistance", BuyerAssistanceSchema);
