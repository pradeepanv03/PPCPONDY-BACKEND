const mongoose = require("mongoose");



const BuyerAssistanceSchema = new mongoose.Schema({
  ba_id: { type: Number },  // Unique BA ID per user
  baName:{
    type:String
  },
  ppcId:{type: String},
  phoneNumber: { type: String, required: true },
  altPhoneNumber:{
    type: String,
  },
  city: { type: String,required: true },
  area: { type: String, required: true },
  loanInput: {
    type:String,
  },
  minPrice:{
    type:String,
    required: true
  },
  maxPrice: {
    type:String,
    required: true
  },
  totalArea:{
    type:String,
  },
  areaUnit: {
    type:String,
    required: true
  },
  bedrooms: {
    type:String,
  },
  propertyMode: {
    type:String,
    
  },
  propertyType:{
    type:String,
    required: true
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
enum:["buyer-assiatance-interest","remove-assistance-interest"]
},
 
  paymentType: { type: String },
  description: String,
  isDeleted: { type: Boolean, default: false },   // Soft delete flag
  deletedAt: { type: Date, default: null }  
}, { timestamps: true });


module.exports = mongoose.model("BuyerAssistance", BuyerAssistanceSchema);
