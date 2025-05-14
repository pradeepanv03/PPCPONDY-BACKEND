
const mongoose = require("mongoose");

const UserViewsSchema = new mongoose.Schema(
  {
    phoneNumber: { type: String }, // Viewer's phone number
    viewedProperties: [
      {
        ppcId: { type: Number },
        viewerPhoneNumber: { type: String,  index: true }, 
        propertyOwnerPhoneNumber: { type: String},
        viewedAt: { type: Date, default: Date.now },
        photos:{
          type:String,
        }
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserViews", UserViewsSchema);




