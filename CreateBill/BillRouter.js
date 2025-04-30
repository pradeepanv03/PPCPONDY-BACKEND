const express = require('express');
const router = express.Router();
const Bill = require('../CreateBill/BillModel');

// Create a new bill
router.post('/create-bill', async (req, res) => {
  try {
    const billData = req.body;

    const newBill = new Bill(billData);
    await newBill.save();

    res.status(201).json({ success: true, message: 'Bill created successfully', data: newBill });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
});


// Get default values for creating a bill
router.get('/get-default-bill-data', async (req, res) => {
  try {
    // Find the latest bill by created date
    const lastBill = await Bill.findOne().sort({ createdAt: -1 });

    // Default first bill number
    let nextBillNo = 'RP - 001';

    // If there is a last bill, increment the bill number
    if (lastBill?.billNo) {
      const lastNumber = parseInt(lastBill.billNo.split('-')[1]?.trim() || '0', 10);
      const newNumber = (lastNumber + 1).toString().padStart(3, '0');
      nextBillNo = `RP - ${newNumber}`;
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const formattedDate = `${yyyy}-${mm}-${dd}`;

    // Send default bill data
    res.status(200).json({
      success: true,
      data: {
        adminOffice: 'AUROBINDO', // Hardcoded for now, can make dynamic later
        adminName: 'balarks',     // Hardcoded for now, can make dynamic later
        billNo: nextBillNo,
        billDate: formattedDate,
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
});


// Get all bills
router.get('/bills', async (req, res) => {
  try {
    const bills = await Bill.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: bills });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
});

// Get bill by ID
router.get('/bill/:id', async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }
    res.status(200).json({ success: true, data: bill });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
});

module.exports = router;
