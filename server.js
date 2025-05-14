
require('dotenv').config();
const express = require('express');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { generateOTP, storeOTP, verifyOTP } = require('./otpUtils');
const axios = require('axios');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Import all your routers
const AddRouters = require('./AddRouters'); 
const AddRouter = require('./AddRouter'); 
const PricingPlanRouter = require('./plans/PricingPlanRouter');
const AdminRouter = require('./Admin/AdminRouter');
const OfficeRouter = require('./Office/OfficeRouter');
const BuyerRouter = require('./BuyerPlan/BuyerRouter');
const AreaRouter = require('./Places/AreaRouter');
const CityRouter = require('./Places/CityRouter');
const StateRouter = require('./Places/StateRouter');
const DistrictRouter = require('./Places/DistrictRouter');
const RollRouter = require('./Roll/RollRouter');
const DetailRouter = require('./Details/DetailRouter');
const OfferRouter = require('./Offer/OfferRouter');
const DataRouter = require('./SendDataAdmin/DataRouter');
const UserRouter = require('./user/UserRouter');
const BuyerAssistanceRouter = require('./BuyerAssistance/BuyerAssistanceRouter');
const PhotoRequestRouter = require('./Photo/PhotoRequestRouter');
const ProfileRouter = require('./MyProfile/ProfileRouter');
const ContactUsRouter = require('./ContactUs/ContactUsRouter');
const TextRouter = require('./TextEdider/TextRouter');
const NotificationRouter = require('./Notification/NotificationRouter');
const VisitAdminRouter = require('./visit/VisitAdminRouter');
const AdminRollRouter = require('./AdminRolls/AdminRollRouter');
const PaymentTypeRouter = require('./Payment/PaymentTypeRouter');
const FollowUpRouter = require('./FollowUp/FollowUpRouter');
const BillRouter = require('./CreateBill/BillRouter');

const UserLogin = require('./user/UserModel'); // Import your UserLogin model


const app = express();
const PORT = process.env.PORT || 5006;
const mongoURI = process.env.MONGO_URI;

// Configure AWS SNS client
const snsClient = new SNSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Connect to MongoDB
mongoose.connect(mongoURI)
  .then(() => console.log("Database connected successfully"))
  .catch((err) => console.error("Database connection failed:", err));

// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));



// OTP Endpoints with full UserLogin integration
app.post('/send-otp', async (req, res) => {
  let { phoneNumber, loginMode = 'app', version, countryCode } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  // Normalize phone number
  phoneNumber = phoneNumber.replace(/\D/g, '');
  
  if (phoneNumber.startsWith('91') && phoneNumber.length === 12) {
    phoneNumber = `+${phoneNumber}`;
  } else if (phoneNumber.length === 10) {
    phoneNumber = `+91${phoneNumber}`;
  } else if (!phoneNumber.startsWith('+91')) {
    return res.status(400).json({ error: 'Invalid Indian phone number format' });
  }

  // Check if user is banned or deleted
  try {
    const phoneDigits = phoneNumber.replace(/\D/g, '').slice(-10);
    const existingUser = await UserLogin.findOne({ 
      phone: phoneDigits,
      status: { $in: ['banned', 'deleted'] }
    }).sort({ loginDate: -1 });

    if (existingUser) {
      if (existingUser.status === 'banned') {
        return res.status(403).json({ 
          error: 'Account banned',
          bannedDate: existingUser.bannedDate,
          bannedReason: existingUser.bannedReason,
          staffName: existingUser.staffName
        });
      }
      if (existingUser.status === 'deleted') {
        return res.status(403).json({ 
          error: 'Account deleted',
          deletedDate: existingUser.deletedDate
        });
      }
    }
  } catch (error) {
    return res.status(500).json({ error: 'Error checking account status' });
  }

  // Generate new OTP
  const otp = generateOTP();
  const message = `Your OTP is: ${otp}. Thanks for using PPC Pondy`;

  try {
    const params = {
      Message: message,
      PhoneNumber: phoneNumber,
      MessageAttributes: {
        'SMSType': {
          DataType: 'String',
          StringValue: 'Transactional'
        },
        'SenderID': {
          DataType: 'String',
          StringValue: process.env.SENDER_ID || 'PONDYY'
        },
        'EntityId': {
          DataType: 'String',
          StringValue: process.env.DLT_ENTITY_ID
        },
        'TemplateId': {
          DataType: 'String',
          StringValue: process.env.DLT_TEMPLATE_ID
        }
      }
    };

    const command = new PublishCommand(params);
    const result = await snsClient.send(command);
    
     await UserLogin.create({
      phone: phoneNumber.replace(/\D/g, '').slice(-10),
      otp,
      loginDate: new Date(),
      otpStatus: 'pending',
      countryCode: countryCode || '+91',
      loginMode, // Ensure loginMode is saved
      version,
      status: 'active'
    });
    
    res.status(200).json({ 
      message: 'OTP sent successfully',
      result: {
        messageId: result.MessageId,
        otp: process.env.NODE_ENV === 'development' ? otp : undefined
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to send OTP',
      details: error.message
    });
  }
});

app.post('/verify-otp', async (req, res) => {
  const { phoneNumber, otp } = req.body;
  
  if (!phoneNumber || !otp) {
    return res.status(400).json({ error: 'Phone number and OTP are required' });
  }

  try {
    // Normalize phone number
    const phoneDigits = phoneNumber.replace(/\D/g, '').slice(-10);
    
    // Find the most recent OTP for this phone number
    const userLogin = await UserLogin.findOne({
      phone: phoneDigits,
      otpStatus: 'pending'
    }).sort({ loginDate: -1 });

    if (!userLogin) {
      return res.status(404).json({ error: 'No pending OTP found for this number' });
    }

    // Check if OTP matches and is not expired (5 minute expiry)
    const isOtpValid = userLogin.otp === otp;
    const isOtpExpired = new Date() - userLogin.loginDate > 5 * 60 * 1000;

    if (!isOtpValid) {
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    if (isOtpExpired) {
      return res.status(401).json({ error: 'OTP expired' });
    }

    // Update the record to mark as verified
    userLogin.otpStatus = 'verified';
    await userLogin.save();

    res.status(200).json({ 
      message: 'OTP verified successfully',
      user: {
        phone: userLogin.phone,
        countryCode: userLogin.countryCode,
        status: userLogin.status,
        loginDate: userLogin.loginDate,
        loginMode: userLogin.loginMode, // Added loginMode
        version: userLogin.version,
        otpStatus: userLogin.otpStatus // Added otpStatus
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Error verifying OTP',
      details: error.message
    });
  }
});

// Admin endpoint to ban a user
app.post('/admin/ban-user', async (req, res) => {
  const { phoneNumber, reason, staffName } = req.body;
  
  if (!phoneNumber || !reason || !staffName) {
    return res.status(400).json({ error: 'Phone number, reason and staff name are required' });
  }

  try {
    const phoneDigits = phoneNumber.replace(/\D/g, '').slice(-10);
    const user = await UserLogin.findOneAndUpdate(
      { phone: phoneDigits },
      {
        status: 'banned',
        bannedDate: new Date(),
        bannedReason: reason,
        staffName,
        remarks: `Banned by ${staffName} for: ${reason}`,
        reportDate: new Date()
      },
      { new: true, sort: { loginDate: -1 } }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ 
      message: 'User banned successfully',
      user: {
        phone: user.phone,
        status: user.status,
        bannedDate: user.bannedDate,
        bannedReason: user.bannedReason,
        staffName: user.staffName
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error banning user' });
  }
});

// Endpoint to get user login history
app.get('/user-login-history/:phoneNumber', async (req, res) => {
  try {
    const phoneDigits = req.params.phoneNumber.replace(/\D/g, '').slice(-10);
    const history = await UserLogin.find({ phone: phoneDigits })
      .sort({ loginDate: -1 })
      .limit(10);

    res.status(200).json({
      count: history.length,
      history: history.map(record => ({
        loginDate: record.loginDate,
        loginMode: record.loginMode,
        status: record.status,
        version: record.version,
        otpStatus: record.otpStatus
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching login history' });
  }
});


// Mount all routers under /PPC prefix
app.use("/PPC", AddRouter);
app.use("/PPC", AddRouters);
app.use("/PPC", PricingPlanRouter);
app.use("/PPC", AdminRouter);
app.use("/PPC", OfficeRouter);
app.use("/PPC", BuyerRouter);
app.use("/PPC", CityRouter);
app.use("/PPC", AreaRouter);
app.use("/PPC", DistrictRouter);
app.use("/PPC", StateRouter);
app.use("/PPC", RollRouter);
app.use("/PPC", DetailRouter);
app.use("/PPC", OfferRouter);
app.use('/PPC', DataRouter);
app.use('/PPC', UserRouter);
app.use('/PPC', BuyerAssistanceRouter);
app.use('/PPC', PhotoRequestRouter);
app.use('/PPC', ProfileRouter);
app.use('/PPC', ContactUsRouter);
app.use('/PPC', TextRouter);
app.use('/PPC', NotificationRouter);
app.use('/PPC', VisitAdminRouter);
app.use('/PPC', AdminRollRouter);
app.use('/PPC', PaymentTypeRouter);
app.use('/PPC', FollowUpRouter);
app.use('/PPC', BillRouter);

// 404 Error Handling Middleware
app.use((req, res, next) => {
  res.status(404).json({ message: "Route not found" });
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  res.status(500).json({ message: "Internal Server Error", error: err.message });
});

// Start Server
app.listen(PORT, () => {
});