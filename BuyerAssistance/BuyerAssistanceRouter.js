

const express = require("express");
const router = express.Router();
const BuyerAssistance = require("../BuyerAssistance/BuyerAssistanceModel");
const AddModel = require('../AddModel');
const NotificationUser = require('../Notification/NotificationDetailModel');

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

    // Normalize input: Remove country code if present
    let formattedPhoneNumber = phoneNumber.replace(/^\+91/, "").trim();

    // Check if user already has a ba_id
    let existingUser = await BuyerAssistance.findOne({ phoneNumber: formattedPhoneNumber });

    let newBaId;
    if (existingUser) {
      newBaId = existingUser.ba_id; // Reuse existing ba_id
    } else {
      // Find the latest `ba_id`
      let lastRecord = await BuyerAssistance.findOne({}, { ba_id: 1 }).sort({ ba_id: -1 });

      if (lastRecord && lastRecord.ba_id) {
        newBaId = lastRecord.ba_id + 1;
      } else {
        newBaId = 100; // Start from 100 if no records exist
      }
    }

    // Create a new Buyer Assistance request
    const newRequest = new BuyerAssistance({ 
      ...req.body, 
      baName: req.body.baName || "Buyer",
      phoneNumber: formattedPhoneNumber, 
      ba_id: newBaId
    });

    await newRequest.save();

    // ✅ Create notification (assume admin/support team uses "admin" as phone number)
    await NotificationUser.create({
      recipientPhoneNumber: phoneNumber, // Could be a group inbox, admin panel, or even dynamic
      senderPhoneNumber: formattedPhoneNumber,
      message: `New buyer assistance request submitted by ${formattedPhoneNumber}`,
      createdAt: new Date(),
    });

    res.status(201).json({ 
      message: "Buyer Assistance request added successfully!", 
      data: newRequest 
    });

  } catch (error) {
    res.status(500).json({ message: "Error adding Buyer Assistance request", error });
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

    // Validate that either ba_id or phoneNumber is provided
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



// Get All Buyer Assistance Requests
router.get("/get-buyerAssistance", async (req, res) => {
  try {
    const requests = await BuyerAssistance.find({});
    res.status(200).json({
      message: "All Buyer Assistance requests fetched successfully!",
      data: requests,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching Buyer Assistance requests", error });
  }
});

// Get Buyer Assistance Requests by Phone Number
router.get("/get-buyerAssistance/:phoneNumber", async (req, res) => {
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



const normalizePhone = (phone) => {
  return phone.replace(/\D/g, "").slice(-10);
};


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


// -------------

// Fetch All Buyer Assistance Requests
router.get("/fetch-buyerAssistance", async (req, res) => {
  try {
    const requests = await BuyerAssistance.find();
    res.status(200).json({ message: "Buyer Assistance requests fetched successfully!", data: requests });
  } catch (error) {
    res.status(500).json({ message: "Error fetching Buyer Assistance requests", error });
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



















