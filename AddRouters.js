
const express = require('express');
const router = express.Router();
const AddModel = require('./AddModel');
const UserViewsModel = require("./ViewsModel");


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


router.post("/user-viewed-property", async (req, res) => {
  try {
    const { phoneNumber, ppcId } = req.body;

    if (!phoneNumber || !ppcId) {
      return res.status(400).json({ message: "phoneNumber and ppcId are required" });
    }

    // Normalize phone number (remove spaces and '+')
    const normalizedPhoneNumber = phoneNumber.replace(/\s+/g, "").replace(/\+/g, "");

    // Check if the property exists
    const property = await AddModel.findOne({ ppcId });
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    const propertyOwnerPhoneNumber = property.phoneNumber; // Property owner's phone number

    // ✅ Step 1: Find or create UserViews entry
    let userViews = await UserViewsModel.findOne({ phoneNumber: normalizedPhoneNumber });

    if (!userViews) {
      userViews = new UserViewsModel({
        phoneNumber: normalizedPhoneNumber,
        viewedProperties: [
          { ppcId, propertyOwnerPhoneNumber, viewedAt: new Date() },
        ],
      });
    } else {
      // Check if the property is already viewed by this user
      const alreadyViewed = userViews.viewedProperties.some((view) => view.ppcId === ppcId);

      if (!alreadyViewed) {
        userViews.viewedProperties.push({
          ppcId,
          propertyOwnerPhoneNumber,
          viewedAt: new Date(),
        });
      }
    }

    // ✅ Step 2: Save UserViews
    await userViews.save();

    // ✅ Step 3: Increment view count in AddModel
    await AddModel.updateOne({ ppcId }, { $inc: { views: 1 } });

    res.status(200).json({ message: "Property view recorded successfully" });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
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


// ✅ Delete property (Soft Delete & Remove from UserViews)
router.put("/delete-view-property", async (req, res) => {
  const { ppcId, phoneNumber } = req.body;

  if (!ppcId || !phoneNumber) {
    return res.status(400).json({ message: "ppcId and phoneNumber are required." });
  }

  try {
    // Find the property by its ppcId
    const property = await AddModel.findOne({ ppcId });

    if (!property) {
      return res.status(404).json({ message: "Property not found." });
    }

    // Mark the property as deleted
    property.status = "delete";
    await property.save();

    // Remove the property from the user's viewed list
    await UserViewsModel.findOneAndUpdate(
      { phoneNumber },
      { $pull: { viewedProperties: ppcId,viewedProperties: phoneNumber } },
      { new: true }
    );

    return res.status(200).json({ message: "Property removed successfully.", property });
  } catch (error) {
    return res.status(500).json({ message: "Error removing property.", error: error.message });
  }
});

// ✅ Undo Delete Property (Restore Status & Add Back to UserViews)
router.put("/undo-delete-view", async (req, res) => {
  const { ppcId, phoneNumber } = req.body;

  if (!ppcId || !phoneNumber) {
    return res.status(400).json({ message: "ppcId and phoneNumber are required." });
  }

  try {
    // Find the property
    const property = await AddModel.findOne({ ppcId });

    if (!property) {
      return res.status(404).json({ message: "Property not found." });
    }

    // Restore property status
    property.status = "active";
    await property.save();

    // Re-add property to the user's viewed list if it's not already there
    await UserViewsModel.findOneAndUpdate(
      { phoneNumber },
      { $addToSet: { viewedProperties: ppcId ,viewedProperties: phoneNumber} }, // Ensures no duplicates
      { upsert: true, new: true }
    );

    return res.status(200).json({ message: "Property restored successfully!", property });
  } catch (error) {
    return res.status(500).json({ message: "Error restoring property.", error: error.message });
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
      bestTimeToCall
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
        attachedBathrooms, western, numberOfFloors, carParking, bestTimeToCall
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
        'phoneNumber', 'price', 'rentalPropertyAddress', 'state', 'city', 'district',
        'area', 'streetName', 'doorNumber', 'nagar', 'ownerName', 'email', 'propertyMode',
        'propertyType', 'ownership', 'bedrooms', 'kitchen', 'floorNo', 'areaUnit',
        'propertyApproved', 'propertyAge', 'postedBy', 'facing', 'salesMode', 'salesType',
        'furnished', 'carParking'
      ];


      const isComplete = requiredFields.every((field) => user[field]);
      user.status = isComplete ? "complete" : "incomplete"; 
      

      await user.save();

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

router.get('/fetch-all-data', async (req, res) => {
  try {
    const users = await AddModel.find({}, {
      phoneNumber: 1, ppcId: 1, propertyMode: 1, propertyType: 1, city: 1,
      area: 1, price: 1, propertyAge: 1, facing: 1, bankLoan: 1,
      state: 1, district: 1, streetName: 1, ownerName: 1,
      email: 1, alternatePhone: 1, bestTimeToCall: 1, status: 1, // Ensure status is included
    });


    res.status(200).json({ message: 'All user data fetched successfully!', users });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching all user details.', error });
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


router.get('/fetch-active-users', async (req, res) => {
  try {
      // Fetch users with 'active' or 'delete' status
      const users = await AddModel.find({ status: { $in: ['active', 'delete','complete','sendInterest' , 'contact'] } });

      // Return the fetched user data
      res.status(200).json({ message: 'Active and deleted users fetched successfully!', users });
  } catch (error) {
      res.status(500).json({ message: 'Error fetching users.', error });
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
        status: { $in: ['incomplete', 'complete'] },
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
  
  router.get("/user-get-last-view/:phoneNumber", async (req, res) => {
    try {
      const { phoneNumber } = req.params;
  
      if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number is required" });
      }
  
      const digits = phoneNumber.replace(/\D/g, "").slice(-10);
  
      const variants = [
        "+91" + digits,
        "91" + digits,
        digits
      ];
  
  
      const userViews = await UserViewsModel.findOne({
        phoneNumber: { $in: variants }
      });
  
      if (!userViews || userViews.viewedProperties.length === 0) {
        return res.status(404).json({ message: "No viewed properties found" });
      }
  
      const sortedViews = userViews.viewedProperties.sort(
        (a, b) => new Date(b.viewedAt) - new Date(a.viewedAt)
      );
  
      const lastViewed = sortedViews[0];
  
      const property = await AddModel.findOne({ ppcId: lastViewed.ppcId });
  
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
  
      return res.status(200).json({
        property,
        viewedAt: lastViewed.viewedAt,
      });
    } catch (error) {
      res.status(500).json({ message: "Internal Server Error", error: error.message });
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


module.exports = router;





























