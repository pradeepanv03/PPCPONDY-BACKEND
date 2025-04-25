const express = require('express');
const router = express.Router();
const PaymentType = require('../Payment/PaymentTypeModel');

// Create Payment Type
router.post('/payment-create', async (req, res) => {
  try {
    const { paymentType, createdDate } = req.body;
    const newPayment = new PaymentType({ paymentType, createdDate });
    await newPayment.save();
    res.status(200).json({ message: 'Payment type created', data: newPayment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Payment Type
router.put('/payment-update/:id', async (req, res) => {
  try {
    const { paymentType, createdDate } = req.body;
    const updated = await PaymentType.findByIdAndUpdate(req.params.id, { paymentType, createdDate }, { new: true });
    res.status(200).json({ message: 'Payment type updated', data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get All Payment Types
router.get('/payment-all', async (req, res) => {
  try {
    const payments = await PaymentType.find();
    res.status(200).json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Payment Type
router.delete('/payment-delete/:id', async (req, res) => {
  try {
    await PaymentType.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Payment type deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
