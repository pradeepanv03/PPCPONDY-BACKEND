
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

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
const UserRouter = require ('./user/UserRouter');
const BuyerAssistanceRouter = require ('./BuyerAssistance/BuyerAssistanceRouter');
const PhotoRequestRouter = require ('./Photo/PhotoRequestRouter')
const ProfileRouter = require ('./MyProfile/ProfileRouter')
const ContactUsRouter =require('./ContactUs/ContactUsRouter');
const TextRouter = require ('./TextEdider/TextRouter')
const NotificationRouter = require('./Notification/NotificationRouter'); // Import Notification model
const VisitAdminRouter = require ('./visit/VisitAdminRouter')
const AdminRollRouter = require ('./AdminRolls/AdminRollRouter')
const PaymentTypeRouter = require ('./Payment/PaymentTypeRouter')
const FollowUpRouter = require ('./FollowUp/FollowUpRouter')
const BillRouter = require ('./CreateBill/BillRouter')



const app = express();
const port = process.env.PORT || 5006;
const mongoURI = process.env.MONGO_URI;

const secretKey = process.env.SECRET_KEY;

mongoose.connect(mongoURI)
.then(() => {})
.catch(() => {});


app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// Google reCAPTCHA verification function
const verifyCaptcha = async (captchaResponse) => {
  const verificationUrl = `https://www.google.com/recaptcha/api/siteverify`;

  try {
    const response = await axios.post(verificationUrl, null, {
      params: {
        secret: secretKey,
        response: captchaResponse,
      },
    });
    return response.data.success;
  } catch (error) {
    return false;
  }
};

// Middleware for CAPTCHA validation
const captchaMiddleware = async (req, res, next) => {
  const captchaResponse = req.body.captchaResponse;

  if (!captchaResponse) {
    return res.status(400).json({ message: "CAPTCHA response is required" });
  }

  const isValid = await verifyCaptcha(captchaResponse);
  if (!isValid) {
    return res.status(400).json({ message: "Invalid CAPTCHA" });
  }

  next();
};

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Define routes
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
app.use('/PPC', BuyerAssistanceRouter)
app.use('/PPC', PhotoRequestRouter)
app.use('/PPC',ProfileRouter);
app.use('/PPC',ContactUsRouter);
app.use('/PPC', TextRouter)
app.use('/PPC',NotificationRouter);
app.use('/PPC',VisitAdminRouter);
app.use('/PPC',AdminRollRouter);
app.use('/PPC',PaymentTypeRouter);
app.use('/PPC',FollowUpRouter);
app.use('/PPC',BillRouter);


// 404 Error Handling Middleware
app.use((req, res, next) => {
  res.status(404).json({ message: "Route not found" });
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  res.status(500).json({ message: "Internal Server Error", error: err.message });
});

// Start Server
app.listen(port, () => {
});


