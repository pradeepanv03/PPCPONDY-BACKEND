

const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    userPhoneNumber: { type: String, required: true }, // User receiving the notification
    message: { type: String, required: true }, // Notification message
    type: { type: String, enum: ["message", "warning"], required: true }, // Type of notification
    ppcId: { type: Number, required: false }, // Linked property (if applicable) 
    isRead: { type: Boolean, default: false }, // Read status
    createdAt: { type: Date, default: Date.now }, // Timestamp
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", NotificationSchema);
