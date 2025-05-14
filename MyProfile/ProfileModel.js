const mongoose = require("mongoose");

const ProfileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true},
    email: { type: String, unique: true },
    mobile: { type: String },
    address: { type: String },
    profileImage: { type: String }, // Store image URL or file path
    password: { type: String },
    pucNumber:
    { type: String },
    createdBy: { type: String }, // 👈 Store admin name or ID


  },
  { timestamps: true }
);

module.exports = mongoose.model("ProfileData", ProfileSchema);
