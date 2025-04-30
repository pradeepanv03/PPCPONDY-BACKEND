const express = require('express');
const router = express.Router();
const FollowUp = require('../FollowUp/FollowUpModel'); // Import your model

// POST /api/followup-create
router.post('/followup-create', async (req, res) => {
  try {
    const { ppcId,phoneNumber, followupStatus, followupType, followupDate } = req.body;

    const newFollowUp = new FollowUp({
      ppcId,
      phoneNumber,
      followupStatus,
      followupType,
      followupDate,
    });

    await newFollowUp.save(); // Save to MongoDB
    res.status(201).json({ success: true, data: newFollowUp }); // Respond with success
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});



router.get('/followup-list', async (req, res) => {
  try {
    const { ppcId, phoneNumber } = req.query;
    let filter = {};

    if (ppcId) filter.ppcId = ppcId;
    if (phoneNumber) filter.phoneNumber = phoneNumber;

    const followups = await FollowUp.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: followups });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


module.exports = router; 