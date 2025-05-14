const express = require('express');
const OfficeModel = require('../Office/OfficeModel');

const router = express.Router();

// Route to fetch all office details
router.get('/office-all', async (req, res) => {
  try {
    const offices = await OfficeModel.find();
    res.json(offices);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch offices' });
  }
});

// Route to create a new office
router.post('/office-create', async (req, res) => {
  try {
    const { officeName, landLine, address, mobile } = req.body;
    const newOffice = new OfficeModel({ officeName, landLine, address, mobile });
    await newOffice.save();
    res.status(201).json(newOffice);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create office' });
  }
});

// Route to update an office by ID
router.put('/office-update/:id', async (req, res) => {
  try {
    const { officeName, landLine, address, mobile } = req.body;
    const updatedOffice = await OfficeModel.findByIdAndUpdate(
      req.params.id,
      { officeName, landLine, address, mobile },
      { new: true, runValidators: true }
    );
    if (!updatedOffice) {
      return res.status(404).json({ message: 'Office not found' });
    }
    res.status(200).json(updatedOffice);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update office' });
  }
});

// Route to delete an office by ID
router.delete('/office-delete/:id', async (req, res) => {
  try {
    const deletedOffice = await OfficeModel.findByIdAndDelete(req.params.id);
    if (!deletedOffice) {
      return res.status(404).json({ message: 'Office not found' });
    }
    res.status(200).json({ message: 'Office deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete office' });
  }
});

module.exports = router;
