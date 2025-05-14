const express = require('express');
const router = express.Router();
const AdminLogin = require('../Admin/AdminModel')
const ProfileData = require("../MyProfile/ProfileModel");



// Admin login route (POST /adminlogin)
router.post('/adminlogin', async (req, res) => {
    const { name, password, role, userType } = req.body;

    try {
        // Find the admin by name only
        const admin = await AdminLogin.findOne({ name });
        if (!admin) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Check password, role, and userType
        if (
            admin.password !== password || 
            admin.role !== role || 
            admin.userType !== userType
        ) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Success response
        return res.status(200).json({ 
            message: 'Login successful', 
            data: {
                name: admin.name,
                role: admin.role,
                userType: admin.userType
            }
        });

    } catch (error) {
        return res.status(500).json({ message: 'Something went wrong', error: error.message });
    }
});



router.get('/get-admin-logs', async (req, res) => {
    const { page = 1, limit = 10 } = req.query; // Set default page and limit

    try {
        const logs = await AdminLogin.find()
            .skip((page - 1) * limit)  // Skip the appropriate number of records based on the page
            .limit(Number(limit))  // Limit the number of records returned
            .sort({ date: -1 }); // Sort logs by date in descending order (latest first)

        const totalLogs = await AdminLogin.countDocuments(); // Get the total number of logs

        return res.status(200).json({
            logs,
            totalLogs,
            totalPages: Math.ceil(totalLogs / limit),  // Calculate total pages
            currentPage: page
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Server Error',
            error: error.message
        });
    }
});


router.post('/admin-create', async (req, res) => {
    const newUser = new AdminLogin({
        name: req.body.name,
        address: req.body.address,
        office: req.body.office,
        jobType: req.body.jobType,
        targetWeek: req.body.targetWeek,
        targetMonth: req.body.targetMonth,
        mobile: req.body.mobile,
        aadhaarNumber: req.body.aadhaarNumber,
        userName: req.body.userName,
        password: req.body.password,
        role: req.body.role,
        userType: req.body.userType
    });

    try {
        const savedUser = await newUser.save();
        res.status(201).json(savedUser);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get all users
router.get('/admin-all', async (req, res) => {
    try {
        const users = await AdminLogin.find();
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});



// Update a user by ID
router.patch('/admin-update/:id', async (req, res) => {
    try {
        const user = await AdminLogin.findById(req.params.id);
        if (user == null) {
            return res.status(404).json({ message: 'Cannot find user' });
        }

        if (req.body.name != null) {
            user.name = req.body.name;
        }
        if (req.body.address != null) {
            user.address = req.body.address;
        }
        if (req.body.office != null) {
            user.office = req.body.office;
        }
        if (req.body.jobType != null) {
            user.jobType = req.body.jobType;
        }
        if (req.body.targetWeek != null) {
            user.targetWeek = req.body.targetWeek;
        }
        if (req.body.targetMonth != null) {
            user.targetMonth = req.body.targetMonth;
        }
        if (req.body.mobile != null) {
            user.mobile = req.body.mobile;
        }
        if (req.body.aadhaarNumber != null) {
            user.aadhaarNumber = req.body.aadhaarNumber;
        }
        if (req.body.userName != null) {
            user.userName = req.body.userName;
        }
        if (req.body.password != null) {
            user.password = req.body.password;
        }
        if (req.body.role != null) {
            user.role = req.body.role;
        }
        if (req.body.userType != null) {
            user.userType = req.body.userType;
        }

        const updatedUser = await user.save();
        res.json(updatedUser);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});


router.delete('/admin-delete/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        
        const user = await AdminLogin.findById(userId);
        if (user == null) {
            return res.status(404).json({ message: 'Cannot find user' });
        }

        // Use findByIdAndDelete() instead of remove()
        await AdminLogin.findByIdAndDelete(userId);

        res.json({ message: 'Deleted user' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;










