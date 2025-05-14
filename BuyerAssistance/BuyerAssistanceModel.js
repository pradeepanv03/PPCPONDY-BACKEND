const mongoose = require("mongoose");





const BuyerAssistanceSchema = new mongoose.Schema({
  ba_id: {
    type: Number,
    unique: true,
    required: true,
  },
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


ba_status: {
  type: String,
  enum: ["buyer-assistance-interest", "buyer-interest-tried", "baActive", "baPending"], // ✅ Corrected
  default: "baPending",
},
 
  paymentType: { type: String },
  description: String,
  isDeleted: { type: Boolean, default: false },   // Soft delete flag
  deletedAt: { type: Date, default: null }  
}, { timestamps: true });


module.exports = mongoose.model("BuyerAssistance", BuyerAssistanceSchema);





// const BuyerAssistanceSchema = new mongoose.Schema({
//   ba_id: { 
//     type: Number, 
//     required: true, 
//     unique: true 
//   },
//   baName: {
//     type: String
//   },
//   ppcId: {
//     type: String
//   },
//   phoneNumber: { 
//     type: String, 
//     required: true 
//   },
//   altPhoneNumber: {
//     type: String
//   },
//   city: { 
//     type: String,
//     required: true 
//   },
//   area: { 
//     type: String, 
//     required: true 
//   },
//   loanInput: {
//     type: String
//   },
//   minPrice: {
//     type: String,
//     required: true
//   },
//   maxPrice: {
//     type: String,
//     required: true
//   },
//   totalArea: {
//     type: String
//   },
//   areaUnit: {
//     type: String,
//     required: true
//   },
//   bedrooms: {
//     type: String
//   },
//   propertyMode: {
//     type: String  
//   },
//   propertyType: {
//     type: String,
//     required: true
//   },
//   propertyAge: {
//     type: String
//   },
//   bankLoan: { 
//     type: String
//   },
//   propertyApproved: { 
//     type: String
//   },
//   facing: {
//     type: String
//   },
//   state: { 
//     type: String
//   },
//   interestedUserPhone: { 
//     type: [String],
//     default: [],
//     validate: {
//       validator: function(v) {
//         return v === null || 
//                v === undefined || 
//                (Array.isArray(v) && v.every(item => typeof item === "string"));
//       },
//       message: "interestedUserPhone must be an array of strings"
//     }
//   },
//   ba_status: {
//     type: String,
//     enum: ["buyer-assistance-interest", "remove-assistance-interest", "baActive", "baPending"],
//     default: "baPending"
//   },
//   paymentType: { 
//     type: String 
//   },
//   description: { 
//     type: String 
//   },
//   isDeleted: { 
//     type: Boolean, 
//     default: false 
//   },
//   deletedAt: { 
//     type: Date, 
//     default: null 
//   }
// }, { 
//   timestamps: true 
// });
// // Add this pre-save hook to prevent future issues
// BuyerAssistanceSchema.pre('save', function(next) {
//   if (this.interestedUserPhone && !Array.isArray(this.interestedUserPhone)) {
//     this.interestedUserPhone = [this.interestedUserPhone];
//   } else if (!this.interestedUserPhone) {
//     this.interestedUserPhone = [];
//   }
//   next();
// });


// module.exports = mongoose.model("BuyerAssistance", BuyerAssistanceSchema);