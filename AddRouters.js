

const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const AddModel = require('./AddModel');
const NotificationUser = require('./Notification/NotificationDetailModel');

const router = express.Router();

// Multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  },
});
const upload = multer({ storage });



router.post(
    '/update-property-upload',
    upload.fields([
      { name: 'video', maxCount: 1 },
      { name: 'photos', maxCount: 15 },
      { name: 'excelFile', maxCount: 1 },
    ]),
    async (req, res) => {
      try {
        if (req.fileValidationError) {
          return res.status(400).json({ message: req.fileValidationError });
        }
  
        if (req.files['video'] && req.files['video'][0].size > 50 * 1024 * 1024) {
          return res.status(400).json({ message: 'Video file size exceeds 50MB.' });
        }
  
        if (req.files['excelFile']) {
          const excelPath = req.files['excelFile'][0].path;
          const workbook = xlsx.readFile(excelPath);
          const sheetName = workbook.SheetNames[0];
          const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
  
          const headers = sheetData[0];
          const rows = sheetData.slice(1); // Skip header row
  
          for (const row of rows) {
            const fieldsToUpdate = {};
  
            headers.forEach((header, index) => {
              if (header && row[index] !== undefined) {
                const key = header.toString().trim();
                const value = row[index];
                fieldsToUpdate[key] = typeof value === 'number' ? value.toString() : String(value).trim();
              }
            });
  
            const { ppcId } = fieldsToUpdate;
            if (!ppcId) {
              continue;
            }
  
            let user = await AddModel.findOne({ ppcId });
            if (!user) {
              // Create new property if it doesn't exist
              user = new AddModel({ ppcId });
            }
  
            // Update fields
            Object.keys(fieldsToUpdate).forEach((key) => {
              if (key !== 'ppcId') {
                user[key] = fieldsToUpdate[key];
              }
            });
  
            // Assign uploaded files if available (same for all)
            if (req.files['video']) {
              user.video = req.files['video'][0].path;
            }
            if (req.files['photos']) {
              user.photos = req.files['photos'].map((file) => file.path);
            }
  
            const requiredFields = [
              'phoneNumber', 'price', 'rentalPropertyAddress', 'state', 'city', 'district',
              'area', 'streetName', 'doorNumber', 'nagar', 'ownerName', 'email', 'propertyMode',
              'propertyType', 'ownership', 'bedrooms', 'kitchen', 'floorNo', 'areaUnit',
              'propertyApproved', 'propertyAge', 'postedBy', 'facing', 'salesMode', 'salesType',
              'furnished', 'carParking', 'totalArea', 'length', 'breadth',
            ];
            const isComplete = requiredFields.every((field) => user[field]);
            user.status = isComplete ? 'complete' : 'incomplete';
  
            await user.save();
  
          }
  
          fs.unlinkSync(excelPath); // Delete file after processing
        }
  
        res.status(200).json({ message: 'All properties updated successfully!' });
      } catch (error) {
        res.status(500).json({ message: 'Error updating properties.', error: error.message });
      }
    }
  );
  

module.exports = router;





















