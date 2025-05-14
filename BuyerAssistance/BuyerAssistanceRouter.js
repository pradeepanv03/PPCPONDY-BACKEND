

const express = require("express");
const router = express.Router();
const BuyerAssistance = require("../BuyerAssistance/BuyerAssistanceModel");
const AddModel = require('../AddModel');
const NotificationUser = require('../Notification/NotificationDetailModel');
const PricingPlans = require('../plans/PricingPlanModel');
const Bill = require('../CreateBill/BillModel');
const FollowUp = require('../FollowUp/FollowUpModel'); // Import your model


router.get('/buyer-assistance-count-by-user', async (req, res) => {
  try {
    const buyerAssistances = await BuyerAssistance.find({ isDeleted: false }); // Optional: ignore soft-deleted

    const baCountByUser = buyerAssistances.reduce((acc, item) => {
      const phone = item.phoneNumber;
      if (!acc[phone]) {
        acc[phone] = 1;
      } else {
        acc[phone]++;
      }
      return acc;
    }, {});

    const baCountArray = Object.entries(baCountByUser).map(([phoneNumber, adsCount]) => ({
      phoneNumber,
      adsCount,
    }));

    res.status(200).json({
      message: 'Buyer assistance ad count per user fetched successfully!',
      data: baCountArray,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch buyer assistance ad counts',
      error: error.message,
    });
  }
});


router.get("/fetch-buyerAssistances", async (req, res) => {
  try {
    const { phoneNumber } = req.query; // Optional phoneNumber filter

    // 1. Base query for buyer assistance requests
    const baQuery = phoneNumber ? { phoneNumber } : {};
    const requests = await BuyerAssistance.find(baQuery);

    // 2. Get unique identifiers
    const userPhoneNumbers = [...new Set(requests.map(r => r.phoneNumber))];
    const ppcIds = [...new Set(requests.map(r => r.ppcId))];

    // 3. Fetch all related data in parallel
    const [properties, plans, bills, followups] = await Promise.all([
      AddModel.find({ ppcId: { $in: ppcIds } }),
      PricingPlans.find({ phoneNumber: { $in: userPhoneNumbers } }),
      Bill.find({ 
        $or: [
          { ownerPhone: { $in: userPhoneNumbers } },
          { ppId: { $in: ppcIds } }
        ]
      }),
      FollowUp.find({ ppcId: { $in: ppcIds } })
    ]);

    // 4. Helper functions
    const formatDate = (date) => date ? new Date(date).toLocaleDateString() : 'N/A';
    
    const calculateExpiry = (startDate, durationDays) => {
      if (!startDate || !durationDays) return 'N/A';
      const expiry = new Date(startDate);
      expiry.setDate(expiry.getDate() + Number(durationDays));
      return formatDate(expiry);
    };

    // 5. Process each request
    const enhancedRequests = requests.map(request => {
      const property = properties.find(p => p.ppcId === request.ppcId) || {};
      const userPlan = plans.find(p => 
        Array.isArray(p.phoneNumber) 
          ? p.phoneNumber.includes(request.phoneNumber)
          : p.phoneNumber === request.phoneNumber
      );
      const propertyBill = bills.find(b => 
        b.ppId === request.ppcId || b.ownerPhone === request.phoneNumber
      );
      const propertyFollowups = followups
        .filter(f => String(f.ppcId) === String(request.ppcId))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Plan details (e.g., Gold plan with 60 days duration)
      const planDetails = userPlan ? {
        planName: userPlan.name || 'N/A',
        planType: userPlan.packageType || 'N/A',
        planCreatedAt: formatDate(userPlan.createdAt),
        planDuration: `${userPlan.durationDays || 0} days`,
        planExpiry: calculateExpiry(userPlan.createdAt, userPlan.durationDays),
        planCreatedBy: userPlan.createdBy || 'System'
      } : {
        planName: 'No Plan',
        planType: 'N/A',
        planCreatedAt: 'N/A',
        planDuration: '0 days',
        planExpiry: 'N/A',
        planCreatedBy: 'N/A'
      };

      // Bill details
      const billDetails = propertyBill ? {
        billNo: propertyBill.billNo || 'N/A',
        billAmount: propertyBill.amount || 'N/A',
        billDate: formatDate(propertyBill.billDate),
        billExpiry: calculateExpiry(propertyBill.billDate, propertyBill.validity),
        billCreatedAt: formatDate(propertyBill.createdAt),
        billCreatedBy: propertyBill.createdBy || 'Admin',
        billStatus: propertyBill.status || 'N/A'
      } : {
        billNo: 'N/A',
        billAmount: 'N/A',
        billDate: 'N/A',
        billExpiry: 'N/A',
        billCreatedAt: 'N/A',
        billCreatedBy: 'N/A',
        billStatus: 'N/A'
      };

      // Followup details
      const latestFollowup = propertyFollowups[0] || {};
      const followupDetails = {
        lastFollowupAt: formatDate(latestFollowup.createdAt),
        lastFollowupBy: latestFollowup.adminName || 'N/A',
        followupStatus: latestFollowup.status || 'N/A',
        remarks: latestFollowup.remarks || 'N/A'
      };

      return {
        // Buyer Assistance details
        _id: request._id,
        ba_status: request.ba_status,
        createdAt: formatDate(request.createdAt),
        
        // User details
        phoneNumber: request.phoneNumber,
        
        // Property details
        property: {
          ppcId: request.ppcId,
          type: property.propertyType || 'N/A',
          price: property.price || 'N/A',
          status: property.status || 'N/A'
        },
        
        // Enhanced plan details (e.g., Gold plan)
        plan: planDetails,
        
        // Enhanced bill details
        bill: billDetails,
        
        // Followup details
        followup: followupDetails
      };
    });

    // 6. Calculate statistics
    const statusCounts = requests.reduce((acc, req) => {
      acc[req.ba_status] = (acc[req.ba_status] || 0) + 1;
      return acc;
    }, {});

    // 7. Prepare response
    const response = {
      success: true,
      message: phoneNumber 
        ? `Buyer assistance data for ${phoneNumber}`
        : "All buyer assistance records",
      stats: {
        total: requests.length,
        ...statusCounts,
        ba_active: statusCounts.ba_active || 0
      },
      data: enhancedRequests
    };

    res.status(200).json(response);

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch buyer assistance data",
      error: error.message
    });
  }
});




router.get("/get-buyerAssistance", async (req, res) => {
  const { phoneNumber } = req.query; // Extract phoneNumber from query

  try {
    // 1. Fetch Buyer Assistance requests
    const requests = await BuyerAssistance.find({ phoneNumber });

    // 2. Fetch the user's plan details
    const userPlan = await PricingPlans.findOne({ phoneNumber });

    let planName = 'N/A';
    let planCreatedAt = 'N/A';
    let durationDays = 0;
    let planExpiryDate = 'N/A';
    let packageType = 'N/A';

    if (userPlan) {
      planName = userPlan.name || 'N/A';
      
      planCreatedAt = userPlan.createdAt
      ? new Date(userPlan.createdAt).toLocaleDateString()
      : 'N/A';
      
      durationDays = userPlan.durationDays || 0;
      packageType = userPlan.packageType || 'N/A';

      // Calculate expiry date
      if (userPlan.createdAt && userPlan.durationDays) {
        const expiryDate = new Date(userPlan.createdAt);
        expiryDate.setDate(expiryDate.getDate() + durationDays);
        planExpiryDate = new Date(expiryDate).toLocaleDateString();        
      }
    }

    // Send success response
    res.status(200).json({
      message: `Buyer Assistance requests and Plan details fetched for phone number: ${phoneNumber}`,
      planDetails: {
        planName,
        planCreatedAt, // Properly formatted creation date
        durationDays,
        planExpiryDate, // Properly formatted expiry date
        packageType,
      },
      data: requests, // Buyer Assistance requests
    });

  } catch (error) {

    // Handle server errors
    res.status(500).json({
      message: "Error fetching Buyer Assistance requests by phone number",
      error: error.message,
    });
  }
});



router.post('/contact-buyer-send', async (req, res) => {
  const { phoneNumber, ba_id } = req.body;

  try {
    // Search by ba_id as a number
    const buyer = await BuyerAssistance.findOne({ ba_id });

    if (!buyer) {
      return res.status(404).json({ success: false, message: 'Buyer entry not found' });
    }

    const updatedBuyer = await BuyerAssistance.findOneAndUpdate(
      { ba_id },  // Use ba_id in the query
      {
        $set: { callStatus: 'contacted', updatedAt: new Date() },
        $push: { callLogs: { phoneNumber, createdAt: new Date() } }
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Buyer contacted successfully!',
      buyerDetails: {
        buyerName: updatedBuyer.baName,
        phoneNumber: updatedBuyer.phoneNumber,
        ppcId: updatedBuyer.ppcId,
        status: updatedBuyer.callStatus
      }
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
});


router.get("/buyer-assistance-interests-phone", async (req, res) => {
  try {
    const { phone } = req.query;
    const filter = { ba_status: "buyer-assistance-interest" };
    if (phone) filter.interestedUserPhone = phone;

    const assistanceInterests = await BuyerAssistance.find(filter);

    if (!assistanceInterests.length) {
      return res.status(404).json({ message: "No buyer assistance interests found" });
    }

    res.status(200).json({
      message: "Buyer assistance interests fetched successfully",
      data: assistanceInterests,
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// Count buyer assistance interests for a phone number
router.get("/buyer-assistance-interests-phone/count", async (req, res) => {
  try {
    const { phone } = req.query;
    const filter = { ba_status: "buyer-assistance-interest" };
    if (phone) filter.interestedUserPhone = phone;

    const count = await BuyerAssistance.countDocuments(filter);

    res.status(200).json({
      message: "Buyer assistance interest count fetched successfully",
      count,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

router.get("/matched-properties-by-phone/:phoneNumber", async (req, res) => {
  try {
    const { phoneNumber } = req.params;

    // 🔹 Find the buyer's request using phoneNumber
    const buyerRequest = await BuyerAssistance.findOne({ phoneNumber });
    if (!buyerRequest) {
      return res.status(404).json({ success: false, message: "Buyer request not found" });
    }

    // 🔹 Construct search query based on buyer preferences
    const query = {
      propertyType: buyerRequest.propertyType,
      propertyMode: buyerRequest.propertyMode,
      city: buyerRequest.city,
      state: buyerRequest.state,
      district: buyerRequest.district,
      area: buyerRequest.area,
      price: {
        $gte: buyerRequest.minPrice ? parseInt(buyerRequest.minPrice) : 0,
        $lte: buyerRequest.maxPrice ? parseInt(buyerRequest.maxPrice) : Infinity,
      },
      bedrooms: buyerRequest.noOfBHK,
      areaUnit: buyerRequest.areaUnit,
      propertyAge: buyerRequest.propertyAge,
      propertyApproved: buyerRequest.propertyApproved,
      facing: buyerRequest.facing,
      bankLoan: buyerRequest.bankLoan,
    };

    // 🔹 Remove undefined/null fields from the query
    Object.keys(query).forEach((key) => {
      if (!query[key]) delete query[key];
    });

    // 🔹 Fetch matching properties
    const matchedProperties = await AddModel.find(query);

    return res.json({ success: true, buyerId: buyerRequest._id, matchedProperties });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});


router.get("/fetch-all-data/:buyerId", async (req, res) => {
  try {
    const { buyerId } = req.params;

    // 🔹 Find the buyer's request using buyerId
    const buyerRequest = await BuyerAssistance.findById(buyerId);
    if (!buyerRequest) {
      return res.status(404).json({ success: false, message: "Buyer request not found" });
    }

    // 🔹 Construct search query based on buyer's preferences
    let query = {
      propertyType: buyerRequest.propertyType,
      propertyMode: buyerRequest.propertyMode,
      city: buyerRequest.city,
      area: buyerRequest.area,
      price: {
        $gte: buyerRequest.minPrice ? parseInt(buyerRequest.minPrice) : 0,  
        $lte: buyerRequest.maxPrice ? parseInt(buyerRequest.maxPrice) : Infinity,
      },
    };

    // 🔹 Remove empty fields from the query
    Object.keys(query).forEach((key) => {
      if (query[key] === undefined || query[key] === null) {
        delete query[key];
      }
    });


    // 🔹 Fetch matched properties
    const matchedProperties = await AddModel.find(query).select(
      "ppcId price phoneNumber propertyMode propertyType city area"
    );


    return res.json({ success: true, message: "Matched properties fetched successfully!", matchedProperties });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});



router.get("/get-buyer-id/:phoneNumber", async (req, res) => {
  try {
    const { phoneNumber } = req.params;

    // 🔹 Find the buyer request using phoneNumber
    const buyer = await BuyerAssistance.findOne({ phoneNumber });

    if (!buyer) {
      return res.status(404).json({ success: false, message: "Buyer not found" });
    }

    return res.json({ success: true, buyerId: buyer._id });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});




router.post("/add-buyerAssistance", async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    let formattedPhoneNumber = phoneNumber.replace(/^\+91/, "").trim();

    // Always generate a new ba_id
    let lastRecord = await BuyerAssistance.findOne({}, { ba_id: 1 }).sort({ ba_id: -1 });
    let newBaId = lastRecord && lastRecord.ba_id ? lastRecord.ba_id + 1 : 100;

    const newRequest = new BuyerAssistance({ 
      ...req.body, 
      baName: req.body.baName || "Buyer",
      phoneNumber: formattedPhoneNumber,
      ba_id: newBaId
    });

    await newRequest.save();

    // Notify Admin/Support
    await NotificationUser.create({
      recipientPhoneNumber: "admin",
      senderPhoneNumber: formattedPhoneNumber,
      message: `New buyer assistance request submitted by ${formattedPhoneNumber}`,
      createdAt: new Date(),
    });

    // Find matched properties
    const matchedProperties = await AddModel.find({
      propertyMode: newRequest.propertyMode,
      propertyType: newRequest.propertyType,
      city: newRequest.city,
      area: newRequest.area,
      facing: newRequest.facing,
      price: {
        $gte: Number(newRequest.minPrice),
        $lte: Number(newRequest.maxPrice)
      }
    });

    // 🔔 Notify matching owners
    for (let property of matchedProperties) {
      await NotificationUser.create({
        recipientPhoneNumber: property.phoneNumber,
        senderPhoneNumber: formattedPhoneNumber,
        message: `A new buyer request matches your property in ${property.area} (${property.propertyType})`,
        createdAt: new Date(),
      });
    }

    // 🔔 Notify the buyer (if matching properties found)
    if (matchedProperties.length > 0) {
      await NotificationUser.create({
        recipientPhoneNumber: formattedPhoneNumber,
        senderPhoneNumber: "system",
        message: `We found ${matchedProperties.length} matching property(s) for your request in ${newRequest.area} (${newRequest.propertyType}). Check them out now!`,
        createdAt: new Date(),
      });
    }

    res.status(201).json({ 
      message: "Buyer Assistance request added successfully!", 
      data: newRequest 
    });

  } catch (error) {
    res.status(500).json({ message: "Error adding Buyer Assistance request", error });
  }
});




// Update the status of a buyer assistance request
router.put("/update-buyerAssistance-status/:id", async (req, res) => {
  const { id } = req.params;
  const { newStatus } = req.body; // Expected: { newStatus: "baActive" or "baPending" }

  try {
    // Find the request and update its status
    const updatedRequest = await BuyerAssistance.findByIdAndUpdate(
      id,
      { ba_status: newStatus },
      { new: true } // Return the updated document
    );

    if (!updatedRequest) {
      return res.status(404).json({ message: "Request not found" });
    }

    res.status(200).json({
      message: "Status updated successfully",
      data: updatedRequest,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
});




router.get("/get-buyerAssistance-all", async (req, res) => {
  try {
    const buyerAssistances = await BuyerAssistance.find({ isDeleted: false }).sort({ createdAt: -1 });

    res.status(200).json({
      message: "Buyer Assistance data fetched successfully!",
      data: buyerAssistances
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching Buyer Assistance data", error });
  }
});



router.get("/buyer-assistance-count", async (req, res) => {
  try {
    const count = await BuyerAssistance.countDocuments();
    res.status(200).json({
      message: "Total buyer assistance count fetched successfully",
      count,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching buyer assistance count",
      error: error.message,
    });
  }
});



router.post('/get-matched-property', async (req, res) => {
  try {
    const { ba_id, phoneNumber } = req.body;

    if (!ba_id && !phoneNumber) {
      return res.status(400).json({ success: false, message: "Either ba_id or phoneNumber must be provided" });
    }

    // Fetch Buyer Assistance data based on ba_id or phoneNumber
    let buyerAssistance = null;
    if (ba_id) {
      buyerAssistance = await BuyerAssistance.findOne({ ba_id });
    } else if (phoneNumber) {
      buyerAssistance = await BuyerAssistance.findOne({ phoneNumber });
    }

    if (!buyerAssistance) {
      return res.status(404).json({ success: false, message: "Buyer Assistance data not found" });
    }

    // Now match property using the phoneNumber from the Buyer Assistance data
    const matchedProperty = await AddModel.findOne({ phoneNumber: buyerAssistance.phoneNumber });

    if (!matchedProperty) {
      return res.status(404).json({ success: false, message: "Property not found for this buyer" });
    }

    // You can return the matched property data along with buyer assistance details
    return res.status(200).json({
      success: true,
      message: "Matched property found",
      matchedBuyerAssistance: {
        ba_id: buyerAssistance.ba_id,
        baName: buyerAssistance.baName,
        phoneNumber: buyerAssistance.phoneNumber,
        city: buyerAssistance.city,
        area: buyerAssistance.area,
        minPrice: buyerAssistance.minPrice,
        maxPrice: buyerAssistance.maxPrice,
        propertyType: buyerAssistance.propertyType,
        propertyMode: buyerAssistance.propertyMode,
      },
      matchedProperty: {
        ppcId: matchedProperty.ppcId,
        price: matchedProperty.price,
        status: matchedProperty.status,
        areaUnit: matchedProperty.areaUnit,
        totalArea: matchedProperty.totalArea,
        propertyMode: matchedProperty.propertyMode,
        propertyType: matchedProperty.propertyType,
        facing: matchedProperty.facing,
        city: matchedProperty.city,
        district: matchedProperty.district,
        area: matchedProperty.area,
        email: matchedProperty.email,
        phoneNumber: matchedProperty.phoneNumber,
        ownerName: matchedProperty.ownerName,
        photos: matchedProperty.photos,
        video: matchedProperty.video,
        createdAt: matchedProperty.createdAt,
        updatedAt: matchedProperty.updatedAt,
      }
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
});




// Get All Buyer Assistance Requests with baActive status
router.get("/get-buyerAssistances", async (req, res) => {
  try {
    // Fetch only requests with ba_status: "baActive"
    const requests = await BuyerAssistance.find({ ba_status: "baActive" });

    res.status(200).json({
      message: "All 'baActive' Buyer Assistance requests fetched successfully!",
      data: requests,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching Buyer Assistance requests", error });
  }
});



// Get Buyer Assistance Requests by Phone Number
router.get("/get-user-buyerAssistance/:phoneNumber", async (req, res) => {
  const { phoneNumber } = req.params;

  try {
    const requests = await BuyerAssistance.find({ phoneNumber });
    res.status(200).json({
      message: `Buyer Assistance requests fetched for phone number: ${phoneNumber}`,
      data: requests,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching Buyer Assistance requests by phone number",
      error,
    });
  }
});

router.get("/get-user-buyerAssistance-count/:phoneNumber", async (req, res) => {
  const { phoneNumber } = req.params;

  try {
    const count = await BuyerAssistance.countDocuments({
      phoneNumber: { $exists: true, $eq: phoneNumber }, // Explicit filter
    });

    res.status(200).json({
      message: `Buyer Assistance request count fetched for phone number: ${phoneNumber}`,
      count,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching Buyer Assistance request count by phone number",
      error,
    });
  }
});
















router.get("/get-buyerAssistance-all-plans", async (req, res) => {
  try {
    // 1. Fetch all Buyer Assistance requests
    const requests = await BuyerAssistance.find();

    // 2. Create a set of unique phone numbers from the requests
    const phoneNumbers = [...new Set(requests.map(req => req.phoneNumber))];

    // 3. Fetch all user plans matching those phone numbers
    const plans = await PricingPlans.find({ phoneNumber: { $in: phoneNumbers } });

    // 4. Create a map for quick lookup of plan by phone number
    const planMap = {};
    plans.forEach(plan => {
      const expiryDate = new Date(plan.createdAt);
      expiryDate.setDate(expiryDate.getDate() + (plan.durationDays || 0));
      planMap[plan.phoneNumber] = {
        planName: plan.name || 'N/A',
        planCreatedAt: plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : 'N/A',
        durationDays: plan.durationDays || 0,
        planExpiryDate: expiryDate.toLocaleDateString(),
        packageType: plan.packageType || 'N/A',
      };
    });

    // 5. Combine each request with its plan info
    const enrichedData = requests.map(req => ({
      ...req._doc,
      planDetails: planMap[req.phoneNumber] || {
        planName: 'N/A',
        planCreatedAt: 'N/A',
        durationDays: 0,
        planExpiryDate: 'N/A',
        packageType: 'N/A',
      }
    }));

    // 6. Send response
    res.status(200).json({
      message: "All Buyer Assistance requests with plan details fetched",
      data: enrichedData,
    });

  } catch (error) {
    res.status(500).json({
      message: "Error fetching all Buyer Assistance requests",
      error: error.message,
    });
  }
});



router.get("/baActive-buyerAssistance-all-plans", async (req, res) => {
  try {
    // 1. Fetch only Buyer Assistance requests with "baActive" status
    const requests = await BuyerAssistance.find({ ba_status: "baActive" });

    // 2. Create a set of unique phone numbers from the requests
    const phoneNumbers = [...new Set(requests.map(req => req.phoneNumber))];

    // 3. Fetch all user plans matching those phone numbers
    const plans = await PricingPlans.find({ phoneNumber: { $in: phoneNumbers } });

    // 4. Create a map for quick lookup of plan by phone number
    const planMap = {};
    plans.forEach(plan => {
      const expiryDate = new Date(plan.createdAt);
      expiryDate.setDate(expiryDate.getDate() + (plan.durationDays || 0));
      planMap[plan.phoneNumber] = {
        planName: plan.name || 'N/A',
        planCreatedAt: plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : 'N/A',
        durationDays: plan.durationDays || 0,
        planExpiryDate: expiryDate.toLocaleDateString(),
        packageType: plan.packageType || 'N/A',
      };
    });

    // 5. Combine each request with its plan info
    const enrichedData = requests.map(req => ({
      ...req._doc,
      planDetails: planMap[req.phoneNumber] || {
        planName: 'N/A',
        planCreatedAt: 'N/A',
        durationDays: 0,
        planExpiryDate: 'N/A',
        packageType: 'N/A',
      }
    }));

    // 6. Send response
    res.status(200).json({
      message: "All Buyer Assistance requests with 'baActive' status and plan details fetched",
      data: enrichedData,
    });

  } catch (error) {
    res.status(500).json({
      message: "Error fetching all Buyer Assistance requests",
      error: error.message,
    });
  }
});





// Get count of Buyer Assistance Requests by Phone Number
router.get("/count-buyerAssistance/:phoneNumber", async (req, res) => {
  const { phoneNumber } = req.params;

  try {
    const count = await BuyerAssistance.countDocuments({ phoneNumber });
    res.status(200).json({
      message: `Buyer Assistance request count fetched for phone number: ${phoneNumber}`,
      count,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching Buyer Assistance request count by phone number",
      error,
    });
  }
});



// Update Buyer Assistance
router.put("/update-buyerAssistance/:id", async (req, res) => {
  try {
    const updatedRequest = await BuyerAssistance.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedRequest) {
      return res.status(404).json({ message: "Request not found" });
    }
    res.status(200).json({ message: "Buyer Assistance request updated successfully!", data: updatedRequest });
  } catch (error) {
    res.status(500).json({ message: "Error updating Buyer Assistance request", error });
  }
});

// Delete Buyer Assistance
router.delete("/delete-buyerAssistance/:id", async (req, res) => {
  try {
    const deletedRequest = await BuyerAssistance.findByIdAndDelete(req.params.id);
    if (!deletedRequest) {
      return res.status(404).json({ message: "Request not found" });
    }
    res.status(200).json({
      message: "Buyer Assistance request deleted successfully!",
      data: deletedRequest,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error deleting Buyer Assistance request",
      error,
    });
  }
});


// Update Buyer Assistance using Phone Number
router.put("/update-buyerAssistance-phone/:phoneNumber", async (req, res) => {
  try {
    const updatedRequest = await BuyerAssistance.findOneAndUpdate(
      { phoneNumber: req.params.phoneNumber },
      req.body,
      { new: true }
    );
    if (!updatedRequest) {
      return res.status(404).json({ message: "Request not found" });
    }
    res.status(200).json({ message: "Buyer Assistance request updated successfully!", data: updatedRequest });
  } catch (error) {
    res.status(500).json({ message: "Error updating Buyer Assistance request", error });
  }
});




router.get("/fetch-matching-property", async (req, res) => {
  try {
    const { ba_id } = req.query;

    if (!ba_id) {
      return res.status(400).json({ message: "Buyer Assistance ID is required" });
    }

    const buyerRequest = await BuyerAssistance.findOne({ ba_id: ba_id });

    if (!buyerRequest) {
      return res.status(404).json({ message: "No Buyer Assistance request found for this ID" });
    }

    const { propertyMode, propertyType, minPrice, maxPrice, city, area, facing } = buyerRequest;

    const query = {
      propertyMode: propertyMode,
      propertyType: propertyType,
      city: city,
      area: area,
      facing: facing,
      price: { $gte: parseInt(minPrice), $lte: parseInt(maxPrice) }, // Convert price range to numbers
      // status: { $in: ["active", "incomplete"] }, // Allow "incomplete" properties
    };


    const matchingProperties = await AddModel.find(query);

    if (matchingProperties.length === 0) {
      return res.status(404).json({ message: "No matching properties found" });
    }

    res.status(200).json({
      message: "Matching properties fetched successfully!",
      data: matchingProperties,
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});



router.get("/fetch-matched-properties", async (req, res) => {
  try {
    const { ba_id } = req.query;

    if (!ba_id) {
      return res.status(400).json({ message: "Buyer Assistance ID is required" });
    }

    // Fetch Buyer Assistance Request Data
    const buyerRequest = await BuyerAssistance.findOne({ ba_id: ba_id });
    if (!buyerRequest) {
      return res.status(404).json({ message: "No Buyer Assistance request found for this ID" });
    }

    const {
      phoneNumber: buyerPhoneNumber,
      propertyMode,
      propertyType,
      minPrice,
      maxPrice,
      city,
      area,
      facing
    } = buyerRequest;

    // 1️⃣ Fetch Buyer-Matched Properties (Properties posted by this buyer that match the buyer assistance request)
    const buyerMatchedProperties = await AddModel.find({
      phoneNumber: buyerPhoneNumber, // Owner's posted properties
      propertyMode: propertyMode,
      propertyType: propertyType,
      city: city,
      area: area,
      facing: facing,
      price: { $gte: parseInt(minPrice), $lte: parseInt(maxPrice) },
      status: { $in: ["active", "incomplete"] },
    });

    // 2️⃣ Fetch Owner-Matched Properties (Properties that match this buyer assistance request)
    const ownerMatchedProperties = await AddModel.find({
      propertyMode: propertyMode,
      propertyType: propertyType,
      city: city,
      area: area,
      facing: facing,
      price: { $gte: parseInt(minPrice), $lte: parseInt(maxPrice) },
      status: { $in: ["active", "incomplete"] },
    });

    res.status(200).json({
      message: "Matching properties fetched successfully!",
      buyerMatchedProperties: buyerMatchedProperties,
      ownerMatchedProperties: ownerMatchedProperties,
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});



router.get("/fetch-buyer-matched-properties-by-phone", async (req, res) => {
  try {
    const { phoneNumber } = req.query;

    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    // Fetch Properties Posted by This User
    const ownerProperties = await AddModel.find({
      $or: [
        { phoneNumber: phoneNumber },
        { phoneNumber: `+${phoneNumber}` },
      ]
    });


    if (!ownerProperties.length) {
      return res.status(404).json({ message: "No properties found for this user" });
    }

    // Extract unique property details
    const propertyConditions = ownerProperties.map(property => ({
      propertyMode: property.propertyMode,
      propertyType: property.propertyType,
      city: property.city,
      area: property.area,
      facing: property.facing,
      minPrice: { $lte: property.price },
      maxPrice: { $gte: property.price },
    }));


    // Fetch Buyer Assistance Requests that match these property details
    const matchedBuyerRequests = await BuyerAssistance.find({
      $or: propertyConditions,
      phoneNumber: { $ne: phoneNumber }
    });


    res.status(200).json({
      message: "Buyer-Matched Assistance Requests fetched successfully!",
      matchedBuyerRequests: matchedBuyerRequests,
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});




router.put("/update-status-buyer-assistance/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { ba_status, userPhoneNumber } = req.body;

    if (!ba_status || !userPhoneNumber) {
      return res.status(400).json({ message: "Status and user phone number are required" });
    }

    if (!["buyer-assistance-interest"].includes(ba_status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    // ✅ Normalize phone number (Remove non-digits & keep last 10 digits)
    let normalizedUserPhone = userPhoneNumber.replace(/\D/g, "").slice(-10);

    // ✅ Update Buyer Assistance status and store user phone number
    const updatedAssistance = await BuyerAssistance.findByIdAndUpdate(
      id,
      {
        ba_status,
        interestedUserPhone: normalizedUserPhone, // Store user phone number
      },
      { new: true }
    );

    if (!updatedAssistance) {
      return res.status(404).json({ message: "Buyer Assistance not found" });
    }

    res.status(200).json({
      message: `Buyer Assistance status updated to '${ba_status}' successfully!`,
      data: updatedAssistance,
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

router.get("/buyer-assistance-interests", async (req, res) => {
  try {
    const assistanceInterests = await BuyerAssistance.find({ ba_status: "buyer-assistance-interest" });

    if (!assistanceInterests.length) {
      return res.status(404).json({ message: "No buyer assistance interests found" });
    }

    res.status(200).json({
      message: "Buyer assistance interests fetched successfully",
      data: assistanceInterests, // Send full data
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});



router.get("/fetch-buyerAssistance/:ba_id", async (req, res) => {
  const { ba_id } = req.params;

  if (!ba_id) {
    return res.status(400).json({ message: "BA ID is required" });
  }

  try {
    const request = await BuyerAssistance.findOne({ ba_id });
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }
    res.status(200).json({ message: "Buyer Assistance request fetched successfully!", data: request });
  } catch (error) {
    res.status(500).json({ message: "Error fetching Buyer Assistance request", error });
  }
});



router.get("/fetch-matched-datas-buyer", async (req, res) => {
  try {
    const { phoneNumber } = req.query;

    if (!phoneNumber) {
      return res
        .status(400)
        .json({ message: "Buyer Assistance phone number is required" });
    }

    // Normalize the phone number
    const normalizedPhone = normalizePhone(phoneNumber);

    // Fetch all Buyer Assistance requests for this phone number
    const buyerRequests = await BuyerAssistance.find({
      phoneNumber: { $regex: new RegExp(`${normalizedPhone}$`, "i") },
    });

    if (!buyerRequests.length) {
      return res
        .status(404)
        .json({ message: "No Buyer Assistance requests found for this phone number" });
    }

    const matchedData = [];

    for (let buyerRequest of buyerRequests) {
      // Fetch matched properties
      const matchedProperties = await AddModel.find({
        propertyMode: buyerRequest.propertyMode,
        propertyType: buyerRequest.propertyType,
        city: buyerRequest.city,
        area: buyerRequest.area,
        facing: buyerRequest.facing,
       
        price: {
          $gte: Number(buyerRequest.minPrice),
          $lte: Number(buyerRequest.maxPrice),
        },
      });

      // Only add buyer assistance with matched properties
      if (matchedProperties.length > 0) {
        matchedData.push({
          buyerAssistanceCard: {
            _id:buyerRequest._id,
            Ba_Id:buyerRequest.ba_id,
            name: buyerRequest.baName,
            phoneNumber: buyerRequest.phoneNumber,
            city: buyerRequest.city,
            area: buyerRequest.area,
            minPrice: buyerRequest.minPrice,
            maxPrice:buyerRequest.maxPrice,
            propertyType: buyerRequest.propertyType,
            facing: buyerRequest.facing,
            propertyAge: buyerRequest.propertyAge,
            propertyMode: buyerRequest.propertyMode,
            paymentType: buyerRequest.paymentType,
            bankLoan: buyerRequest.bankLoan,
          },
          matchedProperties: matchedProperties.map((property) => ({
            propertyId: property.ppcId,
            postedByUser: property.phoneNumber,
            price: property.price,
            city: property.city,
            area: property.area,
            state: property.state,
            propertyType: property.propertyType,
            facing: property.facing,
            bedrooms:property.bedrooms,
        totalArea:property.totalArea,
        areaUnit:property.areaUnit,
        postedBy:property.postedBy,
        createdAt:property.createdAt,
          })),
        });
      }
    }

    if (matchedData.length === 0) {
      return res.status(404).json({ message: "No matched properties found" });
    }

    res.status(200).json({
      message: "Matched Data Fetched Successfully!",
      totalMatches: matchedData.length,
      data: matchedData,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});






router.get("/fetch-matched-data-owner", async (req, res) => {
  try {
    const { phoneNumber } = req.query;

    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    // Fetch all properties posted by the owner
    const properties = await AddModel.find({ phoneNumber });

    if (!properties.length) {
      return res
        .status(404)
        .json({ message: "No properties found for this owner" });
    }

    const matchedData = [];

    for (let property of properties) {
      // Match buyer assistance for each property
      const conditions = {
        propertyMode: property.propertyMode,
        propertyType: property.propertyType,
        city: property.city,
        area: property.area,
        facing: property.facing,
        minPrice: { $lte: property.price },
        maxPrice: { $gte: property.price },
      };

      const matchedBuyers = await BuyerAssistance.find(conditions);

      if (matchedBuyers.length > 0) {
        matchedData.push({
          propertyDetails: {
            propertyId: property.ppcId,
            postedByUser: property.phoneNumber,
            price: property.price,
            city: property.city,
            area: property.area,
            state: property.state,
            propertyMode:property.propertyMode,
            propertyType: property.propertyType,
            facing: property.facing,
            bedrooms:property.bedrooms,
            totalArea:property.totalArea,
            areaUnit:property.areaUnit,
            postedBy:property.postedBy,
            createdAt:property.createdAt,

          },
          matchedBuyerRequests: matchedBuyers.map((buyer) => ({
            name: buyer.baName,
            phoneNumber: buyer.phoneNumber,
            city: buyer.city,
            area: buyer.area,
            priceRange: `${buyer.minPrice} - ${buyer.maxPrice}`,
            propertyType: buyer.propertyType,
            facing: buyer.facing,
            propertyAge: buyer.propertyAge,
            Ba_Id: buyer.ba_id,
          })),
        });
      }
    }
    if (!matchedData.length) {
      return res
        .status(404)
        .json({ message: "No matched buyer assistance requests found" });
    }

    res.status(200).json({
      message: "Buyer-Matched Assistance Requests fetched successfully!",
      totalMatches: matchedData.length,
      data: matchedData,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});




router.get("/fetch-all-matched-datas", async (req, res) => {
  try {
    const buyerRequests = await BuyerAssistance.find({});
    const matchedData = [];

    for (let buyerRequest of buyerRequests) {
      const matchedProperties = await AddModel.find({
        propertyMode: buyerRequest.propertyMode,
        propertyType: buyerRequest.propertyType,
        city: buyerRequest.city,
        area: buyerRequest.area,
        facing: buyerRequest.facing,
        price: {
          $gte: Number(buyerRequest.minPrice),
          $lte: Number(buyerRequest.maxPrice),
        },
      });

      if (matchedProperties.length > 0) {
        matchedData.push({
          buyerAssistanceCard: {
            _id: buyerRequest._id,
            Ba_Id: buyerRequest.ba_id,
            name: buyerRequest.baName,
            phoneNumber: buyerRequest.phoneNumber,
            city: buyerRequest.city,
            area: buyerRequest.area,
            minPrice: buyerRequest.minPrice,
            maxPrice: buyerRequest.maxPrice,
            propertyType: buyerRequest.propertyType,
            facing: buyerRequest.facing,
            propertyAge: buyerRequest.propertyAge,
            propertyMode: buyerRequest.propertyMode,
            paymentType: buyerRequest.paymentType,
            bankLoan: buyerRequest.bankLoan,
          },
          matchedProperties: matchedProperties.map((property) => ({
            propertyId: property.ppcId,
            postedByUser: property.phoneNumber,
            price: property.price,
            city: property.city,
            area: property.area,
            state: property.state,
            propertyType: property.propertyType,
            facing: property.facing,
            bedrooms: property.bedrooms,
            totalArea: property.totalArea,
            areaUnit: property.areaUnit,
            postedBy: property.postedBy,
            createdAt: property.createdAt,
          })),
        });
      }
    }

    if (!matchedData.length) {
      return res
        .status(404)
        .json({ message: "No matched data found", success: false });
    }

    res.status(200).json({
      message: "All matched buyer-property data fetched successfully",
      totalMatches: matchedData.length,
      data: matchedData,
      success: true,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});















// *************** all buyer with matched property ***************

// Function to normalize phone numbers
const normalizePhone = (phone) => {
  return phone.replace(/\D/g, "").slice(-10);
};

router.get("/fetch-matched-data-buyer", async (req, res) => {
  try {
    const { phoneNumber } = req.query;

    if (!phoneNumber) {
      return res
        .status(400)
        .json({ message: "Buyer Assistance phone number is required" });
    }

    // Normalize the phone number
    const normalizedPhone = normalizePhone(phoneNumber);

    // Fetch all Buyer Assistance requests for this phone number
    const buyerRequests = await BuyerAssistance.find({
      phoneNumber: { $regex: new RegExp(`${normalizedPhone}$`, "i") },
    });

    if (!buyerRequests.length) {
      return res
        .status(404)
        .json({ message: "No Buyer Assistance requests found for this phone number" });
    }

    let matchedData = [];

    for (let buyerRequest of buyerRequests) {
      // Fetch matched properties based on buyer assistance criteria
      const matchedProperties = await AddModel.find({
        propertyMode: buyerRequest.propertyMode,
        propertyType: buyerRequest.propertyType,
        city: buyerRequest.city,
        area: buyerRequest.area,
        facing: buyerRequest.facing,
       
        price: {
          $gte: Number(buyerRequest.minPrice),
          $lte: Number(buyerRequest.maxPrice),
        },
      });

      matchedData.push({
        buyerAssistanceCard: {
          name: buyerRequest.baName,
          phoneNumber: buyerRequest.phoneNumber,
          city: buyerRequest.city,
          area: buyerRequest.area,
          priceRange: `${buyerRequest.minPrice} - ${buyerRequest.maxPrice}`,
          propertyType: buyerRequest.propertyType,
          facing: buyerRequest.facing,
          propertyAge: buyerRequest.propertyAge,
        },
        matchedProperties: matchedProperties.map((property) => ({
          propertyId: property.ppcId,
          postedByUser: property.phoneNumber,
          price: property.price,
          city: property.city,
          area: property.area,
          state: property.state,
          propertyType: property.propertyType,
          facing: property.facing,
        })),
      });
    }

    res.status(200).json({
      message: "Matched Data Fetched Successfully!",
      totalMatches: matchedData.length,
      data: matchedData,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});




router.get("/fetch-owner-matched-properties", async (req, res) => {
  try {
    let { phoneNumber } = req.query;

    if (!phoneNumber) {
      return res.status(400).json({ message: "Buyer Assistance phone number is required" });
    }

    const normalizedPhone = normalizePhone(phoneNumber);

    // Fetch all Buyer Assistance Requests for this phone number
    const buyerRequests = await BuyerAssistance.find({
      phoneNumber: { $regex: new RegExp(`${normalizedPhone}$`, "i") }
    });

    if (!buyerRequests.length) {
      return res.status(404).json({ message: "No Buyer Assistance requests found for this phone number" });
    }


    let matchedProperties = [];

    for (let buyerRequest of buyerRequests) {
  

      const properties = await AddModel.find({
        propertyMode: buyerRequest.propertyMode,
        propertyType: buyerRequest.propertyType,
        city: buyerRequest.city,
        area: buyerRequest.area,
        facing: buyerRequest.facing,
        price: {
          $gte: Number(buyerRequest.minPrice),
          $lte: Number(buyerRequest.maxPrice)
        }
      });


      matchedProperties.push(...properties);
    }

    res.status(200).json({
      message: "Owner-Matched Properties fetched successfully!",
      total: matchedProperties.length,
      properties: matchedProperties
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});



router.get("/fetch-matched-buyers-for-owner", async (req, res) => {
  try {
    const { phoneNumber } = req.query;

    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    const properties = await AddModel.find({ phoneNumber });

    if (!properties.length) {
      return res.status(404).json({ message: "No properties found for this owner" });
    }


    let allMatchedBuyers = [];

    for (let property of properties) {
      const conditions = {
        propertyMode: property.propertyMode,
        propertyType: property.propertyType,
        city: property.city,
        area: property.area,
        facing: property.facing,
        minPrice: { $lte: property.price },
        maxPrice: { $gte: property.price }
      };


      const matchedBuyers = await BuyerAssistance.find(conditions);

      allMatchedBuyers.push(...matchedBuyers);
    }

    if (!allMatchedBuyers.length) {
      return res.status(404).json({ message: "No matched buyer assistance requests found" });
    }

    res.status(200).json({
      message: "Buyer-Matched Assistance Requests fetched successfully!",
      matchedBuyerRequests: allMatchedBuyers
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});



// ********************************************************************************************

router.get("/fetch-buyer-matched-properties/count", async (req, res) => {
  try {
    let { phoneNumber } = req.query;

    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    // ✅ Normalize phone number (Remove non-digits & keep last 10 digits)
    let normalizedPhone = phoneNumber.replace(/\D/g, "").slice(-10);

    // ✅ Fetch property details using phone number
    const property = await AddModel.findOne({
      phoneNumber: { $regex: new RegExp(`${normalizedPhone}$`, "i") }
    });

    if (!property) {
      return res.status(200).json({ matchedPropertiesCount: 0 });
    }

    // ✅ Fetch Buyer Assistance requests matching property details
    const matchedBuyerRequestsCount = await BuyerAssistance.countDocuments({
      propertyMode: property.propertyMode,
      propertyType: property.propertyType,
      city: property.city,
      area: property.area,
      facing: property.facing
    });

    return res.status(200).json({ matchedPropertiesCount: matchedBuyerRequestsCount });

  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
});




router.get("/fetch-owner-matched-properties/count", async (req, res) => {
  try {
    let { phoneNumber } = req.query;

    if (!phoneNumber) {
      return res.status(400).json({ message: "Buyer Assistance phone number is required" });
    }

    // Normalize phone number
    const normalizedPhone = phoneNumber.replace(/\D/g, "").slice(-10);


    // Fetch all Buyer Assistance Requests for this user
    const buyerRequests = await BuyerAssistance.find({
      phoneNumber: { $regex: new RegExp(`${normalizedPhone}$`, "i") }
    });

    if (!buyerRequests.length) {
      return res.status(404).json({ message: "No Buyer Assistance requests found for this phone number" });
    }


    let matchedPropertyCount = 0;

    for (let buyerRequest of buyerRequests) {
   

      // Count Owner-Matched Properties
      const count = await AddModel.countDocuments({
        propertyMode: buyerRequest.propertyMode,
        propertyType: buyerRequest.propertyType,
        city: buyerRequest.city,
        area: buyerRequest.area,
        facing: buyerRequest.facing,
        price: { $gte: Number(buyerRequest.minPrice), $lte: Number(buyerRequest.maxPrice) }
      });

      matchedPropertyCount += count;
    }

    res.status(200).json({
      message: "Owner-Matched Property count fetched successfully!",
      matchedPropertyCount
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});



router.get("/fetch-buyerAssistance-user", async (req, res) => {
  try {
    let { phoneNumber } = req.query;

    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    // ✅ Normalize input: Remove non-digit characters and keep only the last 10 digits
    let normalizedPhone = phoneNumber.replace(/\D/g, "").slice(-10);


    // ✅ MongoDB Query: Match all variations of the phone number
    const buyerRequests = await BuyerAssistance.find({
      phoneNumber: { $regex: new RegExp(`${normalizedPhone}$`, "i") }
    });

    if (!buyerRequests.length) {
      return res.status(404).json({ message: "No Buyer Assistance request found for this phone number" });
    }

    // ✅ Format phone number in response to always use +91
    const formattedResponse = buyerRequests.map(request => ({
      ...request.toObject(),
      phoneNumber: `+91${request.phoneNumber.replace(/^91/, "").replace(/^\+?/, "")}`
    }));

    res.status(200).json({ 
      message: "Buyer Assistance request(s) fetched successfully!", 
      data: formattedResponse 
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});






router.get("/expire-buyerAssistance", async (req, res) => {
  try {
    const buyerAssistanceList = await BuyerAssistance.find();
    const phoneNumbers = [...new Set(buyerAssistanceList.map(r => r.phoneNumber))];

    const plans = await PricingPlans.find({
      phoneNumber: { $in: phoneNumbers }
    });

    // 🔍 Get latest follow-up per phoneNumber
    const followUps = await FollowUp.aggregate([
      { $match: { phoneNumber: { $in: phoneNumbers } } },
      { $sort: { followupDate: -1 } },
      {
        $group: {
          _id: "$phoneNumber",
          adminName: { $first: "$adminName" }
        }
      }
    ]);

    const followUpMap = {};
    followUps.forEach(f => {
      followUpMap[f._id] = f.adminName;
    });

    const formatDate = (date) =>
      date ? new Date(date).toLocaleDateString("en-GB") : "N/A";

    const calculateExpiry = (startDate, durationDays) => {
      if (!startDate || !durationDays) return null;
      const expiry = new Date(startDate);
      expiry.setDate(expiry.getDate() + Number(durationDays));
      return expiry;
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tenDaysFromNow = new Date();
    tenDaysFromNow.setDate(today.getDate() + 10);
    tenDaysFromNow.setHours(23, 59, 59, 999);

    const combinedData = buyerAssistanceList.map((ba) => {
      const plan = plans.find(p =>
        Array.isArray(p.phoneNumber)
          ? p.phoneNumber.includes(ba.phoneNumber)
          : p.phoneNumber === ba.phoneNumber
      );

      const expiryDate = calculateExpiry(plan?.createdAt, plan?.durationDays);
      let expiryMessage = "No active plan";

      if (expiryDate) {
        const timeDiff = expiryDate.getTime() - today.getTime();
        const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

        if (daysRemaining > 0) {
          expiryMessage = `Your plan expires in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}`;
        } else if (daysRemaining === 0) {
          expiryMessage = "Your plan expires today!";
        } else {
          expiryMessage = `Your plan expired ${Math.abs(daysRemaining)} ${daysRemaining === -1 ? 'day' : 'days'} ago`;
        }
      }

      return {
        ...ba._doc,
        planName: plan?.name || "No Plan",
        planCreatedAt: formatDate(plan?.createdAt),
        planExpiry: expiryDate ? formatDate(expiryDate) : "N/A",
        expiryMessage,
        planExpiryRaw: expiryDate,
        adminName: followUpMap[ba.phoneNumber] || "N/A"
      };
    });

    const filteredData = combinedData.filter(entry => {
      if (!entry.planExpiryRaw) return false;

      const expiryDate = new Date(entry.planExpiryRaw);
      const timeDiff = expiryDate.getTime() - today.getTime();
      const daysDifference = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

      return daysDifference <= 10 && daysDifference >= -7;
    });

    filteredData.sort((a, b) => {
      const aDiff = a.planExpiryRaw ? a.planExpiryRaw.getTime() - today.getTime() : 0;
      const bDiff = b.planExpiryRaw ? b.planExpiryRaw.getTime() - today.getTime() : 0;
      return aDiff - bDiff;
    });

    const finalData = filteredData.map(entry => {
      const { planExpiryRaw, ...rest } = entry;
      return rest;
    });

    res.status(200).json({
      success: true,
      message: "Buyer Assistance requests with expiring plans fetched successfully!",
      stats: {
        total: finalData.length,
        expiringSoon: finalData.filter(d => d.expiryMessage.includes("expires in")).length,
        expiredRecently: finalData.filter(d => d.expiryMessage.includes("expired")).length
      },
      data: finalData
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch expiring buyer assistance data",
      error: error.message
    });
  }
});






router.post("/send-interest", async (req, res) => {
  try {
    const { ba_id, buyerPhone } = req.body;

    const ba = await BuyerAssistance.findOne({ ba_id });
    if (!ba) {
      return res.status(404).json({ message: "Buyer Assistance not found" });
    }

    const plan = await PricingPlans.findOne({ phoneNumber: buyerPhone });

    // Set the status based on the plan name
    let statusToSet = "buyer-interest-tried"; // Default for Free plan

    // If the user has a paid plan (not Free), set the status to full interest
    if (plan && plan.name && plan.name.toLowerCase() !== "free") {
      statusToSet = "buyer-assistance-interest";
    }

    // Add buyer phone to interested users if not already present
    if (!ba.interestedUserPhone.includes(buyerPhone)) {
      ba.interestedUserPhone.push(buyerPhone);
    }

    // Update ba_status to either 'buyer-assistance-interest' or 'buyer-interest-tried'
    ba.ba_status = statusToSet;

    // Save the updated BuyerAssistance record
    await ba.save();

    res.status(200).json({
      success: true,
      message: `Interest ${statusToSet === "buyer-assistance-interest" ? "sent" : "tried"} successfully.`,
      data: ba
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to process interest request",
      error: error.message
    });
  }
});


router.post("/send-interest-with-plan", async (req, res) => {
  try {
    const { ba_id, buyerPhone } = req.body;

    // Step 1: Find the BuyerAssistance record
    const ba = await BuyerAssistance.findOne({ ba_id });
    if (!ba) {
      return res.status(404).json({ message: "Buyer Assistance not found" });
    }

    // Step 2: Find the buyer's plan
    const plan = await PricingPlans.findOne({ phoneNumber: buyerPhone });

    // Default status
    let statusToSet = "buyer-interest-tried"; // Free plan fallback

    // Step 3: Determine interest status based on plan
    if (plan && plan.name && plan.name.toLowerCase() !== "free") {
      statusToSet = "buyer-assistance-interest";
    }

    // Step 4: Update interestedUserPhone if not already present
    if (!ba.interestedUserPhone.includes(buyerPhone)) {
      ba.interestedUserPhone.push(buyerPhone);
    }

    // Step 5: Update status
    ba.ba_status = statusToSet;

    // Step 6: Save updated BuyerAssistance
    await ba.save();

    // Step 7: Calculate plan expiry if plan exists
    let expiryDate = null;
    if (plan) {
      const createdAt = new Date(plan.createdAt);
      const duration = plan.durationDays || 0;
      expiryDate = new Date(createdAt);
      expiryDate.setDate(expiryDate.getDate() + duration);
    }

    // Step 8: Respond with merged result
    return res.status(200).json({
      success: true,
      message: `Interest ${statusToSet === "buyer-assistance-interest" ? "sent" : "tried"} successfully.`,
      buyerAssistance: ba,
      plan: plan
        ? {
            phoneNumber: plan.phoneNumber,
            planName: plan.name,
            packageType: plan.packageType,
            durationDays: plan.durationDays,
            price: plan.price,
            createdAt: plan.createdAt,
            expiryDate: expiryDate?.toISOString().split("T")[0],
          }
        : null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to process interest request",
      error: error.message,
    });
  }
});





router.get("/expires-buyerAssistance", async (req, res) => {
  try {
    const buyerAssistanceList = await BuyerAssistance.find();
    const phoneNumbers = [...new Set(buyerAssistanceList.map(r => r.phoneNumber))];

    const plans = await PricingPlans.find({
      phoneNumber: { $in: phoneNumbers }
    });

    const formatDate = (date) =>
      date ? new Date(date).toLocaleDateString("en-GB") : "N/A";

    const calculateExpiry = (startDate, durationDays) => {
      if (!startDate || !durationDays) return null;
      const expiry = new Date(startDate);
      expiry.setDate(expiry.getDate() + Number(durationDays));
      return expiry;
    };

    const today = new Date();
    const tenDaysFromNow = new Date();
    tenDaysFromNow.setDate(today.getDate() + 10);

    const combinedData = buyerAssistanceList.map((ba) => {
      const plan = plans.find(p =>
        Array.isArray(p.phoneNumber)
          ? p.phoneNumber.includes(ba.phoneNumber)
          : p.phoneNumber === ba.phoneNumber
      );

      const expiryDate = calculateExpiry(plan?.createdAt, plan?.durationDays);

      return {
        ...ba._doc,
        planName: plan?.name || "No Plan",
        planCreatedAt: formatDate(plan?.createdAt),
        planExpiry: expiryDate ? formatDate(expiryDate) : "N/A",
        planExpiryRaw: expiryDate // used for filtering
      };
    });

    // Filter entries where expiry is within the next 10 days
    const filteredData = combinedData.filter(entry =>
      entry.planExpiryRaw && entry.planExpiryRaw >= today && entry.planExpiryRaw <= tenDaysFromNow
    );

    // Remove raw expiry from final output
    const finalData = filteredData.map(entry => {
      const { planExpiryRaw, ...rest } = entry;
      return rest;
    });

    res.status(200).json({
      success: true,
      message: "Buyer Assistance requests fetched successfully!",
      data: finalData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch buyer assistance data",
      error: error.message
    });
  }
});





router.get("/fetch-buyerAssistance", async (req, res) => {
  try {
    const buyerAssistanceList = await BuyerAssistance.find();

    const phoneNumbers = [...new Set(buyerAssistanceList.map(r => r.phoneNumber))];
    const plans = await PricingPlans.find({ phoneNumber: { $in: phoneNumbers } });

    const formatDate = (date) =>
      date ? new Date(date).toLocaleDateString("en-GB") : "N/A";

    const calculateExpiry = (startDate, durationDays) => {
      if (!startDate || !durationDays) return "N/A";
      const expiry = new Date(startDate);
      expiry.setDate(expiry.getDate() + Number(durationDays));
      return formatDate(expiry);
    };

    const combinedData = buyerAssistanceList.map((ba) => {
      const plan = plans.find(p =>
        Array.isArray(p.phoneNumber)
          ? p.phoneNumber.includes(ba.phoneNumber)
          : p.phoneNumber === ba.phoneNumber
      );

      return {
        ...ba._doc,
        planName: plan?.name || "No Plan",
        planCreatedAt: formatDate(plan?.createdAt),
        planExpiry: calculateExpiry(plan?.createdAt, plan?.durationDays)
      };
    });

    res.status(200).json({
      success: true,
      message: "Buyer Assistance requests fetched successfully!",
      data: combinedData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch buyer assistance data",
      error: error.message
    });
  }
});


// Update Buyer Assistance by ID
router.put("/update-buyerAssistance/:id", async (req, res) => {
  try {
    const updatedRequest = await BuyerAssistance.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedRequest) {
      return res.status(404).json({ message: "Request not found" });
    }
    res.status(200).json({ message: "Buyer Assistance request updated successfully!", data: updatedRequest });
  } catch (error) {
    res.status(500).json({ message: "Error updating Buyer Assistance request", error });
  }
});


// Fetch Buyer Assistance Requests with optional ba_status filter
router.get("/fetch-buyerAssistance", async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { ba_status: status } : {};
    const requests = await BuyerAssistance.find(filter);
    res.status(200).json({
      message: "Buyer Assistance requests fetched successfully!",
      data: requests,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching Buyer Assistance requests",
      error,
    });
  }
});







// GET /buyerAssistance-pending-with-plan
router.get("/fetch-buyerAssistance-pending", async (req, res) => {
  try {
    // Step 1: Fetch only pending requests
    const pendingRequests = await BuyerAssistance.find({ ba_status: "baPending" });

    // Step 2: Extract phone numbers
    const phoneNumbers = [...new Set(pendingRequests.map(req => req.phoneNumber))];

    // Step 3: Fetch plan data for those phone numbers
    const plans = await PricingPlans.find({ phoneNumber: { $in: phoneNumbers } });

    // Step 4: Map phoneNumber → plan info
    const planMap = {};
    plans.forEach(plan => {
      const expiryDate = new Date(plan.createdAt);
      expiryDate.setDate(expiryDate.getDate() + (plan.durationDays || 0));
      planMap[plan.phoneNumber] = {
        planName: plan.name || 'N/A',
        planCreatedAt: plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : 'N/A',
        durationDays: plan.durationDays || 0,
        planExpiryDate: expiryDate.toLocaleDateString(),
        packageType: plan.packageType || 'N/A',
      };
    });

    // Step 5: Enrich each request with plan info
    const enrichedData = pendingRequests.map(req => ({
      ...req._doc,
      planDetails: planMap[req.phoneNumber] || {
        planName: 'N/A',
        planCreatedAt: 'N/A',
        durationDays: 0,
        planExpiryDate: 'N/A',
        packageType: 'N/A',
      }
    }));

    res.status(200).json({
      message: "Pending buyer assistance requests with plan details fetched successfully",
      data: enrichedData,
    });

  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch enriched pending buyer assistance requests",
      error: error.message,
    });
  }
});



// Fetch Single Buyer Assistance Request by ID
router.get("/fetch-buyerAssistance/:id", async (req, res) => {
  try {
    const request = await BuyerAssistance.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }
    res.status(200).json({ message: "Buyer Assistance request fetched successfully!", data: request });
  } catch (error) {
    res.status(500).json({ message: "Error fetching Buyer Assistance request", error });
  }
});

// Delete Buyer Assistance Request
router.delete("/delete-buyerAssistance/:id", async (req, res) => {
  try {
    const deletedRequest = await BuyerAssistance.findByIdAndDelete(req.params.id);
    if (!deletedRequest) {
      return res.status(404).json({ message: "Request not found" });
    }
    res.status(200).json({ message: "Buyer Assistance request deleted successfully!" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting Buyer Assistance request", error });
  }
});





router.put("/update-status-buyer-assistance/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { ba_status, userPhoneNumber } = req.body;

    if (!ba_status || !userPhoneNumber) {
      return res.status(400).json({ message: "Status and user phone number are required" });
    }

    if (!["buyer-assistance-interest", "remove-assistance-interest"].includes(ba_status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    // ✅ Normalize phone number (Remove non-digits & keep last 10 digits)
    let normalizedUserPhone = userPhoneNumber.replace(/\D/g, "").slice(-10);

    // ✅ Use `$addToSet` to prevent duplicate entries in the array
    const updatedAssistance = await BuyerAssistance.findByIdAndUpdate(
      id,
      {
        ba_status,
        $addToSet: { interestedUserPhone: normalizedUserPhone }, // Add phone number without duplicates
      },
      { new: true }
    );

    if (!updatedAssistance) {
      return res.status(404).json({ message: "Buyer Assistance not found" });
    }

    res.status(200).json({
      message: `Buyer Assistance status updated to '${ba_status}' successfully!`,
      data: updatedAssistance,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});


router.get("/buyer-assistance-interests", async (req, res) => {
  try {
    const assistanceInterests = await BuyerAssistance.find({ ba_status: "buyer-assistance-interest" });

    if (!assistanceInterests.length) {
      return res.status(404).json({ message: "No buyer assistance interests found" });
    }

    res.status(200).json({
      message: "Buyer assistance interests fetched successfully",
      data: assistanceInterests, // Send full data
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});


router.put("/status-buyer-assistance/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { ba_status } = req.body;

    if (!ba_status) {
      return res.status(400).json({ message: "Status is required" });
    }

    // ✅ Update Buyer Assistance status
    const updatedAssistance = await BuyerAssistance.findByIdAndUpdate(
      id,
      { ba_status },
      { new: true } // Return updated document
    );

    if (!updatedAssistance) {
      return res.status(404).json({ message: "Buyer Assistance not found" });
    }

    res.status(200).json({
      message: "Buyer Assistance status updated successfully!",
      data: updatedAssistance
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});




router.delete("/delete-buyer-assistance/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Find and update record to soft delete
    const deletedAssistance = await BuyerAssistance.findByIdAndUpdate(
      id,
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );

    if (!deletedAssistance) {
      return res.status(404).json({ message: "Buyer Assistance request not found" });
    }

    res.status(200).json({
      message: "Buyer Assistance request deleted successfully",
      data: deletedAssistance,
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});




// ✅ API to Undo Delete (Restore Buyer Assistance)
router.put("/undo-delete-buyer-assistance/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Find and restore the deleted record
    const restoredAssistance = await BuyerAssistance.findByIdAndUpdate(
      id,
      { isDeleted: false, deletedAt: null },
      { new: true }
    );

    if (!restoredAssistance) {
      return res.status(404).json({ message: "Buyer Assistance request not found" });
    }

    res.status(200).json({
      message: "Buyer Assistance request restored successfully",
      data: restoredAssistance,
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// / API to Undo Delete (Restore Buyer Assistance by ba_id)
router.put("/undo-delete-buyer-assistance/:ba_id", async (req, res) => {
  try {
    const { ba_id } = req.params;

    // ✅ Find and update by ba_id
    const restoredAssistance = await BuyerAssistance.findOneAndUpdate(
      { ba_id: ba_id }, // Ensure numeric match
      { isDeleted: false, deletedAt: null },
      { new: true }
    );

    if (!restoredAssistance) {
      return res.status(404).json({ message: "Buyer Assistance request not found" });
    }

    res.status(200).json({
      message: "Buyer Assistance request restored successfully",
      data: restoredAssistance,
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});



// ✅ API to Soft Delete Buyer Assistance by ba_id
router.put("/delete-buyer-assistance/:ba_id", async (req, res) => {
  try {
    const { ba_id } = req.params;

    // ✅ Find and mark as deleted
    const deletedAssistance = await BuyerAssistance.findOneAndUpdate(
      { ba_id: ba_id }, // Ensure numeric type
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );

    if (!deletedAssistance) {
      return res.status(404).json({ message: "Buyer Assistance request not found" });
    }

    res.status(200).json({
      message: "Buyer Assistance request deleted successfully",
      data: deletedAssistance,
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});



router.delete("/delete-buyer-assistance-by-ppcId/:ppcId", async (req, res) => {
  try {
    const { ppcId } = req.params;

    const deletedAssistance = await BuyerAssistance.findOneAndUpdate(
      { ppcId },
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );

    if (!deletedAssistance) {
      return res.status(404).json({ message: "Buyer Assistance request not found" });
    }

    res.status(200).json({
      message: "Buyer Assistance request soft deleted successfully",
      data: deletedAssistance,
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});


router.put("/undo-delete-buyer-assistance-by-ppcId/:ppcId", async (req, res) => {
  try {
    const { ppcId } = req.params;

    const restoredAssistance = await BuyerAssistance.findOneAndUpdate(
      { ppcId },
      { isDeleted: false, deletedAt: null },
      { new: true }
    );

    if (!restoredAssistance) {
      return res.status(404).json({ message: "Buyer Assistance request not found" });
    }

    res.status(200).json({
      message: "Buyer Assistance request restored successfully",
      data: restoredAssistance,
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});



// ✅ Permanent Delete API
router.delete("/permanent-delete-buyer-assistance/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedAssistance = await BuyerAssistance.findByIdAndDelete(id);

    if (!deletedAssistance) {
      return res.status(404).json({ message: "Buyer Assistance request not found" });
    }

    res.status(200).json({ message: "Buyer Assistance request permanently deleted!" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});



module.exports = router;



















