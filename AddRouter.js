
const express = require('express');
const router = express.Router();
const AddModel = require('./AddModel');
const UserViewsModel = require("./ViewsModel");
const BuyerAssistance = require("./BuyerAssistance/BuyerAssistanceModel");
const CallUserList = require('./CalledUserModel');
const NotificationUser = require('./Notification/NotificationDetailModel');
const DeletedAddModel = require ('./DeleteModel');
const UserLogin = require('./user/UserModel'); 



const multer = require('multer');
const path = require('path');
const fs = require('fs');



// Set up multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDirectory = 'uploads/';
        if (!fs.existsSync(uploadDirectory)) {
            fs.mkdirSync(uploadDirectory, { recursive: true });
        }
        cb(null, uploadDirectory);
    },
    filename: (req, file, cb) => {
        const fileExtension = path.extname(file.originalname);
        const fileName = Date.now() + fileExtension; // Unique filename
        cb(null, fileName);
    },
});


const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB file size limit
  fileFilter: (req, file, cb) => {
      const fileTypes = /jpeg|jpg|png|gif|mp4|avi|mov/; // Allowed file types
      const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = fileTypes.test(file.mimetype);
      if (extname && mimetype) {
          return cb(null, true); // Accept the file
      } else {
          return cb(new Error('Only image and video files (JPEG, PNG, GIF, MP4, AVI, MOV) are allowed!'), false);
      }
  },
});


// // Fixed version
// router.get('/user-lead-stats', async (req, res) => {
//   try {
//     const users = await UserLogin.find();

//     if (users.length === 0) {
//       return res.status(404).json({ message: 'No users found' });
//     }

//     const stats = await Promise.all(
//       users.map(async (user) => {
//         const properties = await AddModel.find({ phoneNumber: user.phoneNumber });

//         const propertyDetails = properties.map((prop) => ({
//           ppcId: prop.ppcId,
//           propertyMode: prop.propertyMode,
//           propertyType: prop.propertyType,
//           city: prop.city,
//           area: prop.area,
//           updatedAt: prop.updatedAt,
//           interestCount: prop.interestRequests?.length || 0,
//           contactCount: prop.contactRequests?.length || 0,
//           favoriteCount: prop.favoriteRequests?.length || 0,
//         }));

//         return {
//           phoneNumber: user.phone,
//           properties: propertyDetails, // already includes all prop details
//         };
//       })
//     );

//     return res.status(200).json({ message: 'User stats fetched', data: stats });
//   } catch (error) {
//     return res.status(500).json({ message: 'Server Error', error: error.message });
//   }
// });



router.put('/activate-all-properties', async (req, res) => {
  try {
    await AddModel.updateMany({}, { $set: { status: "active" } });
    res.status(200).json({ message: "All properties activated successfully!" });
  } catch (err) {
    res.status(500).json({ message: "Failed to activate all properties." });
  }
});


// ✅ PUT: Update a call entry by ID
router.put('/update-call/:id', async (req, res) => {
  try {
    const updatedCall = await CallUserList.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updatedCall);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ✅ DELETE: Delete a call entry by ID
router.delete('/delete-call/:id', async (req, res) => {
  try {
    await CallUserList.findByIdAndDelete(req.params.id);
    res.json({ message: 'Call entry deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ FETCH (custom route): Query by either ppcId or phoneNumber via query params
router.get('/call-fetch', async (req, res) => {
  try {
    const { ppcId, phoneNumber } = req.query;
    const query = {};
    if (ppcId) query.ppcId = ppcId;
    if (phoneNumber) query.phoneNumber = phoneNumber;

    const results = await CallUserList.find(query);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ------------


router.post('/call-user', async (req, res) => {
  try {
    const { ppcId, phoneNumber } = req.body;

    if (!ppcId || !phoneNumber) {
      return res.status(400).json({ message: 'ppcId and phoneNumber are required' });
    }

    const property = await AddModel.findOne({ ppcId });
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    const callEntry = new CallUserList({
      ppcId,
      phoneNumber,
      status: 'callRequestWaiting',
      propertyPhoneNumber: property.phoneNumber,
      propertyMode: property.propertyMode,
      propertyType: property.propertyType,
      postedBy: property.postedBy,
      area: property.area,
      city: property.city,
      district: property.district,
      state: property.state,
      bestTimeToCall: property.bestTimeToCall,
      areaUnit: property.areaUnit,
      totalArea: property.totalArea,
      bedrooms: property.bedrooms,
      facing: property.facing,
      ownership: property.ownership,
    });

    await callEntry.save();

    res.status(201).json({ message: 'Call entry saved', data: callEntry });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/call-user/:ppcId/:phoneNumber', async (req, res) => {
  try {
    const { ppcId, phoneNumber } = req.params;

    const callLogs = await CallUserList.find({ ppcId, phoneNumber }).sort({ createdAt: -1 });

    if (callLogs.length === 0) {
      return res.status(404).json({ message: 'No call records found' });
    }

    res.status(200).json({ message: 'Call logs fetched', data: callLogs });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});



// PATCH: Update call status
router.patch('/call-user/status', async (req, res) => {
  const { ppcId, userPhone, status } = req.body;

  if (!ppcId || !userPhone || !status) {
    return res.status(400).json({ message: "ppcId, userPhone, and status are required." });
  }

  try {
    const property = await AddModel.findOne({ ppcId });

    if (!property) {
      return res.status(404).json({ message: "Property not found." });
    }

    // Update the status of the interested user
    const updatedUsers = property.interestedUsers.map(user => {
      if (typeof user === 'object' && user.phone === userPhone) {
        return { ...user, callStatus: status };
      } else if (typeof user === 'string' && user === userPhone) {
        return { phone: user, callStatus: status };
      }
      return user;
    });

    property.interestedUsers = updatedUsers;

    await property.save();

    res.status(200).json({ message: "Call status updated successfully." });

  } catch (error) {
    res.status(500).json({ message: "Internal server error." });
  }
});





















router.get("/fetch-matched-buyers", async (req, res) => {
  try {
    const { propertyId } = req.query;

    if (!propertyId) {
      return res.status(400).json({ message: "Property ID is required" });
    }

    // Fetch Property Details
    const property = await AddModel.findById(propertyId);
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Match Buyer Assistance Requests
    const matchedBuyers = await BuyerAssistance.find({
      propertyMode: property.propertyMode,
      propertyType: property.propertyType,
      city: property.city,
      area: property.area,
      facing: property.facing,
      minPrice: { $lte: property.price },  // Min price should be <= property price
      maxPrice: { $gte: property.price },  // Max price should be >= property price
    });

    res.status(200).json({
      message: "Matched Buyer Assistance Requests fetched successfully!",
      matchedBuyers: matchedBuyers,
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});



router.get("/user-get-views/:phoneNumber", async (req, res) => {
  try {
    const { phoneNumber } = req.params;

    // Normalize phoneNumber
    const normalizedPhoneNumber = phoneNumber.replace(/\s+/g, "").replace(/\+/g, "");

    // Find the user's viewed properties
    const userViews = await UserViewsModel.findOne({ phoneNumber: normalizedPhoneNumber });

    if (!userViews || userViews.viewedProperties.length === 0) {
      return res.status(404).json({ message: "No viewed properties found" });
    }

    // Fetch full details for each ppcId
    const properties = await AddModel.find({ ppcId: { $in: userViews.viewedProperties } });

    res.status(200).json(properties);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});



router.get("/user-last-10-days-views/:phoneNumber", async (req, res) => {
  try {
    const { phoneNumber } = req.params;

    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    const digits = phoneNumber.replace(/\D/g, "").slice(-10);
    const variants = [`+91${digits}`, `91${digits}`, digits];

    const userViews = await UserViewsModel.findOne({
      phoneNumber: { $in: variants },
    });

    if (!userViews || !Array.isArray(userViews.viewedProperties)) {
      return res.status(404).json({ message: "No viewed properties found" });
    }

    const now = new Date();
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(now.getDate() - 10);

    const recentViews = userViews.viewedProperties
      .filter((view) => {
        const viewedAt = new Date(view.viewedAt);
        return viewedAt >= tenDaysAgo && viewedAt <= now;
      })
      .sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt));

    if (recentViews.length === 0) {
      return res
        .status(404)
        .json({ message: "No views in the last 10 days" });
    }

    const properties = await Promise.all(
      recentViews.map(async (view) => {
        const prop = await AddModel.findOne({ ppcId: view.ppcId });
        return prop
          ? {
              ...prop.toObject(),
              viewedAt: view.viewedAt,
            }
          : null;
      })
    );

    const filteredProperties = properties.filter(Boolean);

    return res.status(200).json({
      message: "Viewed properties in the last 10 days",
      properties: filteredProperties,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});


// Endpoint to count the views in the last 10 days
router.get("/user-view-count/:phoneNumber", async (req, res) => {
  try {
    const { phoneNumber } = req.params;

    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    const digits = phoneNumber.replace(/\D/g, "").slice(-10);
    const variants = [`+91${digits}`, `91${digits}`, digits];

    // Fetch user views data
    const userViews = await UserViewsModel.findOne({
      phoneNumber: { $in: variants },
    });

    if (!userViews || !Array.isArray(userViews.viewedProperties)) {
      return res.status(404).json({ message: "No viewed properties found" });
    }

    const now = new Date();
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(now.getDate() - 10);

    // Filter views in the last 10 days
    const recentViews = userViews.viewedProperties.filter((view) => {
      const viewedAt = new Date(view.viewedAt);
      return viewedAt >= tenDaysAgo && viewedAt <= now;
    });

    return res.status(200).json({
      message: `View count in the last 10 days for ${phoneNumber}`,
      viewCount: recentViews.length,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});



router.get("/user-get-all-last-views", async (req, res) => {
  try {
    const allUserViews = await UserViewsModel.find();

    if (!allUserViews || allUserViews.length === 0) {
      return res.status(404).json({ message: "No user views found" });
    }

    const result = [];

    for (const user of allUserViews) {
      if (user.viewedProperties.length === 0) continue;

      // Sort by viewedAt descending
      const sortedViews = user.viewedProperties.sort(
        (a, b) => new Date(b.viewedAt) - new Date(a.viewedAt)
      );

      const lastViewed = sortedViews[0];

      const property = await AddModel.findOne({ ppcId: lastViewed.ppcId });

      if (property) {
        result.push({
          phoneNumber: user.phoneNumber,
          property,
          viewedAt: lastViewed.viewedAt,
        });
      }
    }

    return res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});



router.post("/user-viewed-property", async (req, res) => {
  try {
    const { phoneNumber, ppcId } = req.body;

    if (!phoneNumber || !ppcId) {
      return res.status(400).json({ message: "phoneNumber and ppcId are required" });
    }

    // Normalize phone number
    const normalizedPhoneNumber = phoneNumber.replace(/\s+/g, "").replace(/\+/g, "");

    // Check if the property exists
    const property = await AddModel.findOne({ ppcId });
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    const propertyOwnerPhoneNumber = property.phoneNumber;

    // ✅ Step 1: Record the view in UserViews
    let userViews = await UserViewsModel.findOne({ phoneNumber: normalizedPhoneNumber });

    if (!userViews) {
      userViews = new UserViewsModel({
        phoneNumber: normalizedPhoneNumber,
        viewedProperties: [
          { ppcId, propertyOwnerPhoneNumber, viewedAt: new Date() },
        ],
      });
    } else {
      const alreadyViewed = userViews.viewedProperties.some((view) => view.ppcId === ppcId);
      if (!alreadyViewed) {
        userViews.viewedProperties.push({
          ppcId,
          propertyOwnerPhoneNumber,
          viewedAt: new Date(),
        });
      }
    }

    await userViews.save();

    // ✅ Step 2: Increment views in AddModel
    await AddModel.updateOne({ ppcId }, { $inc: { views: 1 } });

    // ✅ Step 3: Create a notification to the property owner
    await NotificationUser.create({
      recipientPhoneNumber: propertyOwnerPhoneNumber,
      senderPhoneNumber: normalizedPhoneNumber,
      message: `Your property (ID: ${ppcId}) was viewed by a user.`,
      ppcId: ppcId,
      createdAt: new Date(),
    });

    res.status(200).json({ message: "Property view recorded and notification sent" });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});


router.get("/user-views-count", async (req, res) => {
  try {
    // Aggregate total number of views from all user documents
    const result = await UserViewsModel.aggregate([
      { $unwind: "$viewedProperties" },
      { $count: "totalViews" }
    ]);

    const totalViews = result[0]?.totalViews || 0;

    res.status(200).json({
      message: "Total user property views fetched successfully",
      count: totalViews,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching user views count",
      error: error.message,
    });
  }
});


router.get("/user-viewed-properties", async (req, res) => {
  try {
    const { phoneNumber } = req.query;

    if (!phoneNumber) {
      return res.status(400).json({ message: "phoneNumber is required" });
    }

    // Normalize phone number (remove spaces and '+')
    const normalizedPhoneNumber = phoneNumber.replace(/\s+/g, "").replace(/\+/g, "");

    // Fetch the user's viewed properties
    const userViews = await UserViewsModel.findOne({ phoneNumber: normalizedPhoneNumber });

    if (!userViews || userViews.viewedProperties.length === 0) {
      return res.status(404).json({ message: "No viewed properties found" });
    }

    res.status(200).json({ viewedProperties: userViews.viewedProperties });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});


router.get("/all-viewed-properties", async (req, res) => {
  try {
    // Fetch all user views data
    const allUserViews = await UserViewsModel.find();

    if (!allUserViews.length) {
      return res.status(404).json({ message: "No property views found" });
    }

    // Extract unique ppcIds from all user views
    const allPpcIds = [
      ...new Set(
        allUserViews.flatMap((user) =>
          user.viewedProperties.map((view) => view.ppcId)
        )
      ),
    ];

    if (!allPpcIds.length) {
      return res.status(404).json({ message: "No viewed properties found" });
    }

    // Fetch property details using the collected ppcIds
    const properties = await AddModel.find(
      { ppcId: { $in: allPpcIds } },
      "ppcId price propertyType propertyMode city area totalArea areaUnit ownership phoneNumber"
    );

    // Map properties with the users who viewed them
    const viewedPropertiesData = properties.map((property) => {
      const usersWhoViewed = allUserViews
        .filter((user) =>
          user.viewedProperties.some((view) => view.ppcId === property.ppcId)
        )
        .map((user) => ({
          phoneNumber: user.phoneNumber,
          viewedAt: user.viewedProperties.find(
            (view) => view.ppcId === property.ppcId
          )?.viewedAt,
        }));

      return {
        ...property.toObject(),
        viewers: usersWhoViewed,
      };
    });

    return res.status(200).json({
      message: "All viewed properties retrieved successfully",
      viewedProperties: viewedPropertiesData,
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});


router.get("/property/:ppcId", async (req, res) => {
  try {
    const { ppcId } = req.params;
    const property = await AddModel.findOne({ ppcId });

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    res.status(200).json(property);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});



router.get("/property-owner-viewed-users", async (req, res) => {
  let { phoneNumber } = req.query;

  if (!phoneNumber) {
    return res.status(400).json({ message: "User phone number is required" });
  }

  phoneNumber = phoneNumber.replace(/\s+/g, "").replace("+", "");

  try {
    // Fetch user views
    const userViews = await UserViewsModel.findOne({ phoneNumber });

    if (!userViews || !userViews.viewedProperties?.length) {
      return res.status(404).json({ message: "No viewed properties found for this user" });
    }

    // Extract only ppcId values from viewedProperties
    const ppcIds = userViews.viewedProperties.map((property) => 
      typeof property === "object" && property !== null ? property.ppcId : property
    );

    // Ensure only valid numbers are passed
    const validPpcIds = ppcIds.filter((id) => typeof id === "number");

    if (validPpcIds.length === 0) {
      return res.status(404).json({ message: "No valid property IDs found" });
    }

    // Fetch property details
    const properties = await AddModel.find(
      { ppcId: { $in: validPpcIds } },  // ✅ Use only valid numeric IDs
      "ppcId price propertyType propertyMode city area postedBy totalArea areaUnit ownership phoneNumber"
    );

    return res.status(200).json({
      message: "Viewed properties retrieved successfully",
      phoneNumber,
      properties,
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});


router.put("/undo-delete-view", async (req, res) => {
  const { ppcId, phoneNumber } = req.body;

  if (!ppcId || !phoneNumber) {
    return res.status(400).json({ message: "ppcId and phoneNumber are required." });
  }

  try {
    const updatedUser = await UserViewsModel.findOneAndUpdate(
      { phoneNumber, "viewedProperties.ppcId": ppcId },
      { $set: { "viewedProperties.$.status": "active" } }, // Restore by changing status
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "Property not found for this user." });
    }

    res.status(200).json({ message: "Property restored successfully!", updatedUser });
  } catch (error) {
    res.status(500).json({ message: "Error restoring property.", error: error.message });
  }
});



// ✅ Soft Delete Property (Move to Removed Tab)
router.put("/delete-view-property", async (req, res) => {
  const { ppcId, phoneNumber } = req.body;

  if (!ppcId || !phoneNumber) {
    return res.status(400).json({ message: "ppcId and phoneNumber are required." });
  }

  try {
    const updatedUser = await UserViewsModel.findOneAndUpdate(
      { phoneNumber, "viewedProperties.ppcId": ppcId },
      { $set: { "viewedProperties.$.status": "delete" } }, // Soft delete by updating status
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "Property not found for this user." });
    }

    res.status(200).json({ message: "Property removed successfully.", updatedUser });
  } catch (error) {
    res.status(500).json({ message: "Error removing property.", error: error.message });
  }
});


router.get("/property-buyer-viewed", async (req, res) => {
  let { phoneNumber } = req.query;

  if (!phoneNumber) {
    return res.status(400).json({ message: "Owner phone number is required" });
  }

  // Normalize phone number and check different possible formats
  const normalizedPhone = phoneNumber.replace(/\s+/g, "").replace("+", "");
  const possibleNumbers = [
    normalizedPhone,
    "+" + normalizedPhone,
    normalizedPhone.replace(/^91/, ""),
  ];


  try {
    // Fetch all properties posted by the owner
    const ownerProperties = await AddModel.find({ phoneNumber: { $in: possibleNumbers } });

    if (!ownerProperties.length) {
      return res.status(404).json({ message: "No properties found for this owner" });
    }

    // Extract all PPC IDs
    const ownerPpcIds = ownerProperties.map((property) => property.ppcId);

    // Fetch users who viewed these properties
    const viewedUsers = await UserViewsModel.find({ "viewedProperties.ppcId": { $in: ownerPpcIds } });

    if (!viewedUsers.length) {
      return res.status(404).json({ message: "No viewed users found for this owner" });
    }


    // Fetch full property details
    const propertyDetails = await AddModel.find({ ppcId: { $in: ownerPpcIds } });

    // Convert property details into a Map for quick lookup
    const propertyMap = new Map();
    propertyDetails.forEach((property) => {
      propertyMap.set(property.ppcId, property.toObject()); // Convert Mongoose doc to plain object
    });

    // Organizing response data
    const response = viewedUsers.map((user) => ({
      viewerPhoneNumber: user.phoneNumber,
      viewedProperties: user.viewedProperties
        .filter((vp) => ownerPpcIds.includes(vp.ppcId)) // Ensure only relevant properties are included
        .map((vp) => ({
          ppcId: vp.ppcId,
          propertyOwnerPhoneNumber: vp.propertyOwnerPhoneNumber,
          viewedAt: vp.viewedAt,
          _id: vp._id,
          propertyDetails: propertyMap.get(vp.ppcId) || null, // Attach full property details
        })),
    }));

    return res.status(200).json({
      message: "Viewed users retrieved successfully",
      ownerPhoneNumber: normalizedPhone,
      viewedUsers: response,
    });

  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});



router.post(
  '/update-property',
  upload.fields([{ name: 'video', maxCount: 1 }, { name: 'photos', maxCount: 15 }]),
  async (req, res) => {
    if (req.fileValidationError) {
      return res.status(400).json({ message: req.fileValidationError });
    }
    if (req.files['video'] && req.files['video'][0].size > 50 * 1024 * 1024) {
      return res.status(400).json({ message: 'Video file size exceeds 50MB.' });
    }

    const {
      ppcId,
      phoneNumber,
      price,
      rentalPropertyAddress,
      state,
      city,
      district,
      area,
      streetName,
      doorNumber,
      nagar,
      ownerName,
      email,
      alternatePhone,
      countryCode,
      alternateCountryCode,
      propertyMode,
      propertyType,
      bankLoan,
      negotiation,
      ownership,
      bedrooms,
      kitchen,
      kitchenType,
      balconies,
      floorNo,
      areaUnit,
      propertyApproved,
      propertyAge,
      postedBy,
      facing,
      salesMode,
      salesType,
      furnished,
      lift,
      attachedBathrooms,
      western,
      numberOfFloors,
      carParking,
      bestTimeToCall,
      totalArea,
      length,
      breadth,
    } = req.body;

    if (!ppcId) {
      return res.status(400).json({ message: 'PPC-ID is required.' });
    }

    try {
      const user = await AddModel.findOne({ ppcId });
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      // Update fields dynamically
      const fieldsToUpdate = {
        phoneNumber, price, rentalPropertyAddress, state, city, district, area, 
        streetName, doorNumber, nagar, ownerName, email, alternatePhone, countryCode, 
        alternateCountryCode, propertyMode, propertyType, bankLoan, negotiation, ownership, 
        bedrooms, kitchen, kitchenType, balconies, floorNo, areaUnit, propertyApproved, 
        propertyAge, postedBy, facing, salesMode, salesType, furnished, lift, 
        attachedBathrooms, western, numberOfFloors, carParking, bestTimeToCall, totalArea,
        length, breadth,
      };

      for (const key in fieldsToUpdate) {
        if (fieldsToUpdate[key]) {
          user[key] = fieldsToUpdate[key];
        }
      }

      // Handle file uploads
      if (req.files) {
        if (req.files['video']) {
          user.video = req.files['video'][0].path;
        }
        if (req.files['photos']) {
          user.photos = req.files['photos'].map((file) => file.path);
        }
      }

      // Required fields to check for "complete" status
      const requiredFields = [
        'ppcId',
        'phoneNumber',
        'price',
        'propertyMode',
        'propertyType',
        'areaUnit',
        'salesType',
        'totalArea',
        'postedBy',
      ];
      

      const isComplete = requiredFields.every((field) => user[field]);
      user.status = isComplete ? 'complete' : 'incomplete';

      await user.save();

      // Save notification
      try {
        await NotificationUser.create({
          recipientPhoneNumber: user.phoneNumber,
          senderPhoneNumber: user.phoneNumber,
          userPhoneNumber: user.phoneNumber,
          ppcId: user.ppcId,
          type: 'property-Add',
          message: `Your property (${user.ppcId}) has been Added successfully.`,
          createdAt: new Date(),
        });
      } catch (notifErr) {
        console.error('Notification creation failed:', notifErr.message);
      }

      res.status(200).json({
        message: 'Property details updated successfully!',
        ppcId: user.ppcId,
        propertyStatus: user.status,
        user,
      });
    } catch (error) {
      res.status(500).json({ message: 'Error updating property details.', error });
    }
  }
);

// router.post(
//   '/update-property',
//   upload.fields([{ name: 'video', maxCount: 1 }, { name: 'photos', maxCount: 15 }]),
//   async (req, res) => {
//     if (req.fileValidationError) {
//       return res.status(400).json({ message: req.fileValidationError });
//     }
//     if (req.files['video'] && req.files['video'][0].size > 50 * 1024 * 1024) {
//       return res.status(400).json({ message: 'Video file size exceeds 50MB.' });
//     }

//     const {
//       ppcId,
//       phoneNumber,
//       price,
//       rentalPropertyAddress,
//       state,
//       city,
//       district,
//       area,
//       streetName,
//       doorNumber,
//       nagar,
//       ownerName,
//       email,
//       alternatePhone,
//       countryCode,
//       alternateCountryCode,
//       propertyMode,
//       propertyType,
//       bankLoan,
//       negotiation,
//       ownership,
//       bedrooms,
//       kitchen,
//       kitchenType,
//       balconies,
//       floorNo,
//       areaUnit,
//       propertyApproved,
//       propertyAge,
//       postedBy,
//       facing,
//       salesMode,
//       salesType,
//       furnished,
//       lift,
//       attachedBathrooms,
//       western,
//       numberOfFloors,
//       carParking,
//       bestTimeToCall,
//       totalArea,
//       length,
//       breadth,
//     } = req.body;

//     if (!ppcId) {
//       return res.status(400).json({ message: 'PPC-ID is required.' });
//     }

//     try {
//       const user = await AddModel.findOne({ ppcId });
//       if (!user) {
//         return res.status(404).json({ message: 'User not found.' });
//       }

//       // Update user fields dynamically
//       const fieldsToUpdate = {
//         phoneNumber, price, rentalPropertyAddress, state, city, district, area, 
//         streetName, doorNumber, nagar, ownerName, email, alternatePhone, countryCode, 
//         alternateCountryCode, propertyMode, propertyType, bankLoan, negotiation, ownership, 
//         bedrooms, kitchen, kitchenType, balconies, floorNo, areaUnit, propertyApproved, 
//         propertyAge, postedBy, facing, salesMode, salesType, furnished, lift, 
//         attachedBathrooms, western, numberOfFloors, carParking, bestTimeToCall, totalArea,
//         length,
//         breadth,
//       };

//       for (const key in fieldsToUpdate) {
//         if (fieldsToUpdate[key]) {
//           user[key] = fieldsToUpdate[key];
//         }
//       }

//       // Handle file uploads
//       if (req.files) {
//         if (req.files['video']) {
//           user.video = req.files['video'][0].path;
//         }
//         if (req.files['photos']) {
//           user.photos = req.files['photos'].map((file) => file.path);
//         }
//       }

//       // Check if all required fields are filled
//       const requiredFields = [
//         'ppcId','phoneNumber', 'price',     'propertyMode',
//         'propertyType',   'areaUnit',
//          'salesMode', 'salesType',
//          'totalArea',
       
//       ];


//       const isComplete = requiredFields.every((field) => user[field]);
//       user.status = isComplete ? "complete" : "incomplete"; 
      

//       await user.save();

//       // Save notification when property is updated
// try {
//   const notification = await NotificationUser.create({
//     recipientPhoneNumber: user.phoneNumber,
//     senderPhoneNumber: user.phoneNumber,
//     userPhoneNumber: user.phoneNumber,
//     ppcId: user.ppcId,
//     type: "property-Add",
//     message: `Your property (${user.ppcId}) has been Added successfully.`,
//     createdAt: new Date()
//   });

// } catch (notifErr) {
// }

//       res.status(200).json({
//         message: 'Property details updated successfully!',
//         ppcId: user.ppcId,
//         propertyStatus: user.propertyStatus,
//         user,
//       });
//     } catch (error) {
//       res.status(500).json({ message: 'Error updating property details.', error });
//     }
//   }
// );




router.get('/fetch-property-dropdowns', async (req, res) => {
  try {
    const [ propertyTypes] = await Promise.all([
      AddModel.distinct('propertyType', { propertyType: { $ne: null } })
    ]);

    res.status(200).json({
      message: 'Property dropdown values fetched successfully',
      propertyModes,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching dropdown values',
      error: error.message,
    });
  }
});




router.post('/add-property', upload.fields([{ name: 'video', maxCount: 1 }, { name: 'photos', maxCount: 5 }]), async (req, res) => {
  try {
      // Access the uploaded files
      const video = req.files && req.files.video ? req.files.video[0].path : '';  // Handle video file
      const photos = req.files && req.files.photos ? req.files.photos.map(file => file.path) : [];  // Handle photo files

      // Create a new property object
      const newProperty = new AddModel({
          phoneNumber: req.body.phoneNumber,
          price:req.body.price,
          rentalPropertyAddress: req.body.rentalPropertyAddress,
          state: req.body.state,
          city: req.body.city,
          district: req.body.district,
          area: req.body.area,
          streetName: req.body.streetName,
          doorNumber: req.body.doorNumber,
          nagar: req.body.nagar,
          ownerName: req.body.ownerName,
          email: req.body.email,
          alternatePhone: req.body.alternatePhone,
          video: video,  // Save the video file path
          photos: photos,  // Save photo file paths
          countryCode: req.body.countryCode,
          alternateCountryCode:req.body.alternateCountryCode,
          propertyMode: req.body.propertyMode,
          propertyType: req.body.propertyType,
          bankLoan: req.body.bankLoan,
          negotiation: req.body.negotiation,
          ownership: req.body.ownership,
          bedrooms: req.body.bedrooms,
          kitchen: req.body.kitchen,
          kitchenType: req.body.kitchenType,
          balconies: req.body.balconies,
          floorNo: req.body.floorNo,
          areaUnit: req.body.areaUnit,
          propertyApproved: req.body.propertyApproved,
          propertyAge: req.body.propertyAge,
          postedBy: req.body.postedBy,
          facing: req.body.facing,
          salesMode: req.body.salesMode,
          salesType: req.body.salesType,
          furnished: req.body.furnished,
          lift: req.body.lift,
          attachedBathrooms: req.body.attachedBathrooms,
          western: req.body.western,
          numberOfFloors: req.body.numberOfFloors,
      });

      // Save the new property to the database
      await newProperty.save();
      res.status(200).json({ message: 'Property added successfully', property: newProperty });
  } catch (error) {
      res.status(500).json({ message: 'Error adding property', error: error.message });
  }
});


// -----------------

// Fetch all properties count
router.get('/all-properties-count', async (req, res) => {
  try {
      const count = await AddModel.countDocuments();
      res.json({ totalProperties: count });
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});


router.get('/deleted-properties-count', async (req, res) => {
  try {
    // Count the documents with status "delete"
    const count = await AddModel.countDocuments({ status: "delete" });

    // Check if the count is being returned as expected
    if (count >= 0) {
      res.json({ deletedProperties: count });
    } else {
      res.status(404).json({ message: "No deleted properties found" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// router.get('/pending-properties-count', async (req, res) => {
//   try {
//     // Count the documents with status "pending"
//     const count = await AddModel.countDocuments({ status: "pending" });

//     // Send the count as response
//     res.json({ pendingProperties: count });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });


// GET: Count of pending properties
router.get("/pending-properties-count", async (req, res) => {
  try {
    // Count documents where status is 'pending' or 'incomplete'
    const count = await AddModel.countDocuments({
      status: { $in: ["pending","complete"] } // <-- Adjust this based on your business logic
    });

    res.status(200).json({ pendingProperties: count });
  } catch (error) {
    console.error("Error counting pending properties:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});



// Fetch interest buyer count
router.get('/interest-buyers-count/:phoneNumber', async (req, res) => {
  try {
      const { phoneNumber } = req.params;
      
      // Fetch all documents where the user is in interestRequests
      const properties = await AddModel.find({ 'interestRequests.phoneNumber': phoneNumber });

      // Count the exact number of occurrences of the user's phone number
      const count = properties.reduce((total, property) => {
          return total + (property.interestRequests?.filter(req => req.phoneNumber === phoneNumber).length || 0);
      }, 0);

      res.json({ interestBuyersCount: count });
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});

router.get("/property-owner-viewed-users-count", async (req, res) => {
  let { phoneNumber } = req.query;

  if (!phoneNumber) {
    return res.status(400).json({ message: "User phone number is required" });
  }

  phoneNumber = phoneNumber.replace(/\s+/g, "").replace("+", "");

  try {
    // Fetch user views
    const userViews = await UserViewsModel.findOne({ phoneNumber });

    if (!userViews || !userViews.viewedProperties?.length) {
      return res.status(200).json({ viewedPropertiesCount: 0 });
    }

    // Extract only valid ppcId values
    const validPpcIds = userViews.viewedProperties
      .map((property) => (typeof property === "object" && property !== null ? property.ppcId : property))
      .filter((id) => typeof id === "number");

    return res.status(200).json({ viewedPropertiesCount: validPpcIds.length });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});


router.get("/property-buyer-viewed-count", async (req, res) => {
  let { phoneNumber } = req.query;

  if (!phoneNumber) {
    return res.status(400).json({ message: "Owner phone number is required" });
  }

  const normalizedPhone = phoneNumber.replace(/\s+/g, "").replace("+", "");
  const possibleNumbers = [
    normalizedPhone,
    "+" + normalizedPhone,
    normalizedPhone.replace(/^91/, ""),
  ];

  try {
    // Find properties owned by the user
    const ownerProperties = await AddModel.find({ phoneNumber: { $in: possibleNumbers } });

    if (!ownerProperties.length) {
      return res.status(200).json({ buyerViewedCount: 0 });
    }

    const ownerPpcIds = ownerProperties.map((property) => property.ppcId);

    // Find the number of distinct users who viewed any of these properties
    const viewedUsersCount = await UserViewsModel.countDocuments({
      "viewedProperties.ppcId": { $in: ownerPpcIds },
    });

    return res.status(200).json({ buyerViewedCount: viewedUsersCount });

  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});



router.get('/get-interest-sent-count', async (req, res) => {
  const { phoneNumber } = req.query;

  if (!phoneNumber) {
    return res.status(400).json({ success: false, message: 'Phone number is required.' });
  }

  try {
    const normalizedPhone = phoneNumber.replace(/\s/g, "");

    // Find all properties where this number appears in interestRequests or interestedUserPhoneNumbers
    const properties = await AddModel.find({
      $or: [
        { 'interestRequests.phoneNumber': { $regex: normalizedPhone, $options: "i" } },
        { interestedUserPhoneNumbers: { $in: [normalizedPhone] } }
      ]
    });

    const ppcIds = properties.map(p => p.ppcId).filter(Boolean);
    const uniquePpcIds = [...new Set(ppcIds)];

    return res.status(200).json({
      success: true,
      interestSentCount: uniquePpcIds.length,
      interestedPpcIds: uniquePpcIds
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message
    });
  }
});


router.get('/get-help-as-buyer-count', async (req, res) => {
  try {
      let { postedPhoneNumber } = req.query;

      if (!postedPhoneNumber) {
          return res.status(400).json({ message: 'Posted user phone number is required.' });
      }

      // Normalize phone number format
      postedPhoneNumber = postedPhoneNumber.replace(/\D/g, '');
      if (postedPhoneNumber.startsWith('91') && postedPhoneNumber.length === 12) {
          postedPhoneNumber = postedPhoneNumber.slice(2);
      }

      // Find properties where help requests exist
      const properties = await AddModel.find({
          $or: [
              { phoneNumber: postedPhoneNumber },
              { phoneNumber: `+91${postedPhoneNumber}` },
              { phoneNumber: `91${postedPhoneNumber}` }
          ]
      });

      if (properties.length === 0) {
          return res.status(200).json({ helpRequestsCount: 0 });
      }

      // Count total number of help requests
      const helpRequestsCount = properties.reduce((total, property) => {
          return total + (property.helpRequests?.filter(req => req.phoneNumber).length || 0);
      }, 0);

      return res.status(200).json({ helpRequestsCount });

  } catch (error) {
      return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});


router.get('/get-contact-buyer-count', async (req, res) => {
  try {
      let { postedPhoneNumber } = req.query;

      if (!postedPhoneNumber) {
          return res.status(400).json({ message: "Posted user phone number is required." });
      }

      // Normalize phone number format
      postedPhoneNumber = postedPhoneNumber.replace(/\D/g, ""); // Remove non-numeric characters
      if (postedPhoneNumber.startsWith("91") && postedPhoneNumber.length === 12) {
          postedPhoneNumber = postedPhoneNumber.slice(2);
      }

      // Find properties where contact requests exist
      const properties = await AddModel.find({
          $or: [
              { phoneNumber: postedPhoneNumber },
              { phoneNumber: `+91${postedPhoneNumber}` },
              { phoneNumber: `91${postedPhoneNumber}` }
          ]
      });

      if (properties.length === 0) {
          return res.status(200).json({ contactBuyerCount: 0 });
      }

      // Count total number of contact requests
      const contactBuyerCount = properties.reduce((total, property) => {
          return total + (property.contactRequests?.filter(req => req.phoneNumber).length || 0);
      }, 0);

      return res.status(200).json({ contactBuyerCount });

  } catch (error) {
      return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

router.get('/get-help-as-owner-count', async (req, res) => {
  const { phoneNumber } = req.query;

  if (!phoneNumber) {
    return res.status(400).json({ success: false, message: 'Phone number is required.' });
  }

  try {
    const cleanPhone = phoneNumber.trim().replace(/[^+\d]/g, ''); // Normalize phone number

    // Find properties where helpRequests contain this phoneNumber
    const properties = await AddModel.find({
      'helpRequests.phoneNumber': {
        $regex: cleanPhone,
        $options: 'i'
      }
    });

    return res.status(200).json({
      success: true,
      helpPropertiesCount: properties.length,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message
    });
  }
});


router.get('/get-contact-owner-count', async (req, res) => {
  const { phoneNumber } = req.query;

  if (!phoneNumber) {
    return res.status(400).json({ success: false, message: 'Phone number is required.' });
  }

  try {
    // Normalize the phone number (remove non-digits and symbols)
    const cleanPhone = phoneNumber.trim().replace(/[^+\d]/g, '');
    const regex = new RegExp(`${cleanPhone}$`, 'i'); // Match if phone number ends with these digits

    // Fetch properties where someone requested contact with this phone number
    const properties = await AddModel.find({
      'contactRequests.phoneNumber': { $regex: regex }
    });

    if (!properties.length) {
      return res.status(200).json({ success: true, contactOwnersCount: 0, owners: [] });
    }

    // Extract and count unique property owners who received requests
    const uniqueOwners = new Set(properties.map(p => p.phoneNumber));

    return res.status(200).json({
      success: true,
      contactOwnersCount: uniqueOwners.size,
      owners: Array.from(uniqueOwners)
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message
    });
  }
});


// ✅ Fetch Reported Property Requests Count
router.get('/get-reportproperty-buyer-count', async (req, res) => {
  try {
      let { postedPhoneNumber } = req.query;

      if (!postedPhoneNumber) {
          return res.status(400).json({ message: 'Posted user phone number is required.' });
      }

      // Normalize phone number format
      postedPhoneNumber = postedPhoneNumber.replace(/\D/g, '');
      if (postedPhoneNumber.startsWith('91') && postedPhoneNumber.length === 12) {
          postedPhoneNumber = postedPhoneNumber.slice(2);
      }

      // Find properties related to the posted phone number
      const properties = await AddModel.find({
          $or: [
              { phoneNumber: postedPhoneNumber },
              { phoneNumber: `+91${postedPhoneNumber}` },
              { phoneNumber: `91${postedPhoneNumber}` }
          ]
      });

      if (properties.length === 0) {
          return res.status(200).json({ reportRequestsCount: 0 });
      }

      // Count total number of report requests
      const reportRequestsCount = properties.reduce((total, property) => {
          return total + (property.reportProperty?.filter(req => req.phoneNumber).length || 0);
      }, 0);

      return res.status(200).json({ reportRequestsCount });

  } catch (error) {
      return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});


router.get('/get-reportproperty-owner-count', async (req, res) => {
  const { phoneNumber } = req.query;

  if (!phoneNumber) {
    return res.status(400).json({ success: false, message: 'Phone number is required.' });
  }

  try {
    const cleanPhone = phoneNumber.trim().replace(/[^+\d]/g, '');
    const regex = new RegExp(`${cleanPhone}$`, 'i'); // Match end of number (handles 3 formats)

    // Find all properties where the user is in the reportProperty array
    const properties = await AddModel.find({
      'reportProperty.phoneNumber': { $regex: regex }
    });

    // 🔢 Count based on unique ppcIds
    const uniquePpcIds = new Set(properties.map(p => p.ppcId));

    return res.status(200).json({
      success: true,
      reportPropertyOwnersCount: uniquePpcIds.size,
      ppcIds: Array.from(uniquePpcIds) // optional debug info
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message
    });
  }
});


// ✅ Fetch Sold-Out Requests Count
router.get('/get-soldout-buyer-count', async (req, res) => {
  try {
      let { postedPhoneNumber } = req.query;

      if (!postedPhoneNumber) {
          return res.status(400).json({ message: 'Posted user phone number is required.' });
      }

      // Normalize phone number format
      postedPhoneNumber = postedPhoneNumber.replace(/\D/g, '');
      if (postedPhoneNumber.startsWith('91') && postedPhoneNumber.length === 12) {
          postedPhoneNumber = postedPhoneNumber.slice(2);
      }

      // Find properties related to the posted phone number
      const properties = await AddModel.find({
          $or: [
              { phoneNumber: postedPhoneNumber },
              { phoneNumber: `+91${postedPhoneNumber}` },
              { phoneNumber: `91${postedPhoneNumber}` }
          ]
      });

      if (properties.length === 0) {
          return res.status(200).json({ soldOutRequestsCount: 0 });
      }

      // Count total number of sold-out requests
      const soldOutRequestsCount = properties.reduce((total, property) => {
          return total + (property.soldOutReport?.filter(req => req.phoneNumber).length || 0);
      }, 0);

      return res.status(200).json({ soldOutRequestsCount });

  } catch (error) {
      return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});


router.get('/get-soldout-owner-count', async (req, res) => {
  const { phoneNumber } = req.query;

  if (!phoneNumber) {
    return res.status(400).json({ success: false, message: 'Phone number is required.' });
  }

  try {
    const cleanPhone = phoneNumber.trim().replace(/[^+\d]/g, ''); // Normalize phone number

    // Fetch all properties where the user has reported sold-out
    const properties = await AddModel.find({
      'soldOutReport.phoneNumber': { $regex: cleanPhone, $options: 'i' }
    });

    // 🧠 Extract unique PPC IDs (safety against duplicates)
    const uniquePpcIds = new Set(properties.map(p => p.ppcId));

    return res.status(200).json({
      success: true,
      soldOutOwnersCount: uniquePpcIds.size,
      ppcIds: Array.from(uniquePpcIds) // Optional, for debug
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
});

// ✅ Fetch Favorite Requests Count
router.get("/get-favorite-buyer-count", async (req, res) => {
  try {
      let { postedPhoneNumber } = req.query;

      if (!postedPhoneNumber) {
          return res.status(400).json({ message: "Posted user phone number is required." });
      }

      // Normalize phone number format
      postedPhoneNumber = postedPhoneNumber.replace(/\D/g, "");
      if (postedPhoneNumber.startsWith("91") && postedPhoneNumber.length === 12) {
          postedPhoneNumber = postedPhoneNumber.slice(2);
      }

      // Find properties related to the posted phone number
      const properties = await AddModel.find({
          $or: [
              { phoneNumber: postedPhoneNumber },
              { phoneNumber: `+91${postedPhoneNumber}` },
              { phoneNumber: `91${postedPhoneNumber}` }
          ]
      });

      if (properties.length === 0) {
          return res.status(200).json({ favoriteRequestsCount: 0 });
      }

      // Count total number of favorite requests
      const favoriteRequestsCount = properties.reduce((total, property) => {
          return total + (property.favoriteRequests?.filter(req => req.phoneNumber).length || 0);
      }, 0);

      return res.status(200).json({ favoriteRequestsCount });

  } catch (error) {
      return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});


router.get('/get-favorite-owner-count', async (req, res) => {
  try {
    let { phoneNumber } = req.query;

    if (!phoneNumber) {
      return res.status(400).json({ message: "Owner's phone number is required." });
    }

    // Normalize phone number (last 10 digits)
    const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10);
    const regex = new RegExp(`${cleanPhone}$`, 'i');

    // Find properties owned by this user (any format)
    const properties = await AddModel.find({
      phoneNumber: { $regex: regex }
    });

    if (properties.length === 0) {
      return res.status(200).json({ favoriteOwnerCount: 0 });
    }

    // Count total favorite requests (by unique ppcIds)
    const uniquePpcIds = new Set();

    properties.forEach(property => {
      if (property.favoriteRequests?.some(req => req.phoneNumber)) {
        uniquePpcIds.add(property.ppcId);
      }
    });

    return res.status(200).json({
      message: "Favorite owner count fetched successfully.",
      favoriteOwnerCount: uniquePpcIds.size,
      ppcIds: Array.from(uniquePpcIds) // optional
    });

  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});
router.get('/get-favorite-removed-owner-count', async (req, res) => {
  try {
    let { phoneNumber } = req.query;

    if (!phoneNumber) {
      return res.status(400).json({ message: "Owner's phone number is required." });
    }

    // Normalize: extract last 10 digits from any format
    const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10);
    const regex = new RegExp(`${cleanPhone}$`, 'i'); // match end of string

    // Find all properties posted by this owner (in any of 3 phone formats)
    const properties = await AddModel.find({
      phoneNumber: { $regex: regex }
    });

    if (!properties.length) {
      return res.status(200).json({ favoriteRemovedOwnerCount: 0 });
    }

    // Count how many of these properties have favoriteRemoved entries
    const favoriteRemovedOwnerCount = properties.reduce((count, property) => {
      const hasRemoved = Array.isArray(property.favoriteRemoved) &&
                         property.favoriteRemoved.some(req => req.phoneNumber);
      return hasRemoved ? count + 1 : count;
    }, 0);

    return res.status(200).json({
      message: "Favorite removed owner count fetched successfully.",
      favoriteRemovedOwnerCount
    });

  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});


// ----------------

router.delete('/delete-viewed-property/:ppcId', async (req, res) => {
  const { ppcId } = req.params;

  if (!ppcId) {
    return res.status(400).json({ message: "Property ID is required" });
  }

  try {
    // Find all users who have viewed this property
    const users = await UserViewsModel.find({ "viewedProperties.ppcId": ppcId });

    if (!users.length) {
      return res.status(404).json({ message: "Viewed property not found" });
    }

    // Remove the viewed property from all users' viewedProperties array
    await UserViewsModel.updateMany(
      { "viewedProperties.ppcId": ppcId },
      { $pull: { viewedProperties: { ppcId } } }
    );

    // Optionally, decrement view count in AddModel
    await AddModel.updateOne({ ppcId }, { $inc: { views: -users.length } });

    return res.status(200).json({ message: "Viewed property deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});


// Route to get all property data
router.get('/properties', async (req, res) => {
  try {
    const properties = await AddModel.find(); // Get all properties
    res.status(200).json(properties); // Return the properties as JSON
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve properties', message: err.message });
  }
});



router.get('/uploads-count', async (req, res) => {
  const { ppcId } = req.query; // Use query params to pass ppcId

  // Ensure `ppcId` is provided
  if (!ppcId) {
    return res.status(400).json({ message: 'Property ID (ppcId) is required' });
  }

  try {
    // Find the property by `ppcId`
    const property = await AddModel.findOne({ ppcId });

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // Count the number of uploaded images
    const uploadedImagesCount = property.photos ? property.photos.length : 0;

    return res.status(200).json({
      message: 'Uploaded images count retrieved successfully',
      uploadedImagesCount,
      uploadedImages: property.photos || [], // Return the array of uploaded image filenames
    });
  } catch (error) {
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});


router.get('/latest-ppcid', async (req, res) => {
    try {
        const latestProperty = await AddModel.findOne().sort({ ppcId: -1 });
        res.json({ latestPpcId: latestProperty ? latestProperty.ppcId : null });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching latest ppcId', error });
    }
});


router.post("/store-id", async (req, res) => {
  try {

    const latestProperty = await AddModel.findOne().sort({ ppcId: -1 });

    const nextPpcId = latestProperty ? latestProperty.ppcId + 1 : 1001;

    const newUser = new AddModel({ ppcId: nextPpcId });
    const savedUser = await newUser.save();

    res.status(201).json({ message: "PPC-ID created and stored successfully!", ppcId: nextPpcId });
  } catch (error) {
    res.status(500).json({ message: "Error storing PPC-ID.", error });
  }
});


router.get('/get-latest-ppcid', async (req, res) => {
  try {
    const latestProperty = await AddModel.findOne().sort({ ppcId: -1 }); // Get latest PPC-ID

    if (latestProperty) {
      res.status(200).json({ ppcId: latestProperty.ppcId  });
    } else {
      res.status(404).json({ message: "No PPC-ID found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error fetching PPC-ID", error });
  }
});



router.put('/update-property-status', async (req, res) => {
  const { ppcId, status } = req.body;

  if (!ppcId || !status) {
    return res.status(400).json({ message: 'PPC ID and status are required.' });
  }

  try {
    const updatedProperty = await AddModel.findOneAndUpdate(
      { ppcId },
      { status },
      { new: true }
    );

    if (!updatedProperty) {
      return res.status(404).json({ message: 'Property not found.' });
    }

    res.status(200).json({ message: 'Status updated successfully.', updatedProperty });
  } catch (error) {
    res.status(500).json({ message: 'Error updating property status.', error });
  }
});



router.get('/property-views/:ppcId', async (req, res) => {
  const { ppcId } = req.params;

  if (!ppcId) {
      return res.status(400).json({ message: 'Property ID is required' });
  }

  try {
      // Increment the views field and retrieve the updated document
      const property = await AddModel.findOneAndUpdate(
          { ppcId }, 
          { $inc: { views: 1 } }, // Increment the views by 1
          { new: true } // Return the updated document
      );

      if (!property) {
          return res.status(404).json({ message: 'Property not found' });
      }

      return res.status(200).json({
          message: 'Property view count incremented successfully',
          ppcId: property.ppcId,
          views: property.views, // Return the updated view count
      });
  } catch (error) {
      return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});


router.get('/zero-view-properties', async (req, res) => {
  try {
      const properties = await AddModel.find({ views: { $eq: 0 } });

      if (properties.length === 0) {
          return res.status(404).json({ message: 'No properties with zero views found' });
      }

      return res.status(200).json({
          message: 'Properties with zero views retrieved successfully',
          properties,
      });
  } catch (error) {
      return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});

router.get('/zero-view-properties-count', async (req, res) => {
  try {
    const count = await AddModel.countDocuments({ views: { $eq: 0 } });

    res.status(200).json({
      message: 'Zero viewed property count fetched successfully',
      count,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching zero viewed property count',
      error: error.message,
    });
  }
});


router.delete('/delete-viewed-property/:ppcId', async (req, res) => {
  const { ppcId } = req.params;

  try {
    const deletedProperty = await AddModel.findOneAndDelete({ ppcId, views: { $eq: 0 } });

    if (!deletedProperty) {
      return res.status(404).json({ message: "Property not found or has views" });
    }

    return res.status(200).json({ message: "Property deleted successfully", deletedProperty });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});



// Store new user data without PPC-ID
router.post('/store-phone', async (req, res) => {
    const { phoneNumber } = req.body;
  
    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required.' });
    }
  
    try {
  
      // Create new user with the provided phone number
      const newUser = new AddModel({ phoneNumber });
      await newUser.save();
  
      res.status(201).json({ message: 'User added successfully!' });
    } catch (error) {
      res.status(500).json({ message: 'Error storing user details.', error });
    }
  });
  



// Store new user data with PPC-ID
router.post('/store-data', async (req, res) => {
    const { phoneNumber } = req.body;
  
    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required.' });
    }
  
    try {
  
      // Count the total documents to generate a unique PPC-ID
      const count = await AddModel.countDocuments();
      const ppcId = 1001 + count;
  
      // Create new user with a new PPC-ID even if the phone number exists
      const newUser = new AddModel({ phoneNumber, ppcId });
      await newUser.save();
  
      res.status(201).json({ message: 'User added successfully!', ppcId });
    } catch (error) {
      res.status(500).json({ message: 'Error storing user details.', error });
    }
  });



  router.get('/fetch-datas', async (req, res) => {
    const { phoneNumber } = req.query;

    if (!phoneNumber) {
        return res.status(400).json({ message: 'Phone number is required.' });
    }

    try {
        // Normalize phone number
        const normalizedPhoneNumber = phoneNumber
            .replace(/[\s-]/g, '')
            .replace(/^(\+91|91|0)/, '') // Remove country code if any
            .trim();

        // Query to fetch only users with ppcId
        const query = { 
            phoneNumber: new RegExp(normalizedPhoneNumber + '$'),
            ppcId: { $exists: true } // Ensure ppcId exists
        };

        // Fetch all required fields
        const users = await AddModel.find(query, {
            ppcId: 1,
            phoneNumber: 1,
            propertyMode: 1,
            propertyType: 1,
            price: 1,
            propertyAge: 1,
            bankLoan: 1,
            negotiation: 1,
            length: 1,
            breadth: 1,
            totalArea: 1,
            ownership: 1,
            bedrooms: 1,
            kitchen: 1,
            kitchenType: 1,
            balconies: 1,
            floorNo: 1,
            areaUnit: 1,
            propertyApproved: 1,
            postedBy: 1,
            facing: 1,
            salesMode: 1,
            salesType: 1,
            description: 1,
            furnished: 1,
            lift: 1,
            attachedBathrooms: 1,
            western: 1,
            numberOfFloors: 1,
            carParking: 1,
            rentalPropertyAddress: 1,
            country: 1,
            state: 1,
            city: 1,
            district: 1,
            area: 1,
            streetName: 1,
            doorNumber: 1,
            nagar: 1,
            ownerName: 1,
            email: 1,
            alternatePhone: 1,
            bestTimeToCall: 1,
            _id: 0  // Exclude MongoDB _id field from response
        });

        if (!users || users.length === 0) {
            return res.status(404).json({ message: 'Users not found.' });
        }

        res.status(200).json({
            message: 'User data fetched successfully!',
            users
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user details.', error });
    }
});



router.get('/edit-property/:ppcId', async (req, res) => {
  const { ppcId } = req.params;  // ppcId from URL parameter

  try {
      // Find the property by PPC-ID
      const user = await AddModel.findOne({ ppcId });

      if (!user) {
          return res.status(404).json({ message: 'Property not found.' });
      }

      // Send the current property details to the client
      res.status(200).json({ user });
  } catch (error) {
      res.status(500).json({ message: 'Error fetching property details.', error });
  }
});





  router.post('/update-property-data', upload.fields([{ name: 'video', maxCount: 1 }, { name: 'photos', maxCount: 15 }]), async (req, res) => {
    // Check for multer errors
    if (req.fileValidationError) {
        return res.status(400).json({ message: req.fileValidationError });
    }
    if (req.files['video'] && req.files['video'][0].size > 50 * 1024 * 1024) {
        return res.status(400).json({ message: 'Video file size exceeds 50MB.' });
    }

    const {
        ppcId,
        phoneNumber,
        propertyMode,
        propertyType,
        price, 
    propertyAge,
    bankLoan,
    negotiation,
    length,
    breadth,
    totalArea,
    ownership,
    bedrooms,
    kitchen,
    kitchenType,
    balconies,
    floorNo,
    areaUnit,
    propertyApproved,
    postedBy,
    facing,
    salesMode,
    salesType,
    description,
    furnished,
    lift,
    attachedBathrooms,
    western,
    numberOfFloors,
    carParking,
    rentalPropertyAddress,
    country,
    state,
    city,
    district,
    area,
    streetName,
    doorNumber,
    nagar,
    ownerName,
    email,
    alternatePhone,
    bestTimeToCall
    } = req.body;

    if (!ppcId || !phoneNumber) {
        return res.status(400).json({ message: 'PPC-ID and phone number are required.' });
    }

    try {

        // Find the user by PPC-ID and phone number
        const user = await AddModel.findOne({ ppcId, phoneNumber });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Update the property details only if provided in the request
        if (propertyMode) user.propertyMode = propertyMode;
        if (propertyType) user.propertyType = propertyType;
        if (price) user.price = price;
        if (propertyAge) user.propertyAge = propertyAge;
        if (bankLoan) user.bankLoan = bankLoan;
        if (negotiation) user.negotiation = negotiation;
        if (length) user.length = length;
        if (breadth) user.breadth = breadth;
        if (totalArea) user.totalArea = totalArea;
        if (ownership) user.ownership = ownership;
        if (bedrooms) user.bedrooms = bedrooms;
        if (kitchen) user.kitchen = kitchen;
        if (kitchenType) user.kitchenType = kitchenType;
        if (balconies) user.balconies = balconies;
        if (floorNo) user.floorNo = floorNo;
        if (areaUnit) user.areaUnit = areaUnit;
        if (propertyApproved) user.propertyApproved = propertyApproved;
        if (postedBy) user.postedBy = postedBy;
        if (facing) user.facing = facing;
        if (salesMode) user.salesMode = salesMode;
        if (salesType) user.salesType = salesType;
        if (description) user.description = description;
        if (furnished) user.furnished = furnished;
        if (lift) user.lift = lift;
        if (attachedBathrooms) user.attachedBathrooms = attachedBathrooms;
        if (western) user.western = western;
        if (numberOfFloors) user.numberOfFloors = numberOfFloors;
        if (carParking) user.carParking = carParking;
        if(alternatePhone) user.alternatePhone = alternatePhone;
        
        // Address fields
        if (rentalPropertyAddress) user.rentalPropertyAddress = rentalPropertyAddress;
        if (country) user.country = country;
        if (state) user.state = state;
        if (city) user.city = city;
        if (district) user.district = district;
        if (area) user.area = area;
        if (streetName) user.streetName = streetName;
        if (doorNumber) user.doorNumber = doorNumber;
        if (nagar) user.nagar = nagar;
        if (ownerName) user.ownerName = ownerName;
        if (email) user.email = email;
        if (bestTimeToCall) user.bestTimeToCall = bestTimeToCall;

        // Handle video and photo updates
        if (req.files) {
            if (req.files['video']) {
                user.video = req.files['video'][0].path; // Save video path
            }

            if (req.files['photos']) {
                user.photos = req.files['photos'].map(file => file.path); // Save photo paths
            }
        }

        // Check if all required fields are filled
        const isComplete = [
            propertyMode, propertyType, price,
             propertyAge,
            bankLoan,
            negotiation,
            length,
            breadth,
            totalArea,
            ownership,
            bedrooms,
            kitchen,
            kitchenType, balconies, floorNo,
            areaUnit, propertyApproved, postedBy, facing, salesMode, salesType,
            description, furnished, lift, attachedBathrooms, western, numberOfFloors,
            carParking, rentalPropertyAddress, country, state, city, district,
            area, streetName, doorNumber, nagar, ownerName, email,alternatePhone, bestTimeToCall,
            req.files['photos'], req.files['video'] // Ensure photos and video are present
        ].every(field => field !== undefined && field !== '' && (Array.isArray(field) ? field.length > 0 : true));

        // Set status based on whether all required fields are filled
        user.status = isComplete ? 'complete' : 'incomplete';

        // Save updated user data
        await user.save();

        res.status(200).json({ message: 'Property details updated successfully!', user });
    } catch (error) {
        res.status(500).json({ message: 'Error updating property details.', error });
    }
});





router.get('/fetch-data', async (req, res) => {
    const { phoneNumber, ppcId } = req.query;

    // Ensure at least one parameter is provided
    if (!phoneNumber && !ppcId) {
        return res.status(400).json({ message: 'Either phone number or PPC-ID is required.' });
    }

    try {

        // Normalize phone number (remove spaces, dashes, country code, and ensure consistency)
        const normalizedPhoneNumber = phoneNumber
            ? phoneNumber.replace(/[\s-]/g, '').replace(/^(\+91|91|0)/, '').trim() // Remove country code, spaces, dashes
            : null;

        // Build query dynamically based on the provided parameters
        const query = {};
        if (normalizedPhoneNumber) query.phoneNumber = new RegExp(normalizedPhoneNumber + '$'); // Match phone number ending with the query
        if (ppcId) query.ppcId = ppcId;


        // Fetch user from the database
        const user = await AddModel.findOne(query);

        // Check if user exists
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json({ message: 'User data fetched successfully!', user });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user details.', error });
    }
});






// router.get('/fetch-all-datas', async (req, res) => {
//     try {

//         // Fetch all users from the database
//         const users = await AddModel.find({});

//         // Return the fetched user data
//         res.status(200).json({ message: 'All user data fetched successfully!', users });
//     } catch (error) {
//         res.status(500).json({ message: 'Error fetching all user details.', error });
//     }
// });


router.get('/fetch-all-datas', async (req, res) => {
  try {
    // Delete all "incomplete" entries from DB
    await AddModel.deleteMany({ status: 'incomplete' });

    // Fetch only "complete" entries
    const users = await AddModel.find({ status: 'complete' });

    res.status(200).json({
      message: 'Only complete user data fetched successfully!',
      users
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching user data.',
      error
    });
  }
});


// API to fetch distinct states from AddModel
router.get("/fetch-states", async (req, res) => {
  try {
    const states = await AddModel.distinct("state"); // Fetch unique state values
    res.json({ success: true, states });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error });
  }
});



// Fetch all properties
router.get("/fetch-all-properties", async (req, res) => {
  try {
    const properties = await AddModel.find();

    if (properties.length === 0) {
      return res.status(404).json({ success: false, message: "No properties found" });
    }

    res.json({ success: true, data: properties });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error });
  }
});

// // Fetch properties from Puducherry (Case-Insensitive)
// router.get("/fetch-Pudhucherry-properties", async (req, res) => {
//   try {
//     const pondicherryData = await AddModel.find({ 
//       state: { $regex: /^puducherry$/i }  // Case-insensitive match
//     });

//     if (pondicherryData.length === 0) {
//       return res.status(404).json({ success: false, message: "No data found for Puducherry" });
//     }

//     res.json({ success: true, data: pondicherryData });
//   } catch (error) {
//     res.status(500).json({ success: false, message: "Server error", error });
//   }
// });


// Fetch properties from all Puducherry variants (case-insensitive)
router.get("/fetch-Pudhucherry-properties", async (req, res) => {
  try {
    const pondicherryData = await AddModel.find({
      state: {
        $regex: /^(puducherry|pudhucherry|pondicherry|pondicherry town|pudhucherry town|pondi)$/i
      }
    });

    if (pondicherryData.length === 0) {
      return res.status(404).json({ success: false, message: "No data found for Puducherry" });
    }

    res.json({ success: true, data: pondicherryData });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error });
  }
});


// Route: GET /fetch-active-users
router.get('/fetch-active-users', async (req, res) => {
  try {
    // Fetch users with specific statuses
    const users = await AddModel.find({
      status: { $in: ['active'] }
    });

    // Respond with the fetched users
    res.status(200).json({
      message: 'Active and related status users fetched successfully!',
      users
    });

  } catch (error) {

    res.status(500).json({
      message: 'Error fetching users.',
      error: error.message || 'Unknown server error'
    });
  }
});

router.get('/fetch-all-complete-data', async (req, res) => {
  try {
      // Fetch all users with the status 'complete' from the database
      const users = await AddModel.find({ status: 'complete' });

      // Return the fetched user data
      res.status(200).json({ message: 'All complete user data fetched successfully!', users });
  } catch (error) {
      res.status(500).json({ message: 'Error fetching complete user details.', error });
  }
});




// Route: /get-deleted-properties
router.get('/get-deleted-properties-datas', async (req, res) => {
  try {
    const deletedData = await DeletedAddModel.find(); // or AddModel.find({ isDeleted: true })
    res.status(200).json({ deleted: deletedData });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch deleted properties.', error });
  }
});


router.delete('/delete-permenent-data', async (req, res) => {
  const { ppcId } = req.query;

  if (!ppcId) {
      return res.status(400).json({ message: 'PPC-ID is required.' });
  }

  try {
      // Delete user based on ppcId only
      const deletedUser = await DeletedAddModel.findOneAndDelete({ ppcId });

      if (!deletedUser) {
          return res.status(404).json({ message: 'User not found.' });
      }

      res.status(200).json({ message: 'User Permenent deleted successfully!', deletedUser });
  } catch (error) {
      res.status(500).json({ message: 'Error deleting user.', error });
  }
});


router.delete('/delete-ppcId-data', async (req, res) => {
  const { ppcId } = req.query;

  if (!ppcId) {
    return res.status(400).json({ message: 'PPC-ID is required.' });
  }

  try {
    // Find user first
    const userToDelete = await AddModel.findOne({ ppcId });
    if (!userToDelete) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Save the deleted data to DeletedAddModel
    await DeletedAddModel.create({
      ...userToDelete.toObject(),
      deletedAt: new Date(),
    });

    // Then delete from the original collection
    await AddModel.deleteOne({ ppcId });

    res.status(200).json({ message: 'User Permenent deleted successfully!', deletedUser: userToDelete });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ message: 'Error deleting user.', error });
  }
});


router.delete('/delete-data', async (req, res) => {
    const { phoneNumber, ppcId } = req.query;

    // Ensure at least one parameter is provided
    if (!phoneNumber && !ppcId) {
        return res.status(400).json({ message: 'Either phone number or PPC-ID is required.' });
    }

    try {

        // Normalize phone number (remove spaces, dashes, country code, and ensure consistency)
        const normalizedPhoneNumber = phoneNumber
            ? phoneNumber.replace(/[\s-]/g, '').replace(/^(\+91|91|0)/, '').trim() // Remove country code, spaces, dashes
            : null;

        // Build query dynamically based on the provided parameters
        const query = {};
        if (normalizedPhoneNumber) query.phoneNumber = new RegExp(normalizedPhoneNumber + '$'); // Match phone number ending with the query
        if (ppcId) query.ppcId = ppcId;


        // Delete user from the database
        const deletedUser = await AddModel.findOneAndDelete(query);

        // Check if user was found and deleted
        if (!deletedUser) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Return success response
        res.status(200).json({ message: 'User deleted successfully!', deletedUser });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting user.', error });
    }
});



router.put('/delete-datas', async (req, res) => {
  const { phoneNumber, ppcId } = req.query;

  if (!phoneNumber || !ppcId) {
      return res.status(400).json({ message: 'Both phone number and PPC-ID are required.' });
  }

  try {

      const query = { phoneNumber, ppcId };

      // Update status instead of deleting the record
      const updatedUser = await AddModel.findOneAndUpdate(
          query,
          { status: "delete" }, 
          { new: true }
      );

      if (!updatedUser) {
          return res.status(404).json({ message: 'User not found.' });
      }


      res.status(200).json({ message: 'User marked as deleted successfully!', updatedUser });
  } catch (error) {
      res.status(500).json({ message: 'Error updating user status.', error });
  }
});





router.get('/fetch-deleted-data', async (req, res) => {
  try {
      const deletedUsers = await AddModel.find({ status: "delete" });

      if (deletedUsers.length === 0) {
          return res.status(404).json({ message: "No deleted users found." });
      }

      res.status(200).json({ deletedUsers });
  } catch (error) {
      res.status(500).json({ message: "Error fetching deleted users.", error });
  }
});




// Temporary deletion
router.delete('/delete-temporary', async (req, res) => {
    const { phoneNumber, ppcId, reason } = req.query;

    // Ensure at least one parameter and reason are provided
    if (!phoneNumber && !ppcId) {
        return res.status(400).json({ message: 'Either phone number or PPC-ID is required.' });
    }

    if (!reason) {
        return res.status(400).json({ message: 'Reason for deletion is required.' });
    }

    try {

        // Normalize phone number (remove spaces, dashes, country code, and ensure consistency)
        const normalizedPhoneNumber = phoneNumber
            ? phoneNumber.replace(/[\s-]/g, '').replace(/^(\+91|91|0)/, '').trim() // Remove country code, spaces, dashes
            : null;

        // Build query dynamically based on the provided parameters
        const query = {};
        if (normalizedPhoneNumber) query.phoneNumber = new RegExp(normalizedPhoneNumber + '$'); // Match phone number ending with the query
        if (ppcId) query.ppcId = ppcId;


        // Find the user and update the deletion reason, time, and date
        const update = {
            isDeleted: true,
            deletionReason: reason,
            deletionDate: new Date(), // Store the current date and time
        };

        const updatedUser = await AddModel.findOneAndUpdate(query, update, { new: true });

        // Check if user was found and updated
        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found.' });
        }


        // Return success response with additional details
        res.status(200).json({
            message: 'User marked as deleted successfully!',
            timestamp: new Date().toISOString(),
            reason,
            deletedUser: {
                id: updatedUser._id,
                phoneNumber: updatedUser.phoneNumber,
                ppcId: updatedUser.ppcId,
                deletionReason: updatedUser.deletionReason,
                deletionDate: updatedUser.deletionDate,
            },
        });
    } catch (error) {
        res.status(500).json({ message: 'Error marking user as deleted.', error });
    }
});





// Undo delete property endpoint
router.post('/undo-delete', async (req, res) => {
    const { ppcId, phoneNumber } = req.body;
  
    try {
      // Find the property by its ppcId
      const property = await AddModel.findOne({ ppcId });
  
      if (!property) {
        return res.status(404).json({ message: 'Property not found.' });
      }
  
      property.status = 'incomplete'; 
      if (!property.interestRequests.some(request => request.phoneNumber === phoneNumber)) {
        property.interestRequests.push({ phoneNumber, date: new Date() });
      }
  
      await property.save();
  
      // Send the updated property as a response
      res.status(200).json({ message: 'Property status reverted successfully!', property });
    } catch (error) {
      res.status(500).json({ message: 'Error undoing property status.' });
    }
  });
  


// Delete property endpoint
router.post('/delete-property', async (req, res) => {
    const { ppcId, phoneNumber } = req.body;
  
    try {
      // Find the property by its ppcId and phoneNumber
      const property = await AddModel.findOne({ ppcId });
  
      if (!property) {
        return res.status(404).json({ message: 'Property not found.' });
      }
  
      // Check if the user's phone number is in the interestRequests array
      const userInterestIndex = property.interestRequests.findIndex(request => request.phoneNumber === phoneNumber);
      if (userInterestIndex !== -1) {
        // If the user is interested, remove their interest or handle as needed
        property.interestRequests.splice(userInterestIndex, 1);  // Remove the user's interest
      }
  
      // Change the property status to 'delete'
      property.status = 'delete';
      await property.save();
  
      // Send the updated property as a response
      res.status(200).json({ message: 'Property removed successfully.', property });
    } catch (error) {
      res.status(500).json({ message: 'Error removing property.' });
    }
  });
  

  // Delete all properties endpoint
router.delete('/delete-all-properties', async (req, res) => {
  try {
    const result = await AddModel.deleteMany({}); // Deletes all documents in the collection
    res.status(200).json({ message: 'All properties deleted successfully.', deletedCount: result.deletedCount });
  } catch (error) {
    console.error('Error deleting all properties:', error);
    res.status(500).json({ message: 'Error deleting all properties.' });
  }
});


router.get('/fetch-status', async (req, res) => {
    const { phoneNumber } = req.query;
  
    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required.' });
    } 
    try {
      const normalizedPhoneNumber = phoneNumber
        .replace(/[\s-]/g, '')
        .replace(/^(\+91|91|0)/, '') 
        .trim();
  
      const query = {
        phoneNumber: new RegExp(normalizedPhoneNumber + '$'),
        status: { $in: ['incomplete', 'complete','pending','active','sendInterest', 'soldOut', 'reportProperties', 'needHelp', 'contact', 'favorite'] },
      };
  
      const users = await AddModel.find(query);
  
      if (!users || users.length === 0) {
        return res.status(404).json({ message: 'Users not found.' });
      }
  
      res.status(200).json({ message: 'User data fetched successfully!', users });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching user details.', error });
    }
  });

  router.get('/property-count', async (req, res) => {
    const { phoneNumber } = req.query;
  
    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required.' });
    }
  
    try {
      const normalizedPhoneNumber = phoneNumber
        .replace(/[\s-]/g, '')
        .replace(/^(\+91|91|0)/, '')
        .trim();
  
      const query = {
        phoneNumber: new RegExp(normalizedPhoneNumber + '$'),
        status: { $in: ['incomplete', 'complete','pending','active'] },
      };
  
      const count = await AddModel.countDocuments(query);
  
      res.status(200).json({
        message: 'Property count fetched successfully!',
        count,
      });
    } catch (error) {
      res.status(500).json({
        message: 'Error fetching property count.',
        error,
      });
    }
  });
  


router.get('/fetch-status-count', async (req, res) => {
  const { phoneNumber } = req.query;

  if (!phoneNumber) {
    return res.status(400).json({ message: 'Phone number is required.' });
  } 
  try {
    const normalizedPhoneNumber = phoneNumber
      .replace(/\s|-/g, '')
      .replace(/^\+91|91|0/, '')
      .trim();

    const query = {
      phoneNumber: new RegExp(normalizedPhoneNumber + '$'),
      status: { $in: ['incomplete', 'complete','pending','active'] },
    };

    const userCount = await AddModel.countDocuments(query);

    res.status(200).json({ message: 'User count fetched successfully!', count: userCount });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user count.', error });
  }
});


  


router.get('/fetch-delete-status', async (req, res) => {
  const { phoneNumber } = req.query;

  if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required.' });
  }

  try {
      // Normalize phone number format
      const normalizedPhoneNumber = phoneNumber
          .replace(/[\s-]/g, '') // Remove spaces & hyphens
          .replace(/^(\+91|91|0)/, '') // Remove country code if exists
          .trim();


      const query = {
          phoneNumber: new RegExp(`^(\\+91)?${normalizedPhoneNumber}$`), 
          status: 'delete',
      };


      const users = await AddModel.find(query);

      if (!users || users.length === 0) {
          return res.status(404).json({ message: 'No deleted properties found.' });
      }

      // Process response (remove +91 if present)
      const updatedUsers = users.map(user => ({
          ...user._doc,
          phoneNumber: user.phoneNumber.replace(/^\+91/, '') // Remove +91 if present
      }));

      res.status(200).json({ 
          message: 'Deleted properties fetched successfully!', 
          users: updatedUsers 
      });

  } catch (error) {
      res.status(500).json({ 
          message: 'Error fetching deleted properties.', 
          error: error.message || error 
      });
  }
});
  

router.get('/fetch-delete-status-count', async (req, res) => {
  const { phoneNumber } = req.query;

  if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required.' });
  }

  try {
      // Normalize phone number format
      const normalizedPhoneNumber = phoneNumber
          .replace(/[\s-]/g, '') // Remove spaces & hyphens
          .replace(/^(\+91|91|0)/, '') // Remove country code if exists
          .trim();

      const query = {
          phoneNumber: new RegExp(`^(\\+91)?${normalizedPhoneNumber}$`), 
          status: 'delete',
      };

      const userCount = await AddModel.countDocuments(query);

      res.status(200).json({ message: 'Deleted properties count fetched successfully!', count: userCount });

  } catch (error) {
      res.status(500).json({ 
          message: 'Error fetching deleted properties count.', 
          error: error.message || error 
      });
  }
});


  router.get('/fetch-removed-datas', async (req, res) => {
    const { ppcId } = req.query;
  
    if (!ppcId) {
      return res.status(400).json({ message: "PPC-ID is required." });
    }
  
    try {
      const query = { ppcId: ppcId, status: "delete" };
  
      const users = await AddModel.find(query);
      
  
      if (!users || users.length === 0) {
        return res.status(404).json({ message: "No deleted properties found." });
      }
  
      res.status(200).json({ message: "Deleted properties fetched successfully!", users });
    } catch (error) {
      res.status(500).json({ message: "Error fetching deleted properties.", error });
    }
  });
  


  router.get('/fetch-complete-status', async (req, res) => {
    const { phoneNumber } = req.query;

    if (!phoneNumber) {
        return res.status(400).json({ message: 'Phone number is required.' });
    }

    try {
        const normalizedPhoneNumber = phoneNumber
            .replace(/[\s-]/g, '')
            .replace(/^(\+91|91|0)/, '') 
            .trim();

        const query = {
            phoneNumber: new RegExp(normalizedPhoneNumber + '$'), 
            status: 'complete', 
        };

        const users = await AddModel.find(query);

        if (!users || users.length === 0) {
            return res.status(404).json({ message: 'No users with complete status found.' });
        }

        // Send the user data in the response
        res.status(200).json({ message: 'Complete status user data fetched successfully!', users });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching complete status user details.', error });
    }
});


router.get('/fetch-status-complete-all', async (req, res) => {
  try {
      const query = { status: 'complete' };

      const users = await AddModel.find(query);

      if (!users || users.length === 0) {
          return res.status(404).json({ message: 'No users with complete status found.' });
      }

      res.status(200).json({ message: 'Complete status user data fetched successfully!', users });
  } catch (error) {
      res.status(500).json({ message: 'Error fetching complete status user details.', error });
  }
});


router.put("/update-feature-status", async (req, res) => {
  try {
    const { ppcId, featureStatus } = req.body;

    await AddModel.updateOne({ ppcId }, { $set: { featureStatus } });

    res.status(200).json({ message: "Feature status updated successfully!" });
  } catch (error) {
    res.status(500).json({ message: "Error updating feature status.", error });
  }
});

router.get("/fetch-featured-properties", async (req, res) => {
  try {
    const featuredProperties = await AddModel.find({ featureStatus: "yes" });

    res.status(200).json({
      message: "Featured properties fetched successfully!",
      properties: featuredProperties,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching featured properties.", error });
  }
});


router.get('/properties/deleted', async (req, res) => {
  try {
    const deletedProperties = await AddModel.find({ status: 'delete' });

    res.status(200).json({
      message: 'Deleted properties fetched successfully.',
      data: deletedProperties,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching deleted properties.',
      error: error.message,
    });
  }
});

router.get('/properties/pending', async (req, res) => {
  try {
    const pendingProperties = await AddModel.find({ status: 'pending' });

    res.status(200).json({
      message: 'Pending properties fetched successfully.',
      data: pendingProperties,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching pending properties.',
      error: error.message,
    });
  }
});


// Assuming AddModel is already imported
router.get('/approved-properties-count', async (req, res) => {
  try {
    // Count documents where propertyApproved is 'yes'
    const count = await AddModel.countDocuments({ propertyApproved: "yes" });

    res.status(200).json({ approvedProperties: count });
  } catch (error) {
    console.error("Error fetching approved properties count:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


module.exports = router;





























