const mongoose = require('mongoose');

const districtSchema = new mongoose.Schema({
    districtName: {
        type: String,
        required: true,
    },
    state:{
        type:String,
        enum: ['Pudhucherry', 'Tamilnadu', 'Others'],
        required: true,
    }
});

const District = mongoose.model('District', districtSchema);

module.exports = District;
