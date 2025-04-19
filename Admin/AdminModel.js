
const mongoose = require('mongoose');

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















// const mongoose = require('mongoose');
// const bcrypt = require('bcryptjs');  // Import bcryptjs for hashing

// const AdminLoginSchema = mongoose.Schema({
//     name: {
//         type: String,
//         required: true,
//     },
//     address: {
//         type: String,
//         // required: true, // Optional field
//     },
//     office: {
//         type: String,
//         enum: ['AUROBINDO', 'SAINT'],
//     },
//     jobType: {
//         type: String,
//         required: true, 
//         enum: ['Full-time', 'Part-time'],
//     },
//     targetWeek: {
//         type: Number,
//         // required: true, // Optional field
//     },
//     targetMonth: {
//         type: String,
//         // required: true, // Optional field
//     },
//     mobile: {
//         type: String,
//         match: /^[0-9]{10}$/, // Validate the mobile number (10 digits)
//     },
//     aadhaarNumber: {
//         type: String,
//         match: /^[0-9]{12}$/, // Validate Aadhaar number (12 digits)
//     },
//     userName: {
//         type: String,
//         // required: true, // Optional field
//     },
//     password: {
//         type: String,
//         required: true, 
//         minlength: 6, // Password must be at least 6 characters long
//     },
//     role: {
//         type: String,
//         required: true, 
//         enum: ['manager', 'admin', 'accountant'], 
//     },
//     userType: {
//         type: String,
//         required: true, 
//         enum: ['all', 'PUC', 'TUC'],
//     }
// });

// // Middleware to hash the password before saving the user
// AdminLoginSchema.pre('save', async function (next) {
//     if (!this.isModified('password')) return next();  // Skip if password is not modified

//     try {
//         const salt = await bcrypt.genSalt(10);  // Generate salt
//         this.password = await bcrypt.hash(this.password, salt);  // Hash the password
//         next();
//     } catch (err) {
//         next(err);
//     }
// });

// // Method to compare the entered password with the hashed password in the DB
// AdminLoginSchema.methods.matchPassword = async function (enteredPassword) {
//     return await bcrypt.compare(enteredPassword, this.password);  // Compare entered password with stored hash
// };

// module.exports = mongoose.model('AdminLogin', AdminLoginSchema);
