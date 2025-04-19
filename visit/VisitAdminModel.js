const mongoose = require('mongoose');

const UserInteractionSchema = new mongoose.Schema({
    userName: { type: String, required: true }, // Name of the user
    viewedFile: { type: String, required: true }, // Name of the file being viewed
    viewTime: { type: Date, default: Date.now }, // Timestamp of the interaction
});

const UserInteraction = mongoose.model('UserInteraction', UserInteractionSchema);

module.exports = UserInteraction;
