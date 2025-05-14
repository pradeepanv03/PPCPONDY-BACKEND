
const express = require('express');
const multer = require('multer');
const fs = require('fs');
// const xml2js = require('xml2js');
const xlsx = require('xlsx');  // ✅ Make sure this is at the top

const DataModel = require('../SendDataAdmin/DataModel');

const router = express.Router(); // ✅ Define router


// Multer configuration for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


router.post("/upload-excel", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No Excel file uploaded" });
  }

  try {

    // Read Excel file from buffer
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0]; // Read first sheet
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);


    // Ensure required fields are present
    if (!sheetData || sheetData.length === 0) {
      return res.status(400).json({ error: "Empty or invalid Excel file" });
    }

    // Transform and validate data before inserting into MongoDB
    const formattedData = sheetData.map((row) => ({
      field: row.field?.toString().trim() || "Missing Field",
      value: row.value?.toString().trim() || "Missing Value",
    }));

    // Filter out duplicates by checking existing records in the database
    const uniqueData = [];
    for (const item of formattedData) {
      const exists = await DataModel.findOne({ field: item.field, value: item.value });
      if (!exists) {
        uniqueData.push(item);
      }
    }

    // Insert only unique data
    if (uniqueData.length > 0) {
      await DataModel.insertMany(uniqueData);
      return res.status(201).json({
        message: "Excel data stored successfully",
        data: uniqueData,
      });
    } else {
      return res.status(200).json({ message: "No new unique data to insert" });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Add API to store individual fields
router.post('/add', async (req, res) => {
  const { field, value } = req.body;

  // Validate input
  if (!field || !value) {
    return res.status(400).json({ error: "Field and value are required" });
  }

  try {
    // Create and save a new document for the field
    const newAdd = new DataModel({ field, value });
    await newAdd.save();

    res.status(201).json({ message: 'Field added successfully', data: newAdd });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Fetch all fields
router.get('/fetch', async (req, res) => {
  try {
    const data = await DataModel.find(); // Fetch all documents
    res.status(200).json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update specific field
router.put('/update', async (req, res) => {
  const { field, value, newValue } = req.body;

  if (!field || !value || !newValue) {
    return res.status(400).json({ error: "Field, value, and newValue are required" });
  }

  try {
    // Find and update the field
    const updatedData = await DataModel.findOneAndUpdate(
      { field, value },  // Match by field name and current value
      { value: newValue },  // Update to the new value
      { new: true }
    );

    if (!updatedData) {
      return res.status(404).json({ message: "Field not found" });
    }

    res.status(200).json({ message: 'Field updated successfully', data: updatedData });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete specific field
router.delete('/delete', async (req, res) => {
  const { field, value } = req.body;

  if (!field || !value) {
    return res.status(400).json({ error: "Field and value are required" });
  }

  try {
    // Find and delete the document
    const deletedData = await DataModel.findOneAndDelete({ field, value });

    if (!deletedData) {
      return res.status(404).json({ message: "Field not found" });
    }

    res.status(200).json({ message: 'Field deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

  

module.exports = router;









