const mongoose = require('mongoose');

const areaSchema = new mongoose.Schema({
    areaName: {
        type: String,
        required: true,
    },
    state:{
        type:String,
        enum: ['Pudhucherry', 'Tamilnadu', 'Others'],
        required: true,
    }
});

const Area = mongoose.model('Area', areaSchema);

module.exports = Area;
