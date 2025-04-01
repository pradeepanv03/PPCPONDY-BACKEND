const express = require('express');
const router = express.Router();
const Roll = require('../Roll/RollModel');

// Create a new roll
router.post('/roll-create', async (req, res) => {
    const roll = new Roll({
        rollType: req.body.rollType,
        createdDate: req.body.createdDate  // Include the creation date in the request body
    });
    try {
        const newRoll = await roll.save();
        res.status(201).json(newRoll);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get all rolls
router.get('/roll-all', async (req, res) => {
    try {
        const rolls = await Roll.find();
        res.json(rolls);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update a roll
router.put('/roll-update/:id', async (req, res) => {
    try {
        const roll = await Roll.findById(req.params.id);
        if (!roll) {
            return res.status(404).json({ message: 'Roll not found' });
        }
        roll.rollType = req.body.rollType;
        roll.createdDate = req.body.createdDate;
        const updatedRoll = await roll.save();
        res.json(updatedRoll);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete a roll
router.delete('/roll-delete/:id', async (req, res) => {
    try {
        const deletedRoll = await Roll.findOneAndDelete({ _id: req.params.id });
        if (!deletedRoll) {
            return res.status(404).json({ message: 'Roll not found' });
        }
        res.json({ message: 'Roll deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
