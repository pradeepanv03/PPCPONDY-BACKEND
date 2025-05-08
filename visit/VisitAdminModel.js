const mongoose = require('mongoose');

const UserInteractionSchema = new mongoose.Schema({
    userName: { type: String}, // Name of the user
    phoneNumber: { type: String },
    role: {
        type: String,
        enum: ['manager', 'admin', 'accountant'], // Allowed roles only
    },
    viewedFile: { type: String, required: true }, // Name of the file being viewed
    viewTime: { type: Date, default: Date.now }, // Timestamp of the interaction
});

const UserInteraction = mongoose.model('UserInteraction', UserInteractionSchema);

module.exports = UserInteraction;
