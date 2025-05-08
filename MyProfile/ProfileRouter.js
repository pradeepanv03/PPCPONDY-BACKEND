const express = require("express");
const ProfileData = require("../MyProfile/ProfileModel");
const AdminLogin = require('../Admin/AdminModel')


const router = express.Router();

const multer = require("multer");

// Configure file upload (multer)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });


router.post("/profile", upload.single("profileImage"), async (req, res) => {
  try {
    const { name, password, email, createdBy } = req.body; // 👈 Include createdBy
    const profileImage = req.file ? req.file.path : "";

    const count = await ProfileData.countDocuments();
    const pucNumber = `PUC${String(count + 1).padStart(3, "0")}`; // PUC001, PUC002

    const newProfile = new ProfileData({
      pucNumber,
      profileImage,
      name,
      password,
      email,
      createdBy, // 👈 Save admin name
    });

    await newProfile.save();

    res.status(201).json({ message: "Profile created successfully", data: newProfile });
  } catch (error) {
    res.status(500).json({ message: "Error creating profile", error });
  }
});



// Update Profile
router.put("/update-profile/:id", upload.single("profileImage"), async (req, res) => {
  try {
    const { pucNumber, name, password, email } = req.body;
    const profileImage = req.file ? req.file.path : req.body.profileImage;

    const updatedProfile = await ProfileData.findByIdAndUpdate(
      req.params.id,
      { pucNumber, profileImage, name, password, email },
      { new: true }
    );

    if (!updatedProfile) return res.status(404).json({ message: "Profile not found" });

    res.json({ message: "Profile updated successfully", data: updatedProfile });
  } catch (error) {
    res.status(500).json({ message: "Error updating profile", error });
  }
});

// Get All Profiles
router.get("/all-get-profiles", async (req, res) => {
  try {
    const profiles = await ProfileData.find();
    res.json({ message: "Profiles fetched successfully", data: profiles });
  } catch (error) {
    res.status(500).json({ message: "Error fetching profiles", error });
  }
});

// Get Only Profiles That Have a pucNumber
router.get("/all-get-puc-profiles", async (req, res) => {
  try {
    const profiles = await ProfileData.find({
      pucNumber: { $exists: true, $ne: null, $ne: "" }
    });

    res.json({ message: "Profiles fetched successfully", data: profiles });
  } catch (error) {
    res.status(500).json({ message: "Error fetching profiles", error });
  }
});



// Delete Profile
router.delete("/delete-profile/:id", async (req, res) => {
  try {
    const deletedProfile = await ProfileData.findByIdAndDelete(req.params.id);

    if (!deletedProfile) return res.status(404).json({ message: "Profile not found" });

    res.json({ message: "Profile deleted successfully", data: deletedProfile });
  } catch (error) {
    res.status(500).json({ message: "Error deleting profile", error });
  }
});


// Create Profile
router.post("/profile-create", async (req, res) => {
  try {
    const { name, email, mobile, address } = req.body;

    const existingUser = await ProfileData.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const newProfile = new ProfileData({ name, email, mobile, address });
    await newProfile.save();

    res.status(201).json({ message: "Profile created successfully", ProfileData: newProfile });
  } catch (error) {
    res.status(500).json({ message: "Error creating profile", error });
  }
});



// Get All Profiles
router.get("/profiles", async (req, res) => {
  try {
    const profiles = await ProfileData.find();
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ message: "Error fetching profiles", error });
  }
});

// Get Profile by ID
router.get("/profile/:id", async (req, res) => {
  try {
    const profile = await ProfileData.findById(req.params.id);
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: "Error fetching profile", error });
  }
});

router.get("/profile/:mobile", async (req, res) => {
  try {
    const { mobile } = req.params;
    const profile = await ProfileData.findOne({ mobile: mobile }); // Query by 'mobile' field

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.status(200).json(profile);
  } catch (error) {
    res.status(500).json({ message: "Error fetching profile", error });
  }
});


router.get("/profile/mobile/:mobile", async (req, res) => {
    try {
      const mobileNumber = req.params.mobile;
  
      const profile = await ProfileData.findOne({ mobile: mobileNumber });
      if (!profile) return res.status(404).json({ message: "Profile not found" });
  
      res.json(profile);
    } catch (error) {
      res.status(500).json({ message: "Error fetching profile", error: error.message });
    }
  });
  

// 🟢 Update Profile by Mobile Number
router.put("/profile/:mobile", async (req, res) => {
    try {
      const { name, email, address } = req.body;
  
      const updatedProfile = await ProfileData.findOneAndUpdate(
        { mobile: req.params.mobile },
        { name, email, address }, // Do not update mobile
        { new: true, runValidators: true }
      );
  
      if (!updatedProfile) {
        return res.status(404).json({ message: "Profile not found" });
      }
  
      res.json({ message: "Profile updated successfully", ProfileData: updatedProfile });
    } catch (error) {
      res.status(500).json({ message: "Error updating profile", error: error.message });
    }
  });



  // Delete Profile by Mobile Number
  router.delete("/profile/:mobile", async (req, res) => {
    try {
      const deletedProfile = await ProfileData.findOneAndDelete({ mobile: req.params.mobile });
      if (!deletedProfile) return res.status(404).json({ message: "Profile not found" });
  
      res.json({ message: "Profile deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting profile", error });
    }
  });
  

// Update Profile
router.put("/profile/:id", async (req, res) => {
  try {
    const { name, email, mobile, address } = req.body;
    const updatedProfile = await ProfileData.findByIdAndUpdate(
      req.params.id,
      { name, email, mobile, address },
      { new: true }
    );

    if (!updatedProfile) return res.status(404).json({ message: "Profile not found" });

    res.json({ message: "Profile updated successfully", ProfileData: updatedProfile });
  } catch (error) {
    res.status(500).json({ message: "Error updating profile", error });
  }
});

// Delete Profile
router.delete("/profile/:id", async (req, res) => {
  try {
    const deletedProfile = await ProfileData.findByIdAndDelete(req.params.id);
    if (!deletedProfile) return res.status(404).json({ message: "Profile not found" });

    res.json({ message: "Profile deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting profile", error });
  }
});

module.exports = router;
