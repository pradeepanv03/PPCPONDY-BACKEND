const express = require('express');
const router = express.Router();
const UserSechma = require('./ExcelModel');
const multer = require('multer');
const xlsx = require('xlsx');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Single record addition (existing route)
router.post('/add', (req, res) => {
    const add_data = UserSechma(req.body);
    add_data.save()
        .then(() => res.send({ message: "Data Added" }))
        .catch(err => res.status(500).send({ message: "Error", error: err }));
});

// Bulk addition from Excel
router.post('/bulk-add', upload.single('excelFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send({ message: "No file uploaded" });
        }

        // Read the Excel file
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = xlsx.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
            return res.status(400).send({ message: "Excel file is empty" });
        }

        // Insert bulk data
        const result = await UserSechma.insertMany(jsonData);

        res.send({
            message: "Bulk data added successfully",
            count: result.length
        });
    } catch (error) {
        res.status(500).send({
            message: "Error processing bulk data",
            error: error.message
        });
    }
});

module.exports=router;