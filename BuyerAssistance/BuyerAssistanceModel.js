const mongoose = require("mongoose");



// const minPriceEnum = [
//   "0", "50001", "100001", "200001", "300001", "800001", "1000001", "1200001",
//   "1500001", "2000001", "2500001", "3000001", "4000001", "5000001", "7000001",
//   "8000001", "10000001", "20000001", "50000001", "70000001", "100000001",
//   "150000001"
// ];

// const maxPriceEnum = [
//   "50000", "100000", "200000", "300000", "800000", "1000000", "1200000", "1500000",
//   "2000000", "2500000", "3000000", "4000000", "5000000", "7000000", "8000000",
//   "10000000", "20000000", "50000000", "70000000", "100000000", "150000000",
//   "15 cr+"
// ];


const BuyerAssistanceSchema = new mongoose.Schema({
  ba_id: { type: Number, required: true, unique: true 
   },  // Unique BA ID per user
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
  
  interestedUserPhone: { type: [String] }, // ✅ Store user who clicks interest

  ba_status:{
type:String,
enum:["buyer-assiatance-interest","remove-assistance-interest","baActive","baPending"],
default:"baPending",
},
 
  paymentType: { type: String },
  description: String,
  isDeleted: { type: Boolean, default: false },   // Soft delete flag
  deletedAt: { type: Date, default: null }  
}, { timestamps: true });


module.exports = mongoose.model("BuyerAssistance", BuyerAssistanceSchema);
