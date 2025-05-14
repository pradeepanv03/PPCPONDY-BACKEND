

const express = require("express");
const router = express.Router();
const PhotoRequest = require("../Photo/PhotoRequestModel");
const Property = require("../AddModel"); // Ensure correct path
const AddModel = require("../AddModel");
const NotificationUser = require('../Notification/NotificationDetailModel');



const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Set up multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDirectory = "uploads/";
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
            return cb(new Error("Only image and video files (JPEG, PNG, GIF, MP4, AVI, MOV) are allowed!"), false);
        }
    },
});


router.get("/photo-requests", async (req, res) => {
  try {
    const photoRequests = await PhotoRequest.find().lean();
    res.status(200).json({ success: true, message: "Photo requests fetched successfully.", data: photoRequests });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
});

// ✅ Fetch All Properties
router.get("/properties", async (req, res) => {
  try {
    const properties = await AddModel.find().lean();
    res.status(200).json({ success: true, message: "Properties fetched successfully.", data: properties });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
});




// Function to get photo request
const getPhotoRequest = async (req, res) => {
  try {
    const { ppcId, requesterPhoneNumber } = req.params;
    const request = await PhotoRequest.findOne({ ppcId, requesterPhoneNumber });

    if (!request) {
      return res.status(404).json({ message: "Photo request not found." });
    }

    res.status(200).json({
      message: "Photo request retrieved successfully.",
      request,
      photoURL: request.photoURL || null, // Ensure photoURL is included
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// Define the route
router.get("/photos/get/:ppcId/:requesterPhoneNumber", getPhotoRequest);



router.put("/photos/send/:ppcId/:requesterPhoneNumber", upload.single("photo"), async (req, res) => {
  try {
      const { ppcId, requesterPhoneNumber } = req.params;

      // Find the request in the database
      const request = await PhotoRequest.findOne({ ppcId, requesterPhoneNumber });

      if (!request) {
          return res.status(404).json({ message: "Photo request not found." });
      }

      if (!req.file) {
          return res.status(400).json({ message: "No photo uploaded." });
      }

      // Save the uploaded file URL
      request.photoURL = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
      request.status = "photo send";
      request.updatedAt = new Date();

      await request.save();

      res.status(200).json({
          message: "Photo uploaded successfully.",
          request,
          photoURL: request.photoURL,
      });
  } catch (error) {
      res.status(500).json({ message: "Error uploading photo.", error: error.message });
  }
});


router.get("/photos/get-all", async (req, res) => {
  try {
    const requests = await PhotoRequest.find({ status: "photo send" }).select("ppcId requesterPhoneNumber status photoPath");

    if (!requests.length) {
      return res.status(404).json({ message: "No photo requests with 'photo send' status found." });
    }

    res.status(200).json({ requests });
  } catch (error) {
    res.status(500).json({ message: "Error fetching photo requests.", error: error.message });
  }
});


router.post("/photo-request", async (req, res) => {
  try {
    const { ppcId, requesterPhoneNumber } = req.body;

    if (!ppcId || !requesterPhoneNumber) {
      return res.status(400).json({ message: "ppcId and requesterPhoneNumber are required." });
    }

    // Check if a request already exists for this property and user
    const existingRequest = await PhotoRequest.findOne({ ppcId, requesterPhoneNumber });
    if (existingRequest) {
      return res.status(409).json({ message: "You have already sent a photo request for this property." });
    }

    // Fetch Property Details
    const property = await Property.findOne({ ppcId });
    if (!property) {
      return res.status(404).json({ message: "Property not found." });
    }

    // Create a New Photo Request
    const photoRequest = new PhotoRequest({
      ppcId,
      requesterPhoneNumber,
      postedUserPhoneNumber: property.phoneNumber, // Owner's phone
      propertyMode: property.propertyMode,
      price: property.price,
      propertyType: property.propertyType,
      city: property.city,
      district: property.district,
      area: property.area,
      streetName: property.streetName,
      bestTimeToCall: property.bestTimeToCall,
      length: property.length,
      breadth: property.breadth,
      totalArea: property.totalArea,
      ownership: property.ownership,
      photoURL: property.photoURL,
      status: "photo request pending",
    });

    await photoRequest.save();

    // ✅ Add Notification for the property owner
    try {
      await NotificationUser.create({
        recipientPhoneNumber: property.phoneNumber, // Property owner's number
        senderPhoneNumber: requesterPhoneNumber,     // Who sent the request
        ppcId,
        message: `User ${requesterPhoneNumber} requested photos for your property.`,
        createdAt: new Date()
      });
    } catch (notifErr) {
    }

    res.status(201).json({
      message: "Photo request submitted successfully.",
      photoRequest
    });
  } catch (error) {
    res.status(500).json({ message: "Error submitting photo request.", error: error.message });
  }
});



function normalizePhoneNumber(phoneNumber) {
    phoneNumber = phoneNumber.replace(/\D/g, ""); // Remove non-numeric characters
    if (phoneNumber.startsWith("91") && phoneNumber.length === 12) {
        phoneNumber = phoneNumber.slice(2); // Remove "+91" if present
    }
    return phoneNumber;
}


// ✅ Get Photo Requests for a Specific Buyer (with property details)
router.get("/photo-requests/owner/:phoneNumber", async (req, res) => {
  try {
    let phoneNumber = normalizePhoneNumber(req.params.phoneNumber);

    // Find all photo requests made by this buyer
    const buyerRequests = await PhotoRequest.find({
      $or: [
        { requesterPhoneNumber: phoneNumber },
        { requesterPhoneNumber: `+91${phoneNumber}` },
        { requesterPhoneNumber: `91${phoneNumber}` },
      ],
    });

    if (buyerRequests.length === 0) {
      return res
        .status(404)
        .json({ message: "No photo requests found for this buyer." });
    }

    const propertyDetails = await Promise.all(
      buyerRequests.map(async (request) => {
        const property = await Property.findOne({ ppcId: request.ppcId });

        // If property is not found, return default/fallback values
        if (!property) {
          return {
            _id: request._id,
            ppcId: request.ppcId,
            propertyMode: "N/A",
            price: 0,
            propertyType: "N/A",
            totalArea: "N/A",
            bedrooms: "N/A",
            ownership: "N/A",
            bestTimeToCall: "N/A",
            area: "N/A",
            areaunit:"N/A",
            status: request.status,
            photos: [],
            postedUserPhoneNumber: request.postedUserPhoneNumber || "N/A",
            createdAt: request.createdAt || null,
            updatedAt: request.updatedAt || null,
          };
        }

        // If property is found, return full data
        return {
          _id: request._id,
          ppcId: request.ppcId,
          propertyMode: property.propertyMode || "N/A",
          price: property.price || 0,
          propertyType: property.propertyType || "N/A",
          totalArea: property.totalArea || "N/A",
          bedrooms: property.bedrooms || "N/A",
          ownership: property.ownership || "N/A",
          bestTimeToCall: property.bestTimeToCall || "N/A",
          area: property.area || "N/A",
          areaunit:property.areaUnit || "N/A",
          status: request.status,
          photos: property.photos || [],
          
          photoURL: request.photoURL || null,

          postedUserPhoneNumber: request.postedUserPhoneNumber || "N/A",
          createdAt: request.createdAt || null,
          updatedAt: request.updatedAt || null,
        };
      })
    );
    res.status(200).json(propertyDetails);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching buyer's photo requests.",
      error: error.message,
    });
  }
});


// ✅ **Get Photo Requests Received by a Property Owner**
router.get("/photo-requests/buyer/:phoneNumber", async (req, res) => {
    try {
        let phoneNumber = normalizePhoneNumber(req.params.phoneNumber);

        // Find all photo requests received by this owner
        const ownerRequests = await PhotoRequest.find({
            $or: [
                { postedUserPhoneNumber: phoneNumber },
                { postedUserPhoneNumber: `+91${phoneNumber}` },
                { postedUserPhoneNumber: `91${phoneNumber}` }
            ]
        });

        if (ownerRequests.length === 0) {
            return res.status(404).json({ message: "No photo requests found for this owner." });
        }

        // Fetch property details for each request
        const propertyDetails = await Promise.all(
            ownerRequests.map(async (request) => {
                const property = await  Property.findOne({ ppcId: request.ppcId });
                return {
                  _id: request._id, 
                    ppcId: request.ppcId,
                    requesterPhoneNumber: request.requesterPhoneNumber, // Buyer's phone
                    propertyMode: property?.propertyMode || "",
                    price: property?.price || 0,
                    propertyType: property?.propertyType || "",
                    // totalArea:property.totalArea,
                    // bedrooms:property.bedrooms,
                    // ownership:property.ownership,
                    // bestTimeToCall:property.bestTimeToCall,
                    city:property?.city || "",
                    status: request.status,
                    createdAt: request.createdAt,
                    updatedAt: request.updatedAt,
                    photoURL: request.photoURL || null,
                    createdAt:request.createdAt || null,

                };
            })
        );

        res.status(200).json(propertyDetails);
    } catch (error) {
        res.status(500).json({ message: "Error fetching owner's photo requests.", error: error.message });
    }
});

// ✅ Fetch Photo Request Count for an Owner
router.get("/photo-requests/owner/count/:phoneNumber", async (req, res) => {
  try {
      let phoneNumber = req.params.phoneNumber.replace(/\D/g, ""); // Remove non-numeric characters

      if (phoneNumber.startsWith("91") && phoneNumber.length === 12) {
          phoneNumber = phoneNumber.slice(2); // Convert '917878789090' → '7878789090'
      }


      // Count photo requests received by the property owner
      const photoRequestCount = await PhotoRequest.countDocuments({
          $or: [
              { requesterPhoneNumber
                : phoneNumber },
              { requesterPhoneNumber
                : `+91${phoneNumber}` },
              { requesterPhoneNumber
                : `91${phoneNumber}` }
          ]
      });


      return res.status(200).json({ photoRequestCount });

  } catch (error) {
      return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});


// ✅ Fetch Photo Requests Count
router.get("/photo-requests/buyer/count/:phoneNumber", async (req, res) => {
  try {
      let phoneNumber = req.params.phoneNumber.replace(/\D/g, ""); // Remove non-numeric characters

      if (phoneNumber.startsWith("91") && phoneNumber.length === 12) {
          phoneNumber = phoneNumber.slice(2); // Convert '917878789090' → '7878789090'
      }

      // Count photo requests received by the property owner
      const photoRequestsCount = await PhotoRequest.countDocuments({
          $or: [
              { postedUserPhoneNumber: phoneNumber },
              { postedUserPhoneNumber: `+91${phoneNumber}` },
              { postedUserPhoneNumber: `91${phoneNumber}` }
          ]
      });

      return res.status(200).json({ photoRequestsCount });

  } catch (error) {
      return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});



router.get("/property/:ppcId", async (req, res) => {
  try {
    const { ppcId } = req.params;

    // Fetch Property Details
    const property = await Property.findOne({ ppcId });

    if (!property) {
      return res.status(404).json({ message: "Property not found." });
    }

    res.status(200).json(property);
  } catch (error) {
    res.status(500).json({ message: "Error fetching property details.", error: error.message });
  }
});


// ✅ **Get All Photo Requests**
router.get("/all-photo-requests", async (req, res) => {
  try {
    const photoRequests = await PhotoRequest.find().sort({ createdAt: -1 });
    res.status(200).json(photoRequests);
  } catch (error) {
    res.status(500).json({ message: "Error fetching photo requests.", error: error.message });
  }
});



// ✅ Send photo (Update photoURL and status)
router.put("/send-photo/:id", async (req, res) => {
  const { photoURL } = req.body;
  try {
    const request = await PhotoRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    request.previousStatus = request.status;
    request.photoURL = photoURL;
    request.status = "photo send";

    await request.save();
    res.status(200).json({ message: "Photo sent successfully!", request });
  } catch (error) {
    res.status(500).json({ message: "Error updating request.", error: error.message });
  }
});

// ✅ Reject photo request
router.put("/reject-photo/:id", async (req, res) => {
  try {
    const request = await PhotoRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    request.previousStatus = request.status;
    request.status = "photo request rejected";

    await request.save();
    res.status(200).json({ message: "Photo request rejected!", request });
  } catch (error) {
    res.status(500).json({ message: "Error updating request.", error: error.message });
  }
});

// ✅ Delete photo request
router.delete("/delete-photo-request/:id", async (req, res) => {
  try {
    const request = await PhotoRequest.findByIdAndDelete(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    res.status(200).json({ message: "Photo request deleted successfully!" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting request.", error: error.message });
  }
});

// ✅ Edit photo request details (Update price, propertyType, etc.)
router.put("/update-photo-request/:id", async (req, res) => {
  try {
    const updatedRequest = await PhotoRequest.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedRequest) return res.status(404).json({ message: "Request not found" });

    res.status(200).json({ message: "Photo request updated successfully!", updatedRequest });
  } catch (error) {
    res.status(500).json({ message: "Error updating request.", error: error.message });
  }
});



// ✅ **Get Photo Request by ID**
router.get("/photo-request/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const photoRequest = await PhotoRequest.findById(id);

    if (!photoRequest) {
      return res.status(404).json({ message: "Photo request not found." });
    }

    res.status(200).json(photoRequest);
  } catch (error) {
    res.status(500).json({ message: "Error fetching photo request.", error: error.message });
  }
});


// ✅ **Update Photo Request Status by ID**
router.put("/photo-request/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updatedPhotoRequest = await PhotoRequest.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedPhotoRequest) {
      return res.status(404).json({ message: "Photo request not found." });
    }

    res.status(200).json({ message: "Photo request updated successfully.", updatedPhotoRequest });
  } catch (error) {
    res.status(500).json({ message: "Error updating photo request.", error: error.message });
  }
});

// ✅ **Delete Photo Request by ID**
router.delete("/photo-request/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const deletedPhotoRequest = await PhotoRequest.findByIdAndDelete(id);

    if (!deletedPhotoRequest) {
      return res.status(404).json({ message: "Photo request not found." });
    }

    res.status(200).json({ message: "Photo request deleted successfully." });
  } catch (error) 
  {
    res.status(500).json({ message: "Error deleting photo request.", error: error.message });
  }
});


router.put("/photo-requests/undo/:ppcId", async (req, res) => {
  try {
      const request = await PhotoRequest.findOne({ ppcId: req.params.ppcId });

      if (!request) {
          return res.status(404).json({ message: "Photo request not found." });
      }

      if (!request.previousStatus) {
          return res.status(400).json({ message: "No previous status found to restore." });
      }

      // Restore previous status
      request.status = request.previousStatus;
      request.previousStatus = ""; // Clear previous status

      await request.save();

      res.status(200).json({ message: "Photo request restored to previous status.", request });
  } catch (error) {
      res.status(500).json({ message: "Error undoing delete.", error: error.message });
  }
});


router.put("/photo-requests/delete/:ppcId", async (req, res) => {
  try {
      const request = await PhotoRequest.findOne({ ppcId: req.params.ppcId });

      if (!request) {
          return res.status(404).json({ message: "Photo request not found." });
      }

      // Save previous status before updating
      request.previousStatus = request.status;
      request.status = "deleted";

      await request.save();

      res.status(200).json({ message: "Photo request marked as deleted.", request });
  } catch (error) {
      res.status(500).json({ message: "Error deleting photo request.", error: error.message });
  }
});



router.put("/photo-requests/delete/:ppcId/:phoneNumber", async (req, res) => {
  try {
      const { ppcId, phoneNumber } = req.params;

      const request = await PhotoRequest.findOne({
          ppcId: ppcId,
          requesterPhoneNumber: phoneNumber // Ensure it's linked to the correct request
      });

      if (!request) {
          return res.status(404).json({ message: "Photo request not found." });
      }

      request.previousStatus = request.status; // Store previous status
      request.status = "deleted";

      await request.save();

      res.status(200).json({ message: "Photo request marked as deleted.", request });
  } catch (error) {
      res.status(500).json({ message: "Error deleting photo request.", error: error.message });
  }
});

router.put("/photo-requests/undo/:ppcId/:phoneNumber", async (req, res) => {
  try {
      const { ppcId, phoneNumber } = req.params;

      const request = await PhotoRequest.findOne({
          ppcId: ppcId,
          requesterPhoneNumber: phoneNumber // Ensure it's linked correctly
      });

      if (!request) {
          return res.status(404).json({ message: "Photo request not found." });
      }

      if (!request.previousStatus) {
          return res.status(400).json({ message: "No previous status found to restore." });
      }

      request.status = request.previousStatus;
      request.previousStatus = ""; // Clear previous status

      await request.save();

      res.status(200).json({ message: "Photo request restored to previous status.", request });
  } catch (error) {
      res.status(500).json({ message: "Error undoing delete.", error: error.message });
  }
});



router.put("/photo-requests/send/:ppcId", async (req, res) => {
  try {
    const { ppcId } = req.params;

    const request = await PhotoRequest.findOne({ ppcId });

    if (!request) {
      return res.status(404).json({ message: "Photo request not found." });
    }

   

    request.status = "photo send";

    await request.save();

    res.status(200).json({ message: "Photo request restored to previous status.", request });
  } catch (error) {
    res.status(500).json({ message: "Error restoring photo request.", error: error.message });
  }
});


router.put("/photo-requests/reject/:ppcId", async (req, res) => {
  try {
    const { ppcId } = req.params;
    const { requesterPhoneNumber } = req.body; // Get requesterPhoneNumber from request body

    const request = await PhotoRequest.findOne({ ppcId, requesterPhoneNumber });

    if (!request) {
      return res.status(404).json({ message: "Photo request not found." });
    }

    request.previousStatus = request.status; // Store previous status
    request.status = "photo request rejected";

    await request.save();

    res.status(200).json({ message: "Photo request rejected.", request });
  } catch (error) {
    res.status(500).json({ message: "Error rejecting photo request.", error: error.message });
  }
});



router.put("/reject-photo-request", async (req, res) => {
    try {
        const { ppcId, requesterPhoneNumber } = req.body;

        if (!ppcId || !requesterPhoneNumber) {
            return res.status(400).json({ message: "Missing required fields." });
        }

        // Normalize phone number format
        let formattedPhoneNumber = requesterPhoneNumber.replace(/\D/g, "");
        if (formattedPhoneNumber.startsWith("91") && formattedPhoneNumber.length === 12) {
            formattedPhoneNumber = formattedPhoneNumber.slice(2);
        }

        // Find the photo request
        const photoRequest = await PhotoRequest.findOne({
            ppcId,
            phoneNumber: { $regex: `${formattedPhoneNumber}$`, $options: "i" },
        });

        if (!photoRequest) {
            return res.status(404).json({ message: "Photo request not found for the given property and requester." });
        }

        // Store previous status before updating
        photoRequest.previousStatus = photoRequest.status;
        photoRequest.status = "photo request rejected";
        await photoRequest.save();

        res.status(200).json({ message: "Photo request rejected successfully.", photoRequest });

    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});


router.put("/accept-photo-request", async (req, res) => {
  try {
      const { ppcId, requesterPhoneNumber } = req.body;

      if (!ppcId || !requesterPhoneNumber) {
          return res.status(400).json({ message: "Missing required fields." });
      }

      // Normalize phone number format
      let formattedPhoneNumber = requesterPhoneNumber.replace(/\D/g, "");
      if (formattedPhoneNumber.startsWith("91") && formattedPhoneNumber.length === 12) {
          formattedPhoneNumber = formattedPhoneNumber.slice(2);
      }


      // Find the offer
      const photoRequest = await PhotoRequest.findOne({
          ppcId,
          phoneNumber: { $regex: `${formattedPhoneNumber}$`, $options: "i" },
      });

      if (!photoRequest) {
          return res.status(404).json({ message: "Photo request not found for the given property and requester." });
      }

      // ✅ Update status to "accept"
      photoRequest.status = "photo send";
      await offer.save();

      res.status(200).json({ message: "photo accepted successfully."});

  } catch (error) {
      res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

router.put("/accept-photorequest", async (req, res) => {
  try {
      const { ppcId, requesterPhoneNumber } = req.body;

      if (!ppcId || !requesterPhoneNumber) {
          return res.status(400).json({ message: "Missing required fields." });
      }

      // Normalize phone number format
      let formattedPhoneNumber = requesterPhoneNumber.replace(/\D/g, "");
      if (formattedPhoneNumber.startsWith("91") && formattedPhoneNumber.length === 12) {
          formattedPhoneNumber = formattedPhoneNumber.slice(2);
      }

      // ✅ Use `PhotoRequest` (the correct Mongoose model)
      const photoRequest = await PhotoRequest.findOne({
          ppcId,
          requesterPhoneNumber: { $regex: `${formattedPhoneNumber}$`, $options: "i" }, // Fix key name
      });

      if (!photoRequest) {
          return res.status(404).json({ message: "Photo request not found for the given property and requester." });
      }

      // ✅ Update status to "photo send"
      photoRequest.previousStatus = photoRequest.status;
      photoRequest.status = "photo send";
      await photoRequest.save(); // ✅ Fix model name

      res.status(200).json({
        message: "Photo request accepted successfully.",
        ppcId: photoRequest.ppcId,
        requesterPhoneNumber: photoRequest.requesterPhoneNumber,
        postedUserPhoneNumber: photoRequest.postedUserPhoneNumber,
        status: photoRequest.status,
      });

  } catch (error) {
      res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});



router.put("/photos/edit/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updatedData = req.body;

    const request = await PhotoRequest.findByIdAndUpdate(id, updatedData, { new: true });

    if (!request) {
      return res.status(404).json({ message: "Photo request not found." });
    }

    res.status(200).json({ message: "Photo request updated successfully.", request });
  } catch (error) {
    res.status(500).json({ message: "Error updating photo request.", error: error.message });
  }
});

module.exports = router;
