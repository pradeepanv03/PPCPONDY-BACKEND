






const express = require('express');
const BuyerPlan = require('../BuyerPlan/BuyerModel');
const router = express.Router();

// Create a new plan
router.post('/buyer-plan-create', async (req, res) => {
  try {
    const plan = new BuyerPlan(req.body);
    await plan.save();
    res.status(201).send(plan);
  } catch (error) {
    res.status(400).send(error);
  }
});

// Get all plans
router.get('/buyer-plans-all', async (req, res) => {
  try {
    const plans = await BuyerPlan.find();
    res.status(200).send(plans);
  } catch (error) {
    res.status(500).send(error);
  }
});

// Update a plan
router.put('/buyer-update-plans/:id', async (req, res) => {
  try {
    const plan = await BuyerPlan.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!plan) {
      return res.status(404).send();
    }
    res.send(plan);
  } catch (error) {
    res.status(400).send(error);
  }
});

// Delete a plan
router.delete('/buyer-plans/:id', async (req, res) => {
  try {
    const plan = await BuyerPlan.findByIdAndDelete(req.params.id);
    if (!plan) {
      return res.status(404).send();
    }
    res.send(plan);
  } catch (error) {
    res.status(500).send(error);
  }
});

// Toggle plan status
router.put('/buyer-plans/:id/status', async (req, res) => {
  try {
    const plan = await BuyerPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).send();
    }
    plan.status = plan.status === 'active' ? 'hide' : 'active';
    await plan.save();
    res.send(plan);
  } catch (error) {
    res.status(400).send(error);
  }
});

module.exports = router;
