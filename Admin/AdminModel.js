




const mongoose = require('mongoose');

// User schema with additional fields
const AdminLoginSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    address: {
        type: String,
        // required: true,
    },
    office: {
        type: String,
        // required: true, 
        enum: ['AUROBINDO', 'SAINT'],

    },
    jobType: {
        type: String,
        required: true, 
        enum: ['Full-time', 'Part-time'],
    },
    targetWeek: {
        type: Number,
        // required: true, 
    },
    targetMonth: {
        type: String,
        // required: true, 
    },
    mobile: {
        type: String,
        // required: true, 
        match: /^[0-9]{10}$/, // Validate the mobile number (10 digits)
    },
    aadhaarNumber: {
        type: String,
        // required: true, 
        match: /^[0-9]{12}$/, // Validate Aadhaar number (12 digits)
    },
    userName: {
        type: String,
        // required: true,
    },
    password: {
        type: String,
        required: true, 
        minlength: 6, // Password must be at least 6 characters long
    },
    role: {
        type: String,
        required: true, 
        enum: ['manager', 'admin', 'accountant'], 
    },
    userType: {
        type: String,
        required: true, 
        enum: ['all', 'PUC', 'TUC'],
    }
});

module.exports = mongoose.model('AdminLogin', AdminLoginSchema);
