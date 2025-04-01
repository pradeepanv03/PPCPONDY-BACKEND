const express = require('express');
const router = express.Router();
const AdminLogin = require('../Admin/AdminModel')



// Admin login route (POST /login)
router.post('/adminlogin', async (req, res) => {
    const { name, password } = req.body;

    try {
        // Find the admin by name
        const admin = await AdminLogin.findOne({ name,password });
        if (!admin) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Compare password (you would hash the password in a real app)
        if (admin.password !== password) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Respond with a success message and token (implement JWT or session handling here)
        return res.status(200).json({ message: 'Login successful', data: admin });

    } catch (error) {
        return res.status(500).json({ message: 'Something went wrong', error: error.message });
    }
});



// Create a new user
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










