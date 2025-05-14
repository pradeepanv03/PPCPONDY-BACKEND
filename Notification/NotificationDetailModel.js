
const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
    recipientPhoneNumber: { type: String, required: true }, // Property owner
    senderPhoneNumber: { type: String, required: true }, 
    userPhoneNumber: { type: String},      // Mainly used for filtering (can be same as recipient)
    ppcId: { type: String },
    message: { type: String, required: true },
    type: { type: String },                 // Notification type (interest, update, plan, etc.)

    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("NotificationUser", NotificationSchema);
