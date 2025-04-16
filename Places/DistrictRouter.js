

const express = require('express');
const router = express.Router();
const District = require('../Places/DistrictModel');


router.post('/district-create', async (req, res) => {
    const district = new District({
        districtName: req.body.districtName,
        state: req.body.state  // Include the state in the request body
    });
    try {
        const newDistrict = await district.save();
        res.status(201).json(newDistrict);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});


// Get all districts
router.get('/district-all', async (req, res) => {
    try {
        const districts = await District.find();
        res.json(districts);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put('/district-update/:id', async (req, res) => {
    try {
        const district = await District.findById(req.params.id);
        if (!district) {
            return res.status(404).json({ message: 'District not found' });
        }
        district.districtName = req.body.districtName;
        district.state = req.body.state;  // Include the state in the update
        const updatedDistrict = await district.save();
        res.json(updatedDistrict);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});


// Delete a district
router.delete('/district-delete/:id', async (req, res) => {
    try {
        const deletedDistrict = await District.findOneAndDelete({ _id: req.params.id });
        if (!deletedDistrict) {
            return res.status(404).json({ message: 'District not found' });
        }
        res.json({ message: 'District deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


module.exports = router;
