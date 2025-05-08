

const express = require('express');
const admin = require('firebase-admin');
const UserLogin = require('./UserModel'); 
const AddModel =require ('../AddModel')

const router = express.Router();

// Initialize Firebase Admin SDK
const serviceAccount = require('../config/serviceAccountKey.json'); 

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// OTP Generation Function (6-digit OTP)
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// Helper function to format phone number with country code
const formatPhoneNumber = (phone, countryCode) => {
  if (phone.startsWith('+')) return phone; 
  return `${countryCode}${phone}`;
};




// GET /user-lead-stats
router.get('/user-lead-stats', async (req, res) => {
  try {
    const users = await UserLogin.find();

    if (users.length === 0) {
      return res.status(404).json({ message: 'No users found' });
    }

    const stats = await Promise.all(
      users.map(async (user) => {
        const properties = await AddModel.find({ phoneNumber: user.phone });

        const totalInterestCount = properties.reduce((acc, prop) => acc + (prop.interestRequests?.length || 0), 0);
        const totalContactCount = properties.reduce((acc, prop) => acc + (prop.contactRequests?.length || 0), 0);
        const totalFavoriteCount = properties.reduce((acc, prop) => acc + (prop.favoriteRequests?.length || 0), 0);

        const propertyDetails = properties.map((prop) => ({
          ppcId: prop.ppcId,
          propertyMode: prop.propertyMode,
          propertyType: prop.propertyType,
          city: prop.city,
          area: prop.area,
          createdAt:prop.createdAt,
          updatedAt: prop.updatedAt,
          interestCount: prop.interestRequests?.length || 0,
          contactCount: prop.contactRequests?.length || 0,
          favoriteCount: prop.favoriteRequests?.length || 0,
        }));

        return {
          phoneNumber: user.phone,
          totalInterestCount,
          totalContactCount,
          totalFavoriteCount,
          properties: propertyDetails,
        };
      })
    );

    return res.status(200).json({ message: 'User stats fetched', data: stats });
  } catch (error) {
    return res.status(500).json({ message: 'Server Error', error: error.message });
  }
});





router.post('/user/register', async (req, res) => {
  const { phone, countryCode, mode } = req.body;

  if (!phone) {
    return res.status(400).json({ message: 'Phone number is required.' });
  }

  try {
    const otp = generateOtp();
    const now = new Date();
    let user = await UserLogin.findOne({ phone });

    if (user) {
      // Prevent permanently logged out users
      if (user.permanentlyLoggedOut) {
        return res.status(403).json({
          message: 'This user has permanently logged out. Please contact admin for access.'
        });
      }

      if (user.status === 'banned') {
        return res.status(403).json({ message: 'Your account is banned. Contact support. 9150524409' });
      }

      if (user.status === 'deleted') {
        return res.status(403).json({ message: 'Your account is deleted. Please contact support. 9150524409' });
      }

      // Update existing user
      user.otp = otp;
      user.loginDate = now;
      user.otpStatus = 'pending';
      user.loginMode = mode;
      user.countryCode = countryCode;

      await user.save();
      await sendOtpToPhone(formatPhoneNumber(phone, countryCode), otp);

      return res.status(200).json({ message: 'OTP updated and sent.', data: user });
    } else {
      // Create new user
      const newUser = new UserLogin({
        phone,
        countryCode,
        otp,
        loginDate: now,
        otpStatus: 'pending',
        loginMode: mode,
      });

      await newUser.save();
      await sendOtpToPhone(formatPhoneNumber(phone, countryCode), otp);

      // return res.status(201).json({ message: 'User registered successfully; OTP sent.', data: newUser });
      return res.status(201).json({
        message: 'User registered successfully; OTP sent.',
        data: {
          otp, // explicitly send it
          phone: newUser.phone,
        }
      });
      
    }
  } catch (error) {
    return res.status(500).json({ message: 'Something went wrong', error: error.message });
  }
});



router.get('/user/login-mode-count', async (req, res) => {
  try {
    // Make sure you're using the exact case stored in the DB ('web' or 'app')
    const webLoginCount = await UserLogin.countDocuments({ loginMode: { $regex: /^web$/, $options: 'i' } });
    const appLoginCount = await UserLogin.countDocuments({ loginMode: { $regex: /^app$/, $options: 'i' } });

    return res.status(200).json({
      message: 'Login mode counts fetched successfully',
      webLoginCount,
      appLoginCount
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Server Error',
      error: error.message
    });
  }
});

router.get('/user/login-mode-counts', async (req, res) => {
  try {
    const [webLoginCount, appLoginCount] = await Promise.all([
      UserLogin.countDocuments({ loginMode: { $regex: /^web$/, $options: 'i' } }),
      UserLogin.countDocuments({ loginMode: { $regex: /^app$/, $options: 'i' } })
    ]);

    res.status(200).json({
      message: "Login mode counts fetched successfully",
      webLoginCount,
      appLoginCount
    });
  } catch (error) {
    res.status(500).json({
      message: "Something went wrong",
      error: error.message
    });
  }
});


router.get('/user/login-count', async (req, res) => {
  try {
    // Count users with a non-null loginDate and are not banned, deleted, or permanently logged out
    const count = await UserLogin.countDocuments({
      loginDate: { $ne: null },
      status: { $nin: ['banned', 'deleted'] },
      permanentlyLoggedOut: { $ne: true }
    });

    res.status(200).json({ message: 'Login user count fetched successfully', count });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching login user count', error: error.message });
  }
});


router.post('/user/permanent-logout', async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ message: 'Phone number is required.' });
  }

  try {
    const user = await UserLogin.findOne({ phone });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.permanentlyLoggedOut = true;
    await user.save();

    return res.status(200).json({ message: 'User permanently logged out.' });
  } catch (error) {
    return res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
});


router.post('/user/revert-permanent-logout', async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ message: 'Phone number is required.' });
  }

  try {
    const user = await UserLogin.findOne({ phone });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.permanentlyLoggedOut = false;
    await user.save();

    return res.status(200).json({ message: 'Permanent logout reverted. User can now log in.' });
  } catch (error) {
    return res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
});


router.post('/user/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;

  try {
    const user = await UserLogin.findOne({ phone });

    if (!user) {
      return res.status(404).json({ message: "Phone number not registered" });
    }

    // Check if OTP matches
    if (user.otp === otp) {
      user.otpStatus = 'verified';  
      await user.updateOne({ $unset: { otp: 1 }, $set: { otpStatus: 'verified' } });

      const newOtp = generateOtp(); 
      await sendOtpToPhone(phone, newOtp);  
      await user.updateOne({ $set: { otp: newOtp } }); 

      return res.status(200).json({ message: "OTP verified successfully!" });
    } else {
      return res.status(400).json({ message: "Invalid OTP" });
    }
  } catch (error) {
    return res.status(500).json({ message: "Something went wrong", error: error.message || error });
  }
});


router.post('/user/permanent-logout', async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ message: 'Phone number is required.' });
  }

  try {
    const user = await UserLogin.findOne({ phone });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.permanentlyLoggedOut = true;
    await user.save();

    return res.status(200).json({ message: 'User permanently logged out.' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});



router.get('/user/data/:phone', async (req, res) => {
  try {
    const user = await UserLogin.findOne({ phone: req.params.phone });

    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.status(200).json({ message: 'User data fetched successfully', data: user });
  } catch (error) {
    return res.status(500).json({ message: 'Something went wrong', error: error.message });
  }
});

router.delete('/user/delete/:phone', async (req, res) => {
  try {
    const result = await UserLogin.findOneAndDelete({ phone: req.params.phone });

    if (!result) return res.status(404).json({ message: 'User not found' });

    return res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Something went wrong', error: error.message });
  }
});

router.get('/user/all', async (req, res) => {
  try {
    const users = await UserLogin.find();

    if (users.length === 0) return res.status(404).json({ message: 'No users found' });

    return res.status(200).json({ message: 'Users fetched successfully', data: users });
  } catch (error) {
    return res.status(500).json({ message: 'Something went wrong', error: error.message });
  }
});


router.post('/user/report', async (req, res) => {
  const { phone, issueDetails } = req.body;

  try {
    const user = await UserLogin.findOne({ phone });

    if (!user) return res.status(404).json({ message: 'User not found' });

    user.reportDate = new Date();
    user.issueDetails = issueDetails;
    await user.save();

    return res.status(200).json({ message: 'Issue reported successfully', data: user });
  } catch (error) {
    return res.status(500).json({ message: 'Something went wrong', error: error.message });
  }
});


router.post('/user/deleteDate', async (req, res) => {
  const { phone, issueDetails } = req.body;

  try {
    const user = await UserLogin.findOne({ phone });

    if (!user) return res.status(404).json({ message: 'User not found' });

    user.deletedDate = new Date();
    if (issueDetails) user.issueDetails = issueDetails;
    user.status = 'deleted';

    await user.save();

    return res.status(200).json({ message: 'User marked as deleted successfully', data: user });
  } catch (error) {
    return res.status(500).json({ message: 'Something went wrong', error: error.message });
  }
});


router.post('/user/ban', async (req, res) => {
  const { phone, reason } = req.body;

  try {
    const user = await UserLogin.findOne({ phone });

    if (!user) return res.status(404).json({ message: 'User not found' });

    user.bannedDate = new Date();
    user.bannedReason = reason || 'No reason provided';
    user.status = 'banned';

    await user.save();

    return res.status(200).json({ message: 'User banned successfully', data: user });
  } catch (error) {
    return res.status(500).json({ message: 'Something went wrong', error: error.message });
  }
});



router.post('/user/toggleStatus', async (req, res) => {
  const { phone, action, reason } = req.body;

  try {
    const user = await UserLogin.findOne({ phone });

    if (!user) return res.status(404).json({ message: 'User not found' });

    switch (action) {
      case 'delete':
        if (user.status === 'deleted') {
          user.status = 'normal';
          user.deletedDate = null;
          user.issueDetails = null;
        } else {
          user.status = 'deleted';
          user.deletedDate = new Date();
          user.issueDetails = reason || 'No details provided';
        }
        break;

      case 'ban':
        if (user.status === 'banned') {
          user.status = 'normal';
          user.bannedDate = null;
          user.bannedReason = null;
        } else {
          user.status = 'banned';
          user.bannedDate = new Date();
          user.bannedReason = reason || 'No reason provided';
        }
        break;

      default:
        return res.status(400).json({ message: 'Invalid action' });
    }

    await user.save();

    return res.status(200).json({ message: `User status updated to ${user.status}`, data: user });
  } catch (error) {
    return res.status(500).json({ message: 'Something went wrong', error: error.message });
  }
});


const sendOtpToPhone = async (phone, otp) => {
  return true;
};

module.exports = router;
