const mongoose = require('mongoose');

const citySchema = new mongoose.Schema({
    cityName: {
        type: String,
        required: true,
    },
    state:{
        type:String,
        enum: ['Pudhucherry', 'Tamilnadu', 'Others'],
        required: true,
    }
});

const City = mongoose.model('City', citySchema);

module.exports = City;
