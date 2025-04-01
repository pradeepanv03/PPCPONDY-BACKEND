

const mongoose = require('mongoose');

const countryCodes = [
    '+1',   // USA, Canada
    '+44',  // UK
    '+91',  // India
    '+61',  // Australia
    '+81',  // Japan
    '+49',  // Germany
    '+33',  // France
    '+34',  // Spain
    '+55',  // Brazil
    '+52',  // Mexico
    '+61',  // Australia
    '+86',  // China
    '+39',  // Italy
    '+7',   // Russia (and Kazakhstan)
    '+34',  // Spain
    '+81',  // Japan
    '+64',  // New Zealand
    '+27',  // South Africa
    '+31',  // Netherlands
    '+46',  // Sweden
    '+47',  // Norway
    '+48',  // Poland
    '+55',  // Brazil
    '+53',  // Cuba
    '+60',  // Malaysia
    '+62',  // Indonesia
    '+63',  // Philippines
    '+64',  // New Zealand
    '+66',  // Thailand
    '+72',  // Sri Lanka
    '+92',  // Pakistan
    '+94',  // Sri Lanka
    '+98',  // Iran
    '+996', // Kyrgyzstan
    '+233', // Ghana
    '+216', // Tunisia
    '+251', // Ethiopia
    '+254', // Kenya
    '+256', // Uganda
    '+263', // Zimbabwe
    '+972', // Israel
    '+971', // UAE
    '+880', // Bangladesh
    '+234', // Nigeria
    '+254', // Kenya
    '+503', // El Salvador
    '+504', // Honduras
    '+505', // Nicaragua
    '+506', // Costa Rica
    '+507', // Panama
    '+512', // Peru
    '+593', // Ecuador
    '+595', // Paraguay
    '+597', // Suriname
    '+598', // Uruguay
    '+1-246', // Barbados
    '+1-268', // Antigua and Barbuda
    '+1-345', // Cayman Islands
    '+1-441', // Bermuda
    '+1-473', // Grenada
    '+1-649', // Turks and Caicos Islands
    '+1-664', // Montserrat
    '+1-721', // Sint Maarten
    '+1-758', // Saint Lucia
    '+1-784', // Saint Vincent and the Grenadines
    '+1-787', // Puerto Rico
    '+1-939', // Puerto Rico (alternate)
    '+44-20', // London (UK)
    '+44-121', // Birmingham (UK)
    '+44-161', // Manchester (UK)
    '+44-113', // Leeds (UK)
  ];
  

  const UserLogin = new mongoose.Schema({
    phone: {
        type: String, // Changed from Number to String
        required: true,
        match: [/^\d{10}$/, 'Phone number must be 10 digits'],
    },
    otp: {
        type: String,
        required: true,
    },
    loginDate: {
        type: Date,
        required: true,
        default: Date.now, // Automatically set login date if not provided
    },
    otpStatus: {
        type: String,
        required: true,
        enum: ['pending', 'verified'],
        default: 'pending',
    },
    countryCode: {
        type: String,
        required: true,
        enum: countryCodes,
        default: '+91',
    },
    loginMode: {
        type: String,
        enum: ['web', 'app'],
        required: true,
    },
    reportDate: { type: Date, default: null },
    deletedDate: { type: Date, default: null },
    bannedDate: { type: Date, default: null },
    version: { type: String, default: null },
    staffName: { type: String, default: null },
    remarks: { type: String, default: '' },
    issueDetails: { type: String, default: null },
    bannedReason: { type: String, default: null },
    status: {
        type: String,
        enum: ['active', 'banned', 'deleted','normal'], // Added 'active' as a default status
        default: 'active',
    },
});



module.exports = mongoose.model('UserLogin', UserLogin);
