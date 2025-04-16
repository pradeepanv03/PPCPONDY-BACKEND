

const mongoose = require("mongoose");

// Define Schema
const TextSchema = new mongoose.Schema({
    type: { type: String, required: true },
    content: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now }
});


// Create Model
const TextModel = mongoose.model("Text", TextSchema);

module.exports = TextModel;
