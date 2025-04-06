// models/NotificationModel.js

const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
    recipientPhoneNumber: { type: String, required: true }, // Property owner
    senderPhoneNumber: { type: String, required: true },     // Person showing interest
    ppcId: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("NotificationUser", NotificationSchema);
