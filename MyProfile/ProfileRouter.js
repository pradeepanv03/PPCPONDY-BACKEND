const express = require("express");
const ProfileData = require("../MyProfile/ProfileModel");

const router = express.Router();

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
  
  
//   // Update Profile by Mobile Number
//   router.put("/profile/:mobile", async (req, res) => {
//     try {
//       const { name, email, mobile, address } = req.body;
//       const updatedProfile = await ProfileData.findOneAndUpdate(
//         { mobile: req.params.mobile },
//         { name, email, mobile, address },
//         { new: true }
//       );
  
//       if (!updatedProfile) return res.status(404).json({ message: "Profile not found" });
  
//       res.json({ message: "Profile updated successfully", ProfileData: updatedProfile });
//     } catch (error) {
//       res.status(500).json({ message: "Error updating profile", error });
//     }
//   });
  

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
