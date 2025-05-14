const express = require('express');
const router = express.Router();
const Bill = require('../CreateBill/BillModel');
const AddModel = require('../AddModel');





router.post('/create-bill', async (req, res) => {
  try {
    const billData = req.body;

    // Detect if request is from system or user
    const requestSource = req.headers['x-request-source'];

    if (requestSource === 'system') {
      billData.billCreatedBy = "Admin";
    } else {
      billData.billCreatedBy = billData.billCreatedBy || "User";
    }

    // 1. Create new bill
    const newBill = new Bill(billData);
    await newBill.save();

    // 2. Update property status to 'active'
    const updatedProperty = await AddModel.findOneAndUpdate(
      { ppcId: billData.ppId },
      { $set: { status: 'active' } },  // ✅ Actually update status here
      { new: true }
    );

    res.status(201).json({
      success: true,
      message: "Bill created successfully and property status set to Active",
      data: {
        ...newBill._doc,
        status: updatedProperty?.status || 'N/A'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
});


router.get('/get-bill/:ppcId', async (req, res) => {
  try {
    const { ppcId } = req.params;

    const bill = await Bill.findOne({ ppId: ppcId });

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    res.status(200).json({ success: true, data: bill });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
});



router.put('/update-bill/:ppcId', async (req, res) => {
  try {
    const { ppcId } = req.params;
    const updateData = req.body;

    const updatedBill = await Bill.findOneAndUpdate(
      { ppId: ppcId },
      updateData,
      { new: true }
    );

    if (!updatedBill) {
      return res.status(404).json({ success: false, message: 'Bill not found for update' });
    }

    res.status(200).json({ success: true, message: 'Bill updated successfully', data: updatedBill });
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
        // adminName:'',    // Hardcoded for now, can make dynamic later
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
