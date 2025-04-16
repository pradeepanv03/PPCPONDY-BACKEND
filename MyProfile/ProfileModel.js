const mongoose = require("mongoose");

const ProfileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true},
    email: { type: String, unique: true },
    mobile: { type: String },
    address: { type: String },
    profileImage: { type: String }, // Store image URL or file path
    password: { type: String },



  },
  { timestamps: true }
);

module.exports = mongoose.model("ProfileData", ProfileSchema);
