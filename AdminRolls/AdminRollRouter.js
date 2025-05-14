// routes/rolePermissions.js
const express = require('express');
const router = express.Router();
const RolePermission = require('../AdminRolls/AdminRollModel');

// Get all role permissions
router.get('/get-role-permissions', async (req, res) => {
  try {
    const data = await RolePermission.find();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Update role permissions
router.post('/update-role-permissions', async (req, res) => {
  const { role, viewedFiles } = req.body;

  if (!role || !Array.isArray(viewedFiles)) {
    return res.status(400).json({ error: "Invalid data" });
  }

  try {
    const result = await RolePermission.findOneAndUpdate(
      { role },
      { viewedFiles },
      { upsert: true, new: true }
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update" });
  }
});

module.exports = router;
