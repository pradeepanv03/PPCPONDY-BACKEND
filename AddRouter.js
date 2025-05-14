
const express = require('express');
const router = express.Router();
const AddModel = require('./AddModel');
const UserViewsModel = require("./ViewsModel");
const BuyerAssistance = require("./BuyerAssistance/BuyerAssistanceModel");
const CallUserList = require('./CalledUserModel');
const NotificationUser = require('./Notification/NotificationDetailModel');
const DeletedAddModel = require ('./DeleteModel');
const UserLogin = require('./user/UserModel'); 
const PricingPlans = require('./plans/PricingPlanModel');
const Bill = require('./CreateBill/BillModel');
const FollowUp = require('./FollowUp/FollowUpModel'); // Import your model


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





// GET /user-last-30-days-views/:phoneNumber
router.get("/user-last-30-days-views/:phoneNumber", async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    // Normalize the phone number into different formats
    const digits = phoneNumber.replace(/\D/g, "").slice(-10);
    const variants = [`+91${digits}`, `91${digits}`, digits];

    // Find the user's viewed properties
    const userViews = await UserViewsModel.findOne({
      phoneNumber: { $in: variants },
    });

    if (!userViews || !Array.isArray(userViews.viewedProperties)) {
      return res.status(404).json({ message: "No viewed properties found" });
    }

    // Filter views within the last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const recentViews = userViews.viewedProperties
      .filter((view) => {
        const viewedAt = new Date(view.viewedAt);
        return viewedAt >= thirtyDaysAgo && viewedAt <= now;
      })
      .sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt))
      .slice(0, 30); // Return only the latest 30 views

    if (recentViews.length === 0) {
      return res
        .status(404)
        .json({ message: "No views in the last 30 days" });
    }

    // Fetch property details
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
      message: "Viewed properties in the last 30 days (max 30 results)",
      properties: filteredProperties,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});



// GET /user-most-viewed-properties/:phoneNumber
router.get("/user-most-viewed-properties/:phoneNumber", async (req, res) => {
  try {
    const { phoneNumber } = req.params;

    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    // Normalize phone formats
    const digits = phoneNumber.replace(/\D/g, "").slice(-10);
    const variants = [`+91${digits}`, `91${digits}`, digits];

    // Fetch user views
    const userViews = await UserViewsModel.findOne({
      phoneNumber: { $in: variants },
    });

    if (!userViews || !Array.isArray(userViews.viewedProperties)) {
      return res.status(404).json({ message: "No viewed properties found" });
    }

    // Calculate 30-day window
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // Filter views in the last 30 days
    const recentViews = userViews.viewedProperties.filter((view) => {
      const viewedAt = new Date(view.viewedAt);
      return viewedAt >= thirtyDaysAgo && viewedAt <= now;
    });

    if (recentViews.length === 0) {
      return res.status(404).json({ message: "No views in the last 30 days" });
    }

    // Count views per ppcId
    const viewCounts = {};
    recentViews.forEach((view) => {
      const id = view.ppcId;
      if (viewCounts[id]) {
        viewCounts[id].count += 1;
        viewCounts[id].latestViewedAt = new Date(view.viewedAt) > new Date(viewCounts[id].latestViewedAt)
          ? view.viewedAt
          : viewCounts[id].latestViewedAt;
      } else {
        viewCounts[id] = { count: 1, latestViewedAt: view.viewedAt };
      }
    });

    // Sort by count descending
    const sortedPpcIds = Object.entries(viewCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([ppcId, info]) => ({ ppcId, ...info }));

    // Fetch property details
    const properties = await Promise.all(
      sortedPpcIds.map(async ({ ppcId, count, latestViewedAt }) => {
        const property = await AddModel.findOne({ ppcId });
        return property
          ? {
              ...property.toObject(),
              viewCount: count,
              latestViewedAt,
            }
          : null;
      })
    );

    const filteredProperties = properties.filter(Boolean);

    res.status(200).json({
      message: "Most viewed properties in the last 30 days",
      properties: filteredProperties,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});




// GET /all-most-viewed-properties
router.get("/all-most-viewed-properties", async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // Fetch all user view records
    const allUserViews = await UserViewsModel.find({});

    const viewCounts = {};

    // Process all viewedProperties across all users
    allUserViews.forEach((user) => {
      if (!Array.isArray(user.viewedProperties)) return;

      user.viewedProperties.forEach((view) => {
        const viewedAt = new Date(view.viewedAt);
        if (viewedAt >= thirtyDaysAgo && viewedAt <= now) {
          const ppcId = view.ppcId;

          if (viewCounts[ppcId]) {
            viewCounts[ppcId].count += 1;
            viewCounts[ppcId].latestViewedAt =
              new Date(viewedAt) > new Date(viewCounts[ppcId].latestViewedAt)
                ? view.viewedAt
                : viewCounts[ppcId].latestViewedAt;
          } else {
            viewCounts[ppcId] = { count: 1, latestViewedAt: view.viewedAt };
          }
        }
      });
    });

    // Sort by view count descending
    const sortedPpcIds = Object.entries(viewCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([ppcId, info]) => ({ ppcId, ...info }));

    // Fetch property details
    const properties = await Promise.all(
      sortedPpcIds.map(async ({ ppcId, count, latestViewedAt }) => {
        const property = await AddModel.findOne({ ppcId });
        return property
          ? {
              ...property.toObject(),
              viewCount: count,
              latestViewedAt,
            }
          : null;
      })
    );

    const filteredProperties = properties.filter(Boolean);

    res.status(200).json({
      message: "Most viewed properties by all users in the last 30 days",
      properties: filteredProperties,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});



router.post('/assign-phone', async (req, res) => {
  try {
    const { ppcId, assignedPhoneNumber } = req.body;

    const property = await AddModel.findOneAndUpdate(
      { ppcId: ppcId.toString() },
      {
        assignedPhoneNumber,
        setPpcId: true,
        setPpcIdAssignedAt: new Date()  // ⏰ Store date/time here
      },
      { new: true }
    );

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.status(200).json({
      message: 'Phone number assigned successfully',
      property
    });

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});



// GET /get-property-details/:ppcId
router.get('/get-property-details/:ppcId', async (req, res) => {
  try {
    const { ppcId } = req.params;

    if (!ppcId) {
      return res.status(400).json({ error: 'PPC ID is required' });
    }

    const property = await AddModel.findOne({ ppcId: ppcId.toString() });

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.status(200).json({
      ppcId: property.ppcId,
      assignedPhoneNumber: property.assignedPhoneNumber || null,
      originalPhoneNumber: property.phoneNumber // assuming phoneNumber is original poster's number
    });

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});



// GET /get-property-details
router.get('/get-property-details', async (req, res) => {
  try {
    const properties = await AddModel.find(
      { assignedPhoneNumber: { $exists: true, $ne: '' } },
      {
        ppcId: 1,
        assignedPhoneNumber: 1,
        phoneNumber: 1,
        setPpcId: 1,
        setPpcIdAssignedAt: 1, // Include timestamp
        _id: 0
      }
    );

    if (!properties || properties.length === 0) {
      return res.status(404).json({ error: 'No assigned phone numbers found' });
    }

    const formatted = properties.map(p => ({
      ppcId: p.ppcId,
      assignedPhoneNumber: p.assignedPhoneNumber,
      originalPhoneNumber: p.phoneNumber,
      setPpcId: p.setPpcId || false,
      setPpcIdAssignedAt: p.setPpcIdAssignedAt || null // Format optional
    }));

    res.status(200).json(formatted);

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});


// PUT /unassign-phone
router.put('/unassign-phone', async (req, res) => {
  try {
    const { ppcId } = req.body;

    const property = await AddModel.findOne({ ppcId: ppcId.toString() });

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const updated = await AddModel.findOneAndUpdate(
      { ppcId: ppcId.toString() },
      {
        previouslyAssignedPhoneNumber: property.assignedPhoneNumber,
        previouslyAssignedAt: property.setPpcIdAssignedAt,
        assignedPhoneNumber: null,
        setPpcIdAssignedAt: null,
        setPpcId: false
      },
      { new: true }
    );

    res.status(200).json({ message: 'Assignment temporarily removed', updated });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});



// PUT /undo-unassign-phone
router.put('/undo-unassign-phone', async (req, res) => {
  try {
    const { ppcId } = req.body;

    const property = await AddModel.findOne({ ppcId: ppcId.toString() });

    if (!property || !property.previouslyAssignedPhoneNumber) {
      return res.status(404).json({ error: 'No backup data found for undo' });
    }

    const updated = await AddModel.findOneAndUpdate(
      { ppcId: ppcId.toString() },
      {
        assignedPhoneNumber: property.previouslyAssignedPhoneNumber,
        setPpcIdAssignedAt: property.previouslyAssignedAt || new Date(),
        setPpcId: true,
        previouslyAssignedPhoneNumber: null,
        previouslyAssignedAt: null
      },
      { new: true }
    );

    res.status(200).json({ message: 'Assignment restored', updated });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.delete('/permanent-delete/:ppcId', async (req, res) => {
  const { ppcId } = req.params;
  try {
    const result = await AddModel.deleteOne({ ppcId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json({ message: 'Property permanently deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});







router.get('/fetch-all-datas', async (req, res) => {
  try {

      // Fetch all users from the database
      const users = await AddModel.find({});

      // Return the fetched user data
      res.status(200).json({ message: 'All user data fetched successfully!', users });
  } catch (error) {
      res.status(500).json({ message: 'Error fetching all user details.', error });
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




// ✅ API to fetch viewed properties for a user
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

    const normalizedPhoneNumber = phoneNumber.replace(/\s+/g, "").replace(/\+/g, "");

    const userViews = await UserViewsModel.findOne({ phoneNumber: normalizedPhoneNumber });

    if (!userViews || userViews.viewedProperties.length === 0) {
      return res.status(404).json({ message: "No viewed properties found" });
    }

    const sortedViews = userViews.viewedProperties.sort(
      (a, b) => new Date(b.viewedAt) - new Date(a.viewedAt)
    );


    res.status(200).json({
      viewedProperties: sortedViews,
      // notifications: relatedNotifications

    });
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
      description,
      pinCode,
      locationCoordinates,
    } = req.body;

    if (!ppcId) {
      return res.status(400).json({ message: 'PPC-ID is required.' });
    }

    try {
      const user = await AddModel.findOne({ ppcId });
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      // Update user fields dynamically
      const fieldsToUpdate = {
        phoneNumber, price, rentalPropertyAddress, state, city, district, area, 
        streetName, doorNumber, nagar, ownerName, email, alternatePhone, countryCode, 
        alternateCountryCode, propertyMode, propertyType, bankLoan, negotiation, ownership, 
        bedrooms, kitchen, kitchenType, balconies, floorNo, areaUnit, propertyApproved, 
        propertyAge, postedBy, facing, salesMode, salesType, furnished, lift, 
        attachedBathrooms, western, numberOfFloors, carParking, bestTimeToCall, totalArea,
        length,description,
        breadth,pinCode,locationCoordinates,
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

      // Check if all required fields are filled
      const requiredFields = [
        'ppcId','phoneNumber', 'price',     'propertyMode',
        'propertyType',   'postedBy', 'areaUnit', 'salesType',
       'totalArea',
      ];



      const isComplete = requiredFields.every((field) => user[field]);
      user.status = isComplete ? "complete" : "incomplete"; 
      

      await user.save();

      // Save notification when property is updated
try {
  const notification = await NotificationUser.create({
    recipientPhoneNumber: user.phoneNumber,
    senderPhoneNumber: user.phoneNumber,
    userPhoneNumber: user.phoneNumber,
    ppcId: user.ppcId,
    type: "property-Add",
    message: `Your property (${user.ppcId}) has been Added successfully.`,
    createdAt: new Date()
  });

} catch (notifErr) {
}

      res.status(200).json({
        message: 'Property details updated successfully!',
        ppcId: user.ppcId,
        propertyStatus: user.propertyStatus,
        user,
      });
    } catch (error) {
      res.status(500).json({ message: 'Error updating property details.', error });
    }
  }
);




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



// GET: Count of pending properties
router.get("/pending-properties-count", async (req, res) => {
  try {
    // Count documents where status is 'pending' or 'incomplete'
    const count = await AddModel.countDocuments({
      status: { $in: ["pending","complete"] } // <-- Adjust this based on your business logic
    });

    res.status(200).json({ pendingProperties: count });
  } catch (error) {
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
    // Get the latest property to calculate the next PPC-ID
    const latestProperty = await AddModel.findOne().sort({ ppcId: -1 });

    const nextPpcId = latestProperty ? latestProperty.ppcId + 1 : 1001;

    // Create new user with the next PPC-ID and set 'createdBy' to 'Admin'
    const newUser = new AddModel({
      ppcId: nextPpcId,
      createdBy: 'Admin',  // Override default 'User' with 'Admin'
    });

    // Save the new user to the database
    const savedUser = await newUser.save();

    // Respond with the created PPC-ID
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





  router.post('/store-data', async (req, res) => {
    const { phoneNumber } = req.body;
  
    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required.' });
    }
  
    try {
      // Check for an incomplete entry for this phone number
      const existingIncomplete = await AddModel.findOne({
        phoneNumber,
        $or: [
          { propertyMode: { $in: [null, ''] } },
          { propertyType: { $in: [null, ''] } },
          { price: { $in: [null, ''] } }
        ]
      });
  
      if (existingIncomplete) {
        return res.status(200).json({
          message: 'Existing incomplete entry found.',
          ppcId: existingIncomplete.ppcId
        });
      }
  
      // Generate new PPC-ID
      const latestProperty = await AddModel.findOne().sort({ ppcId: -1 });
      const nextPpcId = latestProperty ? latestProperty.ppcId + 1 : 1001;
  
      // Create and save new user
      const newUser = new AddModel({ phoneNumber, ppcId: nextPpcId,createdBy: 'User' });
      await newUser.save();
  
      res.status(201).json({ message: 'New PPC-ID created.', ppcId: nextPpcId });
    } catch (error) {
      res.status(500).json({ message: 'Error storing user details.', error });
    }
  });



router.post('/store-phone', async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ message: 'Phone number is required.' });
  }

  try {
    // Check for an incomplete entry for this phone number
    const existingIncomplete = await AddModel.findOne({
      phoneNumber,
      $or: [
        { propertyMode: { $in: [null, ''] } },
        { propertyType: { $in: [null, ''] } },
        { price: { $in: [null, ''] } }
      ]
    });

    if (existingIncomplete) {
      return res.status(200).json({
        message: 'Existing incomplete entry found.',
        ppcId: existingIncomplete.ppcId
      });
    }

    // Generate new PPC-ID
    const latestProperty = await AddModel.findOne().sort({ ppcId: -1 });
    const nextPpcId = latestProperty ? latestProperty.ppcId + 1 : 1001;

    // Create and save new user
    const newUser = new AddModel({ phoneNumber, ppcId: nextPpcId,createdBy: 'Admin' });
    await newUser.save();

    res.status(201).json({ message: 'New PPC-ID created.', ppcId: nextPpcId });
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





router.get('/fetch-all-property-details', async (req, res) => {
  try {
    const properties = await AddModel.find({});

    const requiredFields = [
      'propertyMode', 'propertyType', 'price',
      'totalArea', 'areaUnit',
      'salesType', 'postedBy'
    ];

    const adsCountByUser = properties.reduce((acc, property) => {
      const phone = property.phoneNumber;
      acc[phone] = (acc[phone] || 0) + 1;
      return acc;
    }, {});

    const filteredProperties = properties.filter(property => {
      const hasReports = Array.isArray(property.reportProperty) && property.reportProperty.length > 0;
      const hasHelps = Array.isArray(property.helpRequests) && property.helpRequests.length > 0;
      return hasReports || hasHelps;
    });

    const combinedData = filteredProperties.map((property, index) => {
      const isComplete = requiredFields.every(field =>
        property[field] !== undefined &&
        property[field] !== null &&
        String(property[field]).trim() !== ''
      );

      const helpDetails = (property.helpRequests || []).map(help => ({
        phoneNumber: help.phoneNumber,
        selectHelpReason: help.selectHelpReason,
        comment: help.comment,
        requestedAt: help.requestedAt
      }));

      const reportDetails = (property.reportProperty || []).map(report => ({
        phoneNumber: report.phoneNumber,
        reason: report.reason,
        selectReasons: report.selectReasons,
        date: report.date
      }));

      return {
        slNo: index + 1,
        ppcId: property.ppcId,
        image: property.photos && property.photos.length > 0 ? property.photos[0] : null,
        phoneNumber: property.phoneNumber,
        ownerName: property.ownerName,
        propertyMode: property.propertyMode,
        propertyType: property.propertyType,
        price: property.price,
        area: property.area,
        city: property.city,
        state: property.state,
        createdBy: property.postedBy,
        createdAt: property.createdAt,
        updatedAt: property.updatedAt,
        required: isComplete ? "yes" : "no",
        adsCount: adsCountByUser[property.phoneNumber] || 0,
        planName: property.planName || "",
        status: property.status || "Active",
        reportDetails,
        totalReports: reportDetails.length,
        helpRequests: helpDetails,
        totalHelpRequests: helpDetails.length
      };
    });

    res.status(200).json({
      success: true,
      message: "Filtered property data fetched successfully!",
      data: combinedData
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
});




router.get('/fetch-alls-datas', async (req, res) => {
  try {
    const properties = await AddModel.find({});
    const plans = await PricingPlans.find();
    const bills = await Bill.find();
    const followups = await FollowUp.find(); // Ensure you're getting follow-ups

    const requiredFields = [
      'propertyMode', 'propertyType', 'price',
      'totalArea', 'areaUnit',
      'salesType', 'postedBy'
    ];

    const adsCountByUser = properties.reduce((acc, property) => {
      const phone = property.phoneNumber;
      acc[phone] = (acc[phone] || 0) + 1;
      return acc;
    }, {});

    // ✅ Filter properties to only include those where all required fields are filled
    const completeProperties = properties.filter((property) =>
      requiredFields.every(
        (field) =>
          property[field] !== undefined &&
          property[field] !== null &&
          String(property[field]).trim() !== ''
      )
    );

    const processedProperties = completeProperties.map((property) => {
      const matchedPlan = plans.find(plan =>
        Array.isArray(plan.phoneNumber)
          ? plan.phoneNumber.includes(property.phoneNumber)
          : plan.phoneNumber === property.phoneNumber
      );

      const matchedBill = bills.find(bill =>
        bill.ownerPhone === property.phoneNumber || bill.ppId === property.ppcId
      );

      let adminOffice = 'N/A';
      let adminName = 'N/A';
      let billNo = 'N/A';
      let billDate = 'N/A';
      let validity = 'N/A';
      let billExpiryDate = 'N/A';

      if (matchedBill) {
        adminOffice = matchedBill.adminOffice || 'N/A';
        adminName = matchedBill.adminName || 'N/A';
        billNo = matchedBill.billNo || 'N/A';
        billDate = matchedBill.billDate || 'N/A';
        validity = matchedBill.validity || 'N/A';

        if (billDate !== 'N/A' && validity !== 'N/A') {
          const billStart = new Date(billDate).getTime();
          const billExpiry = billStart + (validity * 24 * 60 * 60 * 1000);
          billExpiryDate = new Date(billExpiry).toLocaleDateString();
        }
      }

      let planCreatedAt = 'N/A';
      let planExpiryDate = 'N/A';

      if (matchedPlan && matchedPlan.createdAt && matchedPlan.durationDays) {
        const expiryDate = new Date(matchedPlan.createdAt).getTime() + matchedPlan.durationDays * 24 * 60 * 60 * 1000;
        planCreatedAt = new Date(matchedPlan.createdAt).toLocaleDateString();
        planExpiryDate = new Date(expiryDate).toLocaleDateString();
      }


    
      // Get the latest follow-up admin name for this ppcId
      const propertyFollowUps = followups
        .filter(fu => String(fu.ppcId) === String(property.ppcId)) // Ensure matching ppcId
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

   const followUpAdminName = propertyFollowUps.length > 0 
   ? propertyFollowUps[0]?.adminName || 'Unknown Admin' 
   : 'N/A';

      return {
        ...property._doc,
        required: "yes", // Only "yes" ones are included now
        adsCount: adsCountByUser[property.phoneNumber] || 0,
        planName: matchedPlan?.name || 'N/A',
        planCreatedAt,
        planExpiryDate,
        packageType: matchedPlan?.packageType || 'N/A',
        planDuration: matchedPlan?.durationDays || 'N/A',
        adminOffice,
        adminName,
        billNo,
        billDate,
        validity,
        billExpiryDate,
        followUpAdminName
      };
    });

    res.status(200).json({
      message: "Only required=YES data fetched successfully.",
      users: processedProperties,
    });

  } catch (error) {
    res.status(500).json({
      message: 'Error fetching all user details.',
      error: error.message
    });
  }
});


router.get('/fetch-all-postby-properties', async (req, res) => {
  try {
    // Only fetch properties where postedBy exists and is not empty
    const properties = await AddModel.find({
      postedBy: { $exists: true, $ne: '' }
    });

    const plans = await PricingPlans.find();
    const bills = await Bill.find();

    const requiredFields = [
      'propertyMode', 'propertyType', 'price',
      'totalArea', 'areaUnit',
      'salesType', 'postedBy'
    ];

    const adsCountByUser = properties.reduce((acc, property) => {
      const phone = property.phoneNumber;
      acc[phone] = (acc[phone] || 0) + 1;
      return acc;
    }, {});

    const completeProperties = properties.filter((property) =>
      requiredFields.every(
        (field) =>
          property[field] !== undefined &&
          property[field] !== null &&
          String(property[field]).trim() !== ''
      )
    );

    const incompleteProperties = properties.filter((property) =>
      !requiredFields.every(
        (field) =>
          property[field] !== undefined &&
          property[field] !== null &&
          String(property[field]).trim() !== ''
      )
    );

    const processedProperties = [...completeProperties, ...incompleteProperties].map((property) => {
      const matchedPlan = plans.find(plan =>
        Array.isArray(plan.phoneNumber)
          ? plan.phoneNumber.includes(property.phoneNumber)
          : plan.phoneNumber === property.phoneNumber
      );

      const matchedBill = bills.find(bill =>
        bill.ownerPhone === property.phoneNumber || bill.ppId === property.ppcId
      );

      const isComplete = completeProperties.includes(property);

      return {
        ...property._doc,
        postedBy: property.postedBy,
        required: isComplete ? "yes" : "no",
        adsCount: adsCountByUser[property.phoneNumber] || 0,
        planName: matchedPlan?.name || 'N/A',
        packageType: matchedPlan?.packageType || 'N/A',
        planDuration: matchedPlan?.durationDays || 'N/A',
        planCreatedAt: matchedPlan?.createdAt ? new Date(matchedPlan.createdAt).toLocaleDateString() : 'N/A',
        planExpiryDate: matchedPlan?.createdAt && matchedPlan?.durationDays
          ? new Date(new Date(matchedPlan.createdAt).getTime() + matchedPlan.durationDays * 24 * 60 * 60 * 1000).toLocaleDateString()
          : 'N/A',
        adminOffice: matchedBill?.adminOffice || 'N/A',
        adminName: matchedBill?.adminName || 'N/A',
        billNo: matchedBill?.billNo || 'N/A',
        billDate: matchedBill?.billDate || 'N/A',
        validity: matchedBill?.validity || 'N/A',
        billExpiryDate: matchedBill?.billDate && matchedBill?.validity
          ? new Date(new Date(matchedBill.billDate).getTime() + matchedBill.validity * 24 * 60 * 60 * 1000).toLocaleDateString()
          : 'N/A'
      };
    });

    res.status(200).json({
      message: "Filtered properties with postedBy fetched successfully.",
      users: processedProperties,
    });

  } catch (error) {
    res.status(500).json({
      message: 'Error fetching all user details.',
      error: error.message
    });
  }
});



router.get('/fetch-all-expire-property', async (req, res) => {
  try {
    const users = await PricingPlans.find();
    const allProperties = await AddModel.find({});
    const allBills = await Bill.find();
    const followups = await FollowUp.find();

    if (!users.length) {
      return res.status(404).json({ message: 'No users found.' });
    }

    const adsCountByUser = allProperties.reduce((acc, property) => {
      const phone = property.phoneNumber;
      acc[phone] = (acc[phone] || 0) + 1;
      return acc;
    }, {});

    const requiredFields = [
      'propertyMode', 'propertyType', 'price',
      'totalArea', 'areaUnit',
      'salesType', 'postedBy'
    ];

    const now = Date.now();
    const tenDaysLater = now + 10 * 24 * 60 * 60 * 1000;

    const userPlansWithProperties = (await Promise.all(users.map(async (user) => {
      const { name: planName, phoneNumber, createdAt, durationDays, packageType } = user;

      const planExpiry = createdAt && durationDays
        ? new Date(new Date(createdAt).getTime() + durationDays * 24 * 60 * 60 * 1000)
        : null;

      if (!planExpiry || planExpiry.getTime() <= now || planExpiry.getTime() > tenDaysLater) {
        return null;
      }

      const daysLeft = Math.ceil((planExpiry.getTime() - now) / (1000 * 60 * 60 * 24));
      const expiresIn = `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;

      const formattedCreatedAt = createdAt ? new Date(createdAt).toLocaleDateString() : 'N/A';
      const formattedExpiryDate = planExpiry ? new Date(planExpiry).toLocaleDateString() : 'N/A';

      const properties = await AddModel.find({
        phoneNumber: { $in: phoneNumber },
        status: ['complete', 'incomplete', 'active', 'pending', 'delete'],
      });

      const enhancedProperties = properties.map((property) => {
        const hasAllFields = requiredFields.every(field =>
          property[field] !== undefined &&
          property[field] !== null &&
          String(property[field]).trim() !== ''
        );

        const required = hasAllFields ? 'yes' : 'no';
        const adsCount = adsCountByUser[property.phoneNumber] || 0;

        const matchedBill = allBills.find(
          bill => bill.ownerPhone === property.phoneNumber || bill.ppId === property.ppcId
        );

        const billNo = matchedBill?.billNo || 'N/A';

        const propertyFollowUps = followups
          .filter(fu => String(fu.ppcId) === String(property.ppcId))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const followUpAdminName = propertyFollowUps.length > 0
          ? propertyFollowUps[0]?.adminName || 'Unknown Admin'
          : 'N/A';

        return {
          ...property.toObject(),
          required,
          adsCount,
          followUpAdminName,
          billNo,
          status: property.status,
          planName,
          planCreatedAt: formattedCreatedAt,
          durationDays,
          planExpiryDate: formattedExpiryDate,
          expiresIn,
          packageType: packageType || 'N/A',
          createdAt: property.createdAt ? new Date(property.createdAt).toLocaleDateString() : 'N/A',
          updatedAt: property.updatedAt ? new Date(property.updatedAt).toLocaleDateString() : 'N/A',
        };
      });

      if (enhancedProperties.length > 0) {
        return {
          user: {
            phoneNumber,
            planName,
            planCreatedAt: formattedCreatedAt,
            durationDays,
            planExpiryDate: formattedExpiryDate,
            expiresIn,
            packageType: packageType || 'N/A',
          },
          properties: enhancedProperties,
        };
      } else {
        return null;
      }
    }))).filter(item => item !== null);

    res.status(200).json({
      message: "Properties with plans expiring in the next 10 days fetched successfully!",
      data: userPlansWithProperties,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching expiring properties.',
      error: error.message,
    });
  }
});



router.get('/ads-count-by-user', async (req, res) => {
  try {
    const properties = await AddModel.find({});
    
    const adsCountByUser = properties.reduce((acc, property) => {
      const phone = property.phoneNumber;
      if (!acc[phone]) {
        acc[phone] = 1;
      } else {
        acc[phone]++;
      }
      return acc;
    }, {});

    const adsCountArray = Object.entries(adsCountByUser).map(([phoneNumber, adsCount]) => ({
      phoneNumber,
      adsCount,
    }));

    res.status(200).json({
      message: 'Ad count per user fetched successfully!',
      data: adsCountArray,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch ad counts',
      error: error.message,
    });
  }
});



// Common function to fetch active users by postedBy type
const fetchActiveUsersByType = async (req, res, type) => {
  try {
    const users = await AddModel.find({
      status: 'active',
      postedBy: type
    });

    res.status(200).json({
      message: `${type} users fetched successfully!`,
      users
    });

  } catch (error) {
    res.status(500).json({
      message: `Error fetching ${type} users.`,
      error: error.message || 'Unknown server error'
    });
  }
};

// API for Owner
router.get('/fetch-active-owner', (req, res) => {
  fetchActiveUsersByType(req, res, 'Owner');
});

// API for Agent
router.get('/fetch-active-agent', (req, res) => {
  fetchActiveUsersByType(req, res, 'Agent');
});

// API for Developer
router.get('/fetch-active-developer', (req, res) => {
  fetchActiveUsersByType(req, res, 'Developer');
});

// API for Promotor
router.get('/fetch-active-promotor', (req, res) => {
  fetchActiveUsersByType(req, res, 'Promotor');
});




router.get('/fetch-free-plan-properties', async (req, res) => {
  try {
    // 1. Find all users who have Free Plan
    const freePlanUsers = await PricingPlans.find({ name: "Free" });

    if (!freePlanUsers.length) {
      return res.status(404).json({ message: 'No users found with Free Plan.' });
    }

    // 2. Extract phoneNumbers from Free Plan users
    const phoneNumbers = freePlanUsers.flatMap(user => user.phoneNumber); // Flattening in case of an array

    // 3. Find properties posted by these phoneNumbers
    const properties = await AddModel.find({ phoneNumber: { $in: phoneNumbers } });

    // Map properties to include the additional fields for display
    const enhancedProperties = properties.map((property) => {
      // Ensure we have the plan-related fields in each property
      const freePlanUser = freePlanUsers.find(user => user.phoneNumber === property.phoneNumber);

      // Add extra plan details like plan created date, duration, and expiry
      const planCreatedAt = freePlanUser ? freePlanUser.planCreatedAt : null;
      const durationDays = freePlanUser ? freePlanUser.durationDays : null;
      const planExpiryDate = planCreatedAt && durationDays
        ? new Date(planCreatedAt).setDate(new Date(planCreatedAt).getDate() + durationDays)
        : null;

      return {
        ...property.toObject(),
        planCreatedAt,
        durationDays,
        planExpiryDate: planExpiryDate ? new Date(planExpiryDate).toLocaleDateString() : 'N/A',
        packageType: freePlanUser ? freePlanUser.packageType : 'N/A', // Add packageType if exists
        plan: 'Free', // Static, as it’s a Free Plan user
      };
    });

    res.status(200).json({
      message: "Properties posted by Free Plan users fetched successfully!",
      freePlanUsers: freePlanUsers, // plan user details
      properties: enhancedProperties, // properties with additional plan info
    });
    
  } catch (error) {
    res.status(500).json({ message: 'Error fetching Free Plan user properties.', error: error.message });
  }
});



router.get('/fetch-plan-by-phone-number', async (req, res) => {
  try {
    const { phoneNumber } = req.query;

    // 1. Validate phone number
    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required.' });
    }

    // 2. Fetch user's plan using phone number
    const userPlan = await PricingPlans.findOne({ phoneNumber });

    if (!userPlan) {
      return res.status(404).json({ message: 'No plan found for the given phone number.' });
    }

    const { name: planName, createdAt, durationDays, packageType } = userPlan;

    // 3. Calculate plan expiry date
    const planCreatedDate = createdAt ? new Date(createdAt) : null;
    const planExpiryDate = planCreatedDate && durationDays
      ? new Date(planCreatedDate.getTime() + durationDays * 24 * 60 * 60 * 1000)
      : null;

    // 4. Calculate days remaining
    let warningMessage = '';
    if (planExpiryDate) {
      const today = new Date();
      const diffInTime = planExpiryDate.getTime() - today.getTime();
      const daysRemaining = Math.ceil(diffInTime / (1000 * 3600 * 24));

      if (daysRemaining > 0 && daysRemaining <= 10) {
        warningMessage = `Your plan will expire in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}.`;
      } else if (daysRemaining <= 0) {
        warningMessage = `Your plan has expired.`;
      }
    }

    // 5. Format dates as dd-mm-yyyy
    const formatDate = (date) => {
      if (!date || isNaN(date.getTime())) return 'N/A';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    };

    const formattedCreatedAt = formatDate(planCreatedDate);
    const formattedExpiryDate = formatDate(planExpiryDate);

    // 6. Fetch properties associated with this user
    const properties = await AddModel.find({ phoneNumber });

    const enhancedProperties = properties.map((property) => ({
      ...property.toObject(),
      planName,
      planCreatedAt: formattedCreatedAt,
      durationDays,
      planExpiryDate: formattedExpiryDate,
      packageType: packageType || 'N/A',
    }));

    // 7. Send successful response
    return res.status(200).json({
      message: 'Plan details and associated properties fetched successfully!',
      user: {
        phoneNumber,
        planName,
        planCreatedAt: formattedCreatedAt,
        durationDays,
        planExpiryDate: formattedExpiryDate,
        packageType: packageType || 'N/A',
        warningMessage, // ✅ Include warning
      },
      properties: enhancedProperties,
    });

  } catch (error) {
    return res.status(500).json({
      message: 'Error fetching plan details.',
      error: error.message,
    });
  }
});




router.get('/fetch-all-plans-and-properties', async (req, res) => {
  try {
    const users = await PricingPlans.find();

    if (!users.length) {
      return res.status(404).json({ message: 'No users found.' });
    }

    const userPlansWithProperties = await Promise.all(users.map(async (user) => {
      const { name: planName, phoneNumber, createdAt, durationDays, packageType } = user;

      const planExpiryDate = createdAt && durationDays
        ? new Date(new Date(createdAt).getTime() + durationDays * 24 * 60 * 60 * 1000)
        : null;

      const formattedCreatedAt = createdAt ? new Date(createdAt).toLocaleDateString() : 'N/A';
      const formattedExpiryDate = planExpiryDate ? new Date(planExpiryDate).toLocaleDateString() : 'N/A';

      // Fetch only active properties associated with this user's phone number(s)
      const properties = await AddModel.find({
        phoneNumber: { $in: phoneNumber },
        status: 'active'
      });
      
      const enhancedProperties = properties.map((property) => ({
        ...property.toObject(),
        planName,
        planCreatedAt: formattedCreatedAt,
        durationDays,
        planExpiryDate: formattedExpiryDate,
        packageType: packageType || 'N/A',
      }));

      return {
        user: {
          phoneNumber,
          planName,
          planCreatedAt: formattedCreatedAt,
          durationDays,
          planExpiryDate: formattedExpiryDate,
          packageType,
        },
        properties: enhancedProperties,
      };
    }));

    res.status(200).json({
      message: "Active properties and user plans fetched successfully!",
      data: userPlansWithProperties,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching all plans and properties.',
      error: error.message,
    });
  }
});




router.get('/fetch-all-free-plans', async (req, res) => {
  try {
    const users = await PricingPlans.find({ name: 'Free' }); // Fetch only Free plans

    if (!users.length) {
      return res.status(404).json({ message: 'No users with Free plan found.' });
    }

    const userPlansWithProperties = await Promise.all(users.map(async (user) => {
      const {
        name: planName,
        phoneNumber,
        createdAt,
        durationDays,
        packageType,
        adminName,
        billNo,
        createdBy, // Assuming this is billCreatedBy
      } = user;

      const planExpiryDate = createdAt && durationDays
        ? new Date(new Date(createdAt).getTime() + durationDays * 24 * 60 * 60 * 1000)
        : null;

      const formattedCreatedAt = createdAt ? new Date(createdAt).toLocaleDateString() : 'N/A';
      const formattedExpiryDate = planExpiryDate ? new Date(planExpiryDate).toLocaleDateString() : 'N/A';

      // Fetch all properties associated with this user's phone number(s)
      const properties = await AddModel.find({
        phoneNumber: { $in: phoneNumber },
      });

      const requiredFields = ['propertyMode', 'propertyType', 'price', 'totalArea', 'areaUnit', 'salesType', 'postedBy'];

      const enhancedProperties = properties
      .map((property) => {
        const hasRequiredFields = requiredFields.every(field =>
          property[field] !== undefined &&
          property[field] !== null &&
          String(property[field]).trim() !== ''
        );
    
        return {
          ...property.toObject(),
          planName,
          planCreatedAt: formattedCreatedAt,
          durationDays,
          planExpiryDate: formattedExpiryDate,
          packageType: packageType || 'N/A',
          adminName:adminName || 'N/A',
          billNo: billNo || 'N/A',
          billCreatedBy: createdBy || 'N/A',
          billCreatedAt: formattedCreatedAt,
          required: hasRequiredFields ? 'Yes' : 'No',
        };
      })
      .filter(property => property.required === 'Yes'); // ✅ Filter only 'Yes'
    

      return {
        user: {
          phoneNumber,
          planName,
          planCreatedAt: formattedCreatedAt,
          planExpiryDate: formattedExpiryDate,
          durationDays,
          packageType,
          adminName:adminName || 'N/A',
          billNo: billNo || 'N/A',
          billCreatedBy: createdBy || 'N/A',
          billCreatedAt: formattedCreatedAt,
          adsCount: properties.length,
        },
        properties: enhancedProperties,
      };
    }));

    res.status(200).json({
      message: "Free plan's properties and full user details fetched successfully!",
      data: userPlansWithProperties,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching Free plans and properties.',
      error: error.message,
    });
  }
});



router.get('/fetch-all-featured-properties', async (req, res) => {
  try {
    const featuredProperties = await AddModel.find({ featureStatus: 'yes' });

    if (!featuredProperties.length) {
      return res.status(404).json({ message: 'No featured properties found.' });
    }

    const requiredFields = ['propertyMode', 'propertyType', 'price', 'totalArea', 'areaUnit', 'salesType', 'postedBy'];

    const result = await Promise.all(featuredProperties.map(async (property) => {
      const hasRequiredFields = requiredFields.every(field =>
        property[field] !== undefined &&
        property[field] !== null &&
        String(property[field]).trim() !== ''
      );

      if (!hasRequiredFields) return null; // Skip if not required

      // Try to find plan for this property's phoneNumber
      const plan = await PricingPlans.findOne({ phoneNumber: property.phoneNumber });

      const planName = plan?.name || 'N/A';
      const createdAt = plan?.createdAt || null;
      const durationDays = plan?.durationDays || null;
      const planExpiryDate = createdAt && durationDays
        ? new Date(new Date(createdAt).getTime() + durationDays * 24 * 60 * 60 * 1000)
        : null;

      return {
        user: {
          phoneNumber: property.phoneNumber,
          planName,
          planCreatedAt: createdAt ? new Date(createdAt).toLocaleDateString() : 'N/A',
          planExpiryDate: planExpiryDate ? new Date(planExpiryDate).toLocaleDateString() : 'N/A',
          durationDays: durationDays || 'N/A',
          packageType: plan?.packageType || 'N/A',
          adminName:plan?.adminName || 'N/A',
          billNo: plan?.billNo || 'N/A',
          billCreatedBy: plan?.createdBy || 'N/A',
          billCreatedAt: createdAt ? new Date(createdAt).toLocaleDateString() : 'N/A',
          adsCount: 1,
        },
        properties: [{
          ...property.toObject(),
          required: 'Yes',
          planName,
        }]
      };
    }));

    const filteredResult = result.filter(item => item !== null);

    res.status(200).json({
      message: "Featured properties with user and plan info fetched successfully!",
      data: filteredResult,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching featured properties.',
      error: error.message,
    });
  }
});



router.get('/fetch-all-ppc-properties', async (req, res) => {
  try {
    const featuredProperties = await AddModel.find({ featureStatus: 'yes' });

    if (!featuredProperties.length) {
      return res.status(404).json({ message: 'No featured properties found.' });
    }

    const requiredFields = ['propertyMode', 'propertyType', 'price', 'totalArea', 'areaUnit', 'salesType', 'postedBy'];

    const result = await Promise.all(featuredProperties.map(async (property) => {
      const hasRequiredFields = requiredFields.every(field =>
        property[field] !== undefined &&
        property[field] !== null &&
        String(property[field]).trim() !== ''
      );

      if (!hasRequiredFields) return null; // Skip if not required

      // Try to find plan for this property's phoneNumber
      const plan = await PricingPlans.findOne({ phoneNumber: property.phoneNumber });

      const planName = plan?.name || 'N/A';
      const createdAt = plan?.createdAt || null;
      const durationDays = plan?.durationDays || null;
      const planExpiryDate = createdAt && durationDays
        ? new Date(new Date(createdAt).getTime() + durationDays * 24 * 60 * 60 * 1000)
        : null;

      return {
        user: {
          phoneNumber: property.phoneNumber,
          planName,
          planCreatedAt: createdAt ? new Date(createdAt).toLocaleDateString() : 'N/A',
          planExpiryDate: planExpiryDate ? new Date(planExpiryDate).toLocaleDateString() : 'N/A',
          durationDays: durationDays || 'N/A',
          packageType: plan?.packageType || 'N/A',
          adminName:plan?.adminName || 'N/A',
          billNo: plan?.billNo || 'N/A',
          billCreatedBy: plan?.createdBy || 'N/A',
          billCreatedAt: createdAt ? new Date(createdAt).toLocaleDateString() : 'N/A',
          adsCount: 1,
        },
        properties: [{
          ...property.toObject(),
          required: 'Yes',
          planName,
        }]
      };
    }));

    const filteredResult = result.filter(item => item !== null);

    res.status(200).json({
      message: "Featured properties with user and plan info fetched successfully!",
      data: filteredResult,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching featured properties.',
      error: error.message,
    });
  }
});




router.get('/fetch-all-paid-plans', async (req, res) => {
  try {
    // Fetch all plans that are NOT 'Free'
    const users = await PricingPlans.find({ name: { $ne: 'Free' } }); // Only paid plans

    if (!users.length) {
      return res.status(404).json({ message: 'No users with Paid plans found.' });
    }

    const userPlansWithProperties = await Promise.all(users.map(async (user) => {
      const {
        name: planName,
        phoneNumber,
        createdAt,
        durationDays,
        packageType,
        adminName,
        billNo,
        createdBy,
      } = user;

      const planExpiryDate = createdAt && durationDays
        ? new Date(new Date(createdAt).getTime() + durationDays * 24 * 60 * 60 * 1000)
        : null;

      const formattedCreatedAt = createdAt ? new Date(createdAt).toLocaleDateString() : 'N/A';
      const formattedExpiryDate = planExpiryDate ? new Date(planExpiryDate).toLocaleDateString() : 'N/A';

      const properties = await AddModel.find({
        phoneNumber: { $in: phoneNumber },
      });

      const requiredFields = ['propertyMode', 'propertyType', 'price', 'totalArea', 'areaUnit', 'salesType', 'postedBy'];
 
      const enhancedProperties = properties
      .map((property) => {
        const hasRequiredFields = requiredFields.every(field =>
          property[field] !== undefined &&
          property[field] !== null &&
          String(property[field]).trim() !== ''
        );
    
        return {
          ...property.toObject(),
          planName,
          planCreatedAt: formattedCreatedAt,
          durationDays,
          planExpiryDate: formattedExpiryDate,
          packageType: packageType || 'N/A',
          adminName:adminName || 'N/A',
          billNo: billNo || 'N/A',
          billCreatedBy: createdBy || 'N/A',
          billCreatedAt: formattedCreatedAt,
          required: hasRequiredFields ? 'Yes' : 'No',
        };
      })
      .filter(property => property.required === 'Yes'); // ✅ Filter only 'Yes'
    
      
      
      return {
        user: {
          phoneNumber,
          planName,
          planCreatedAt: formattedCreatedAt,
          planExpiryDate: formattedExpiryDate,
          durationDays,
          packageType,
          adminName:adminName || 'N/A',
          billNo: billNo || 'N/A',
          billCreatedBy: createdBy || 'N/A',
          billCreatedAt: formattedCreatedAt,
          adsCount: properties.length,
        },
        properties: enhancedProperties,
      };
    }));

    res.status(200).json({
      message: "Paid plan properties and user details fetched successfully!",
      data: userPlansWithProperties,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching Paid plans and properties.',
      error: error.message,
    });
  }
});



// PUT /delete-free-property/:ppcId
router.put('/delete-free-property/:ppcId', async (req, res) => {
  try {
    const { ppcId } = req.params;
    const property = await AddModel.findOneAndUpdate(
      { ppcId },
      { isDeleted: true },
      { new: true }
    );

    if (!property) {
      return res.status(404).json({ message: 'Property not found with the given PPC ID' });
    }

    res.status(200).json({ message: 'Property marked as deleted successfully', property });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});


// PUT /undo-delete-free-property/:ppcId
router.put('/undo-delete-free-property/:ppcId', async (req, res) => {
  try {
    const { ppcId } = req.params;
    const property = await AddModel.findOneAndUpdate(
      { ppcId },
      { isDeleted: false },
      { new: true }
    );

    if (!property) {
      return res.status(404).json({ message: 'Property not found with the given PPC ID' });
    }

    res.status(200).json({ message: 'Property restored successfully', property });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});


// PUT /delete-free-property/:ppcId/:phoneNumber
router.put('/delete-free-property/:ppcId/:phoneNumber', async (req, res) => {
  try {
    const { ppcId, phoneNumber } = req.params;

    const property = await AddModel.findOneAndUpdate(
      { ppcId, phoneNumber },
      { isDeleted: true },
      { new: true }
    );

    if (!property) {
      return res.status(404).json({ message: 'Property not found with the given PPC ID and phone number' });
    }

    res.status(200).json({ message: 'Property marked as deleted successfully', property });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// PUT /undo-delete-free-property/:ppcId/:phoneNumber
router.put('/undo-delete-free-property/:ppcId/:phoneNumber', async (req, res) => {
  try {
    const { ppcId, phoneNumber } = req.params;

    const property = await AddModel.findOneAndUpdate(
      { ppcId, phoneNumber },
      { isDeleted: false },
      { new: true }
    );

    if (!property) {
      return res.status(404).json({ message: 'Property not found with the given PPC ID and phone number' });
    }

    res.status(200).json({ message: 'Property restored successfully', property });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});




router.get('/fetch-all-datas', async (req, res) => {
    try {

        // Fetch all users from the database
        const users = await AddModel.find({});

        // Return the fetched user data
        res.status(200).json({ message: 'All user data fetched successfully!', users });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching all user details.', error });
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

router.get('/fetch-active-users', async (req, res) => {
  try {
    const properties = await AddModel.find({ status: 'active' });
    const plans = await PricingPlans.find();
    const bills = await Bill.find();
    const followups = await FollowUp.find();

    const requiredFields = [
      'propertyMode', 'propertyType', 'price',
      'totalArea', 'areaUnit', 'salesType', 'postedBy'
    ];

    const processedProperties = properties.map((property) => {
      const isComplete = requiredFields.every(
        (field) =>
          property[field] !== undefined &&
          property[field] !== null &&
          String(property[field]).trim() !== ''
      );

      // Match pricing plan
      const matchedPlan = plans.find(plan =>
        Array.isArray(plan.phoneNumber)
          ? plan.phoneNumber.includes(property.phoneNumber)
          : plan.phoneNumber === property.phoneNumber
      );

      let planCreatedAt = 'N/A';
      let planExpiryDate = 'N/A';

      if (matchedPlan && matchedPlan.createdAt && matchedPlan.durationDays) {
        const planStart = new Date(matchedPlan.createdAt);
        const planExpiry = new Date(planStart.getTime() + (matchedPlan.durationDays - 1) * 24 * 60 * 60 * 1000);
        planCreatedAt = planStart.toLocaleDateString();
        planExpiryDate = planExpiry.toLocaleDateString();
      }

      // Match bill by phone or ppcId
      const matchedBill = bills.find(bill =>
        bill.ownerPhone === property.phoneNumber || bill.ppId === property.ppcId
      );

      let adminName = 'N/A';
      let billDate = 'N/A';
      let validity = 'N/A';
      let billExpiryDate = 'N/A';

      if (matchedBill) {
        adminName = matchedBill.adminName || 'N/A';
        billDate = matchedBill.billDate || 'N/A';
        validity = matchedBill.validity || 'N/A';

        if (billDate !== 'N/A' && validity !== 'N/A') {
          const billStart = new Date(billDate);
          const billExpiry = new Date(billStart.getTime() + (validity - 1) * 24 * 60 * 60 * 1000);
          billExpiryDate = billExpiry.toLocaleDateString();
        }
      }

      // Get latest follow-up admin
      const propertyFollowUps = followups
        .filter(fu => String(fu.ppcId) === String(property.ppcId))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const followUpAdminName = propertyFollowUps.length > 0
        ? propertyFollowUps[0]?.adminName || 'Unknown Admin'
        : 'N/A';

      return {
        ...property._doc,
        required: isComplete ? 'yes' : 'no',
        planName: matchedPlan?.name || 'N/A',
        planCreatedAt,
        planExpiryDate,
        packageType: matchedPlan?.packageType || 'N/A',
        planDuration: matchedPlan?.durationDays || 'N/A',
        adminName,
        billDate,
        validity,
        billExpiryDate,
        followUpAdminName,
        setPpcId: property.setPpcId || false,
        assignedPhoneNumber: property.setPpcId ? property.assignedPhoneNumber || null : null
      };
    });

    const filteredProperties = processedProperties.filter(p => p.required === "yes");

    res.status(200).json({
      message: 'Active properties with complete info fetched successfully!',
      users: filteredProperties
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching active user details.',
      error: error.message
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








router.put('/admin-delete', async (req, res) => {
  const { ppcId } = req.query;
  const { deletionReason } = req.body;

  // Validate ppcId is provided
  if (!ppcId) {
    return res.status(400).json({ message: 'PPC-ID is required.' });
  }

  // Validate deletion reason is provided
  if (!deletionReason || deletionReason.trim() === '') {
    return res.status(400).json({ message: 'Deletion reason is required.' });
  }

  try {
    // Update document with deletion information (soft delete)
    const updatedItem = await AddModel.findOneAndUpdate(
      { ppcId },
      {
        isDeleted: true,
        deletionReason: deletionReason.trim(),
        deletionDate: new Date()
      },
      { new: true } // Return the updated document
    );

    if (!updatedItem) {
      return res.status(404).json({ message: 'Item not found with the provided PPC-ID.' });
    }

    res.status(200).json({ 
      message: 'Item marked as deleted successfully!',
      data: updatedItem
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error marking item as deleted.', 
      error: error.message 
    });
  }
});

// Undo Delete by ppcId
router.put('/admin-undo-delete', async (req, res) => {
  const { ppcId } = req.query;

  // Validate ppcId is provided
  if (!ppcId) {
    return res.status(400).json({ message: 'PPC-ID is required.' });
  }

  try {
    // Restore the document by clearing deletion fields
    const restoredItem = await AddModel.findOneAndUpdate(
      { ppcId },
      {
        isDeleted: false,
        deletionReason: null,
        deletionDate: null
      },
      { new: true } // Return the updated document
    );

    if (!restoredItem) {
      return res.status(404).json({ message: 'Item not found with the provided PPC-ID.' });
    }

    res.status(200).json({ 
      message: 'Item restored successfully!',
      data: restoredItem
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error restoring item.', 
      error: error.message 
    });
  }
});

// Get all non-deleted items
router.get('/dddd', async (req, res) => {
  try {
    const items = await AddModel.find({ isDeleted: false });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all items including deleted (for admin view)
router.get('/allss', async (req, res) => {
  try {
    const items = await AddModel.find();
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/delete-datas', async (req, res) => {
  const { phoneNumber, ppcId } = req.query;
  const { deletionReason, deletionDate } = req.body;

  // Ensure at least one parameter is provided
  if (!phoneNumber && !ppcId) {
      return res.status(400).json({ message: 'Either phone number or PPC-ID is required.' });
  }

  // Validate deletion reason is provided
  if (!deletionReason || deletionReason.trim() === '') {
      return res.status(400).json({ message: 'Deletion reason is required.' });
  }

  try {
      // Normalize phone number (remove spaces, dashes, country code, and ensure consistency)
      const normalizedPhoneNumber = phoneNumber
          ? phoneNumber.replace(/[\s-]/g, '').replace(/^(\+91|91|0)/, '').trim()
          : null;

      // Build query dynamically based on the provided parameters
      const query = {};
      if (normalizedPhoneNumber) query.phoneNumber = new RegExp(normalizedPhoneNumber + '$');
      if (ppcId) query.ppcId = ppcId;

      // Update document with deletion information (soft delete)
      const updatedUser = await AddModel.findOneAndUpdate(
          query,
          {
              $set: {
                  status: 'delete',
                  deletionReason: deletionReason.trim(),
                  deletionDate: deletionDate || new Date()
              }
          },
          { new: true } // Return the updated document
      );

      // Check if user was found and updated
      if (!updatedUser) {
          return res.status(404).json({ message: 'User not found.' });
      }

      // Return success response
      res.status(200).json({ 
          message: 'User marked as deleted successfully!',
          updatedUser 
      });
  } catch (error) {
      res.status(500).json({ 
          message: 'Error marking user as deleted.', 
          error: error.message 
      });
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
      property.deletedBy = 'User'; 
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



router.get('/properties/deleted', async (req, res) => {
  try {
    const deletedProperties = await AddModel.find({ status: 'delete' });
    const plans = await PricingPlans.find();
    const bills = await Bill.find();

    const processedDeleted = await Promise.all(deletedProperties.map(async property => {
      const matchedPlan = plans.find(plan =>
        Array.isArray(plan.phoneNumber)
          ? plan.phoneNumber.includes(property.phoneNumber)
          : plan.phoneNumber === property.phoneNumber
      );

      let planCreatedAt = 'N/A';
      let planExpiryDate = 'N/A';

      if (matchedPlan?.createdAt && matchedPlan?.durationDays) {
        const expiry = new Date(matchedPlan.createdAt).getTime() + matchedPlan.durationDays * 24 * 60 * 60 * 1000;
        planCreatedAt = new Date(matchedPlan.createdAt).toLocaleDateString();
        planExpiryDate = new Date(expiry).toLocaleDateString();
      }

      const matchedBill = bills.find(bill =>
        bill.ownerPhone === property.phoneNumber || bill.ppId === property.ppcId
      );

      let adminOffice = 'N/A';
      let adminName = 'N/A';
      let billNo = 'N/A';
      let billDate = 'N/A';
      let validity = 'N/A';
      let billExpiryDate = 'N/A';

      if (matchedBill) {
        adminOffice = matchedBill.adminOffice || 'N/A';
        adminName = matchedBill.adminName || 'N/A';
        billNo = matchedBill.billNo || 'N/A';
        billDate = matchedBill.billDate || 'N/A';
        validity = matchedBill.validity || 'N/A';

        if (billDate !== 'N/A' && validity !== 'N/A') {
          const billStart = new Date(billDate).getTime();
          const billExp = billStart + validity * 24 * 60 * 60 * 1000;
          billExpiryDate = new Date(billExp).toLocaleDateString();
        }
      }

      // ✅ Calculate total number of ads posted by this phoneNumber
      const adsCount = await AddModel.countDocuments({
        phoneNumber: property.phoneNumber,
        status: { $ne: 'delete' }
      });

      // ✅ Check required fields
      const requiredFields = [
        'propertyMode', 'propertyType', 'price',
        'totalArea', 'areaUnit',
        'salesType', 'postedBy'
      ];

      const required = requiredFields.every(field => property[field] !== undefined && property[field] !== null && property[field] !== '')
        ? 'Yes'
        : 'No';

      return {
        ...property._doc,
        planName: matchedPlan?.name || 'N/A',
        planCreatedAt,
        planExpiryDate,
        packageType: matchedPlan?.packageType || 'N/A',
        planDuration: matchedPlan?.durationDays || 'N/A',
        adminOffice,
        adminName,
        billNo,
        billDate,
        validity,
        billExpiryDate,
        adsCount,
        required, 
  //        deletedBy: property.deletedBy || 'User',
  // deletedAt: property.deletedAt ? new Date(property.deletedAt).toLocaleDateString() : 'N/A'
      };
    }));

    res.status(200).json({
      message: 'Deleted properties fetched successfully.',
      data: processedDeleted,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching deleted properties.',
      error: error.message,
    });
  }
});



// router.get('/properties/pending', async (req, res) => {
//   try {
//     const pendingProperties = await AddModel.find({ status: 'incomplete' });

//     res.status(200).json({
//       message: 'Pending properties fetched successfully.',
//       data: pendingProperties,
//     });
//   } catch (error) {
//     res.status(500).json({
//       message: 'Error fetching pending properties.',
//       error: error.message,
//     });
//   }
// });


router.get('/properties/pending', async (req, res) => {
  try {
    const users = await AddModel.find({ status: 'incomplete' });
    const plans = await PricingPlans.find();

    // ✅ Step 1: Calculate ads count per phone number across all properties
    const allProperties = await AddModel.find({});
    const adsCountByUser = allProperties.reduce((acc, property) => {
      const phone = property.phoneNumber;
      if (!acc[phone]) {
        acc[phone] = 1;
      } else {
        acc[phone]++;
      }
      return acc;
    }, {});

    const requiredFields = [
      'propertyMode', 'propertyType', 'price',
      'totalArea', 'areaUnit',
      'salesType', 'postedBy'
    ];

    const incompleteUsers = users.map((user) => {
      const isComplete = requiredFields.every(
        (field) =>
          user[field] !== undefined &&
          user[field] !== null &&
          String(user[field]).trim() !== ''
      );

      // Match plan
      const matchedPlan = plans.find(plan =>
        Array.isArray(plan.phoneNumber)
          ? plan.phoneNumber.includes(user.phoneNumber)
          : plan.phoneNumber === user.phoneNumber
      );

      let planCreatedAt = 'N/A';
      let planExpiryDate = 'N/A';

      if (matchedPlan && matchedPlan.createdAt && matchedPlan.durationDays) {
        const expiryDate = new Date(matchedPlan.createdAt).getTime() + matchedPlan.durationDays * 24 * 60 * 60 * 1000;
        planCreatedAt = new Date(matchedPlan.createdAt).toLocaleDateString();
        planExpiryDate = new Date(expiryDate).toLocaleDateString();
      }

      return {
        ...user._doc,
        required: isComplete ? "yes" : "no",
        planName: matchedPlan?.name || 'N/A',
        planCreatedAt,
        planExpiryDate,
        packageType: matchedPlan?.packageType || 'N/A',
        planDuration: matchedPlan?.durationDays || 'N/A',
        adsCount: adsCountByUser[user.phoneNumber] || 0, // ✅ Include ad count
      };
    }).filter(user => user.required === "no");

    res.status(200).json({
      message: "Pending properties with incomplete required fields and plan info fetched successfully!",
      users: incompleteUsers
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching pending properties.',
      error: error.message
    });
  }
});


router.get('/properties/pre-approved', async (req, res) => {
  try {
    const users = await AddModel.find({ status: 'complete' });
    const plans = await PricingPlans.find();

    // ✅ Step 1: Get all properties and compute ad count per phoneNumber
    const allProperties = await AddModel.find({});
    const adsCountByUser = allProperties.reduce((acc, property) => {
      const phone = property.phoneNumber;
      acc[phone] = (acc[phone] || 0) + 1;
      return acc;
    }, {});

    const requiredFields = [
      'propertyMode', 'propertyType', 'price',
      'totalArea', 'areaUnit',
      'salesType', 'postedBy'
    ];

    const completeUsers = users.map((user) => {
      const isComplete = requiredFields.every((field) => {
        const value = user[field];
        return value !== undefined && value !== null && String(value).trim() !== '';
      });

      const matchedPlan = plans.find(plan =>
        Array.isArray(plan.phoneNumber)
          ? plan.phoneNumber.includes(user.phoneNumber)
          : plan.phoneNumber === user.phoneNumber
      );

      let planCreatedAt = 'N/A';
      let planExpiryDate = 'N/A';

      if (matchedPlan && matchedPlan.createdAt && matchedPlan.durationDays) {
        const expiryDate = new Date(matchedPlan.createdAt).getTime() + matchedPlan.durationDays * 24 * 60 * 60 * 1000;
        planCreatedAt = new Date(matchedPlan.createdAt).toLocaleDateString();
        planExpiryDate = new Date(expiryDate).toLocaleDateString();
      }

      return {
        ...user._doc,
        required: isComplete ? "yes" : "no",
        planName: matchedPlan?.name || 'N/A',
        planCreatedAt,
        planExpiryDate,
        packageType: matchedPlan?.packageType || 'N/A',
        planDuration: matchedPlan?.durationDays || 'N/A',
        adsCount: adsCountByUser[user.phoneNumber] || 0  // ✅ Added ads count
      };
    }).filter(user => user.required === "yes");

    res.status(200).json({
      message: "Pre-approved properties with complete required fields and plan info fetched successfully!",
      users: completeUsers
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching pre-approved properties.',
      error: error.message
    });
  }
});

router.get('/approved-properties-count', async (req, res) => {
  try {
    // Count documents where propertyApproved is 'yes'
    const count = await AddModel.countDocuments({ propertyApproved: "yes" });

    res.status(200).json({ approvedProperties: count });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});


module.exports = router;





























