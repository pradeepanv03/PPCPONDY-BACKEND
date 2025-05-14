const mongoose = require('mongoose');

const rollSchema = new mongoose.Schema({
    rollType: {
        type: String,
        required: true,
    },
    createdDate: {
        type: Date,
        default: Date.now,
        required: true,
    }
});

const Roll = mongoose.model('Roll', rollSchema);

module.exports = Roll;
