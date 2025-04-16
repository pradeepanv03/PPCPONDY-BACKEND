
const express = require('express');
const router = express.Router();
const Area = require('../Places/AreaModel');

// Create a new area
router.post('/area-create', async (req, res) => {
    const area = new Area({
        areaName: req.body.areaName,
        state: req.body.state  // Include the state in the request body
    });
    try {
        const newArea = await area.save();
        res.status(201).json(newArea);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get all areas
router.get('/area-all', async (req, res) => {
    try {
        const areas = await Area.find();
        res.json(areas);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update an area
router.put('/area-update/:id', async (req, res) => {
    try {
        const area = await Area.findById(req.params.id);
        if (!area) {
            return res.status(404).json({ message: 'Area not found' });
        }
        area.areaName = req.body.areaName;
        area.state = req.body.state;  // Include the state in the update
        const updatedArea = await area.save();
        res.json(updatedArea);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete an area
router.delete('/area-delete/:id', async (req, res) => {
    try {
        const deletedArea = await Area.findOneAndDelete({ _id: req.params.id });
        if (!deletedArea) {
            return res.status(404).json({ message: 'Area not found' });
        }
        res.json({ message: 'Area deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
