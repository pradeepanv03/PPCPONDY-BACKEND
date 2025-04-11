const express = require("express");
const Notification = require("../Notification/NotificationModel");

const router = express.Router();

// Function to normalize phone numbers
const normalizePhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return "";

    // Remove all non-numeric characters except '+'
    phoneNumber = phoneNumber.replace(/[^\d+]/g, "");

    // If number starts with country code without '+', add '+'
    if (/^91\d{10}$/.test(phoneNumber)) {
        phoneNumber = `+${phoneNumber}`;
    }

    // If number is 10 digits (local format), assume India (+91)
    if (/^\d{10}$/.test(phoneNumber)) {
        phoneNumber = `+91${phoneNumber}`;
    }

    return phoneNumber;
};

// Create a new notification
router.post("/send-notification", async (req, res) => {
    try {
        let { userPhoneNumber, message, type, ppcId } = req.body;

        userPhoneNumber = normalizePhoneNumber(userPhoneNumber);

        // Validate required fields
        if (!userPhoneNumber) {
            return res.status(400).json({ error: "userPhoneNumber is required" });
        }
        if (!message) {
            return res.status(400).json({ error: "message is required" });
        }
        if (!type || !["message", "favorite", "interest", "photo_request"].includes(type)) {
            return res.status(400).json({ error: "Invalid notification type" });
        }

        // Create notification
        const notification = new Notification({
            userPhoneNumber,
            message,
            type,
            ppcId
        });

        await notification.save();
        return res.status(201).json({ success: true, notification });
    } catch (error) {
        return res.status(500).json({ error: "Error creating notification", details: error.message });
    }
});

// Fetch notifications for a specific user using userPhoneNumber
router.get("/notifications/:userPhoneNumber", async (req, res) => {
    try {
        let { userPhoneNumber } = req.params;

        userPhoneNumber = normalizePhoneNumber(userPhoneNumber);

        const notifications = await Notification.find({ userPhoneNumber }).sort({ createdAt: -1 });

        return res.status(200).json({ success: true, notifications });
    } catch (error) {
        return res.status(500).json({ error: "Error fetching notifications", details: error.message });
    }
});

// Get the count of notifications for a specific user
router.get("/notifications/count/:userPhoneNumber", async (req, res) => {
  try {
      let { userPhoneNumber } = req.params;

      userPhoneNumber = normalizePhoneNumber(userPhoneNumber);

      const count = await Notification.countDocuments({ userPhoneNumber });

      return res.status(200).json({ success: true, count });
  } catch (error) {
      return res.status(500).json({ error: "Error fetching notification count", details: error.message });
  }
});


// Fetch a single notification by _id
router.get("/notification/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await Notification.findById(id);

        if (!notification) {
            return res.status(404).json({ error: "Notification not found" });
        }

        return res.status(200).json({ success: true, notification });
    } catch (error) {
        return res.status(500).json({ error: "Error fetching notification", details: error.message });
    }
});

// Update a notification by _id
router.put("/notification/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { message, type, isRead } = req.body;

        const notification = await Notification.findByIdAndUpdate(
            id,
            { message, type, isRead },
            { new: true, runValidators: true }
        );

        if (!notification) {
            return res.status(404).json({ error: "Notification not found" });
        }

        return res.status(200).json({ success: true, notification });
    } catch (error) {
        return res.status(500).json({ error: "Error updating notification", details: error.message });
    }
});


// Delete a notification by _id
router.delete("/notification/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await Notification.findByIdAndDelete(id);

        if (!notification) {
            return res.status(404).json({ error: "Notification not found" });
        }

        return res.status(200).json({ success: true, message: "Notification deleted successfully" });
    } catch (error) {
        return res.status(500).json({ error: "Error deleting notification", details: error.message });
    }
});

// Delete all notifications for a user using userPhoneNumber
router.delete("/notifications/user/:userPhoneNumber", async (req, res) => {
    try {
        let { userPhoneNumber } = req.params;

        userPhoneNumber = normalizePhoneNumber(userPhoneNumber);

        const result = await Notification.deleteMany({ userPhoneNumber });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "No notifications found for this user" });
        }

        return res.status(200).json({ success: true, message: "All notifications deleted for user" });
    } catch (error) {
        return res.status(500).json({ error: "Error deleting notifications", details: error.message });
    }
});

// Fetch all notifications
router.get("/notifications", async (req, res) => {
    try {
        const notifications = await Notification.find().sort({ createdAt: -1 });

        return res.status(200).json({ success: true, notifications });
    } catch (error) {
        return res.status(500).json({ error: "Error fetching notifications", details: error.message });
    }
});

module.exports = router;















