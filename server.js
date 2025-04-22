
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

const app = express();
const port = process.env.PORT || 5006;
const mongoURI = process.env.MONGO_URI;

const secretKey = process.env.SECRET_KEY;

// Connect to MongoDB
// mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
//   .then(() => console.log("Database connected successfully"))
//   .catch((err) => console.error("Database connection failed:", err));

mongoose.connect(mongoURI)
  .then(() => console.log("Database connected successfully"))
  .catch((err) => console.error("Database connection failed:", err));


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






















// require('dotenv').config();
// const express = require('express');
// const mongoose = require('mongoose');
// const cors = require('cors');
// const path = require('path');
// const axios = require('axios');
// const helmet = require('helmet');
// const morgan = require('morgan');
// const rateLimit = require('express-rate-limit');
// const bodyParser = require('body-parser');

// // Import Routers
// const AddRouter = require('./AddRouter');
// const AddRouters = require('./AddRouters');
// const PricingPlanRouter = require('./plans/PricingPlanRouter');
// const AdminRouter = require('./Admin/AdminRouter');
// const OfficeRouter = require('./Office/OfficeRouter');
// const BuyerRouter = require('./BuyerPlan/BuyerRouter');
// const AreaRouter = require('./Places/AreaRouter');
// const CityRouter = require('./Places/CityRouter');
// const StateRouter = require('./Places/StateRouter');
// const DistrictRouter = require('./Places/DistrictRouter');
// const RollRouter = require('./Roll/RollRouter');
// const DetailRouter = require('./Details/DetailRouter');
// const OfferRouter = require('./Offer/OfferRouter');
// const DataRouter = require('./SendDataAdmin/DataRouter');
// const UserRouter = require('./user/UserRouter');
// const BuyerAssistanceRouter = require('./BuyerAssistance/BuyerAssistanceRouter');
// const PhotoRequestRouter = require('./Photo/PhotoRequestRouter');
// const ProfileRouter = require('./MyProfile/ProfileRouter');
// const ContactUsRouter = require('./ContactUs/ContactUsRouter');
// const TextRouter = require('./TextEdider/TextRouter');
// const NotificationRouter = require('./Notification/NotificationRouter');
// const VisitAdminRouter = require('./visit/VisitAdminRouter');

// const app = express();
// const port = process.env.PORT || 5000;
// const mongoURI = process.env.MONGO_URI;
// const secretKey = process.env.SECRET_KEY;

// // Connect to MongoDB
// mongoose.connect(mongoURI)
//   .then(() => console.log("✅ MongoDB connected"))
//   .catch((err) => console.error(" MongoDB connection failed:", err));

// // Middlewares
// app.use(cors());
// app.use(express.json());
// app.use(bodyParser.json());
// app.use(helmet());
// app.use(morgan('dev'));

// // Rate limiting to avoid abuse
// app.use(rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100 // limit each IP to 100 requests per windowMs
// }));

// // Google reCAPTCHA verification function
// const verifyCaptcha = async (captchaResponse) => {
//   const verificationUrl = `https://www.google.com/recaptcha/api/siteverify`;
//   try {
//     const response = await axios.post(verificationUrl, null, {
//       params: {
//         secret: secretKey,
//         response: captchaResponse,
//       },
//     });
//     return response.data.success;
//   } catch (error) {
//     return false;
//   }
// };

// // CAPTCHA middleware
// const captchaMiddleware = async (req, res, next) => {
//   const captchaResponse = req.body.captchaResponse;
//   if (!captchaResponse) {
//     return res.status(400).json({ message: "CAPTCHA response is required" });
//   }
//   const isValid = await verifyCaptcha(captchaResponse);
//   if (!isValid) {
//     return res.status(400).json({ message: "Invalid CAPTCHA" });
//   }
//   next();
// };

// // Optional: Example route using CAPTCHA middleware
// app.post('/PPC/secure-endpoint', captchaMiddleware, (req, res) => {
//   res.json({ message: "CAPTCHA verified and request accepted" });
// });

// // Serve uploaded files
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// // Routes
// app.use('/PPC', AddRouter);
// app.use('/PPC', AddRouters);
// app.use('/PPC', PricingPlanRouter);
// app.use('/PPC', AdminRouter);
// app.use('/PPC', OfficeRouter);
// app.use('/PPC', BuyerRouter);
// app.use('/PPC', CityRouter);
// app.use('/PPC', AreaRouter);
// app.use('/PPC', DistrictRouter);
// app.use('/PPC', StateRouter);
// app.use('/PPC', RollRouter);
// app.use('/PPC', DetailRouter);
// app.use('/PPC', OfferRouter);
// app.use('/PPC', DataRouter);
// app.use('/PPC', UserRouter);
// app.use('/PPC', BuyerAssistanceRouter);
// app.use('/PPC', PhotoRequestRouter);
// app.use('/PPC', ProfileRouter);
// app.use('/PPC', ContactUsRouter);
// app.use('/PPC', TextRouter);
// app.use('/PPC', NotificationRouter);
// app.use('/PPC', VisitAdminRouter);

// // Health check
// app.get('/', (req, res) => res.send('Server is running 🚀'));

// // 404 handler
// app.use((req, res) => {
//   res.status(404).json({ message: "Route not found" });
// });

// // Global error handler
// app.use((err, req, res, next) => {
//   console.error(err);
//   res.status(500).json({ message: "Internal Server Error", error: err.message });
// });

// // Start server
// app.listen(port, () => {
//   console.log(`🚀 Server running at http://localhost:${port}`);
// });
