const express = require('express');
const router = express.Router();
const PricingPlans = require('../plans/PricingPlanModel');
const AddModel = require('../AddModel');


// Normalize phone number function
const normalizePhoneNumber = (phoneNumber) => {
    return phoneNumber.replace(/^\+?91/, ""); // Convert +91XXXXXX or 91XXXXXX to XXXXXX
};

// ✅ Get all plans for a specific phone number
router.get("/plans/:phoneNumber", async (req, res) => {
    try {
        let { phoneNumber } = req.params;
        phoneNumber = normalizePhoneNumber(phoneNumber);

        const plans = await PricingPlans.find({ phoneNumber });
        if (plans.length === 0) {
            return res.status(404).json({ message: "No plans found for this phone number." });
        }

        return res.status(200).json({ success: true, plans });
    } catch (error) {
        return res.status(500).json({ message: "Error fetching plans.", error: error.message });
    }
});

// ✅ Get plan count for a specific phone number
router.get("/plans/count/:phoneNumber", async (req, res) => {
    try {
        let { phoneNumber } = req.params;
        phoneNumber = normalizePhoneNumber(phoneNumber);

        const count = await PricingPlans.countDocuments({ phoneNumber });

        return res.status(200).json({ success: true, count });
    } catch (error) {
        return res.status(500).json({ message: "Error fetching plan count.", error: error.message });
    }
});



router.get('/get-plan', async (req, res) => {
    try {
        const plans = await PricingPlans.find();  // Retrieve all plans
        return res.status(200).json(plans);
    } catch (error) {
        return res.status(500).json({ message: 'Error fetching plans.', error: error.message });
    }
});


router.get('/get-all-plan-count', async (req, res) => {
    try {
        const plans = await PricingPlans.find(); // Fetch all plans

        // Extract unique plan names
        const uniquePlanNames = new Set(plans.map(plan => plan.name));

        return res.status(200).json({ totalPlansCount: uniquePlanNames.size });
    } catch (error) {
        return res.status(500).json({ message: 'Error fetching plans count.', error: error.message });
    }
});


router.get('/get-all-plan', async (req, res) => {
    try {
        const plans = await PricingPlans.find(); // Fetch all plans

        // Filter unique plans based on 'name'
        const uniquePlans = [];
        const seenNames = new Set();

        plans.forEach(plan => {
            if (!seenNames.has(plan.name)) {
                seenNames.add(plan.name);
                uniquePlans.push(plan);
            }
        });

        return res.status(200).json(uniquePlans);
    } catch (error) {
        return res.status(500).json({ message: 'Error fetching plans.', error: error.message });
    }
});



router.post('/store-plan', async (req, res) => {
    const { name, packageType, unlimitedAds, price, durationDays, numOfCars, featuredAds, featuredMaxCar, description, status } = req.body;

    try {
        // Check if a plan with the same name already exists
        const existingPlan = await PricingPlans.findOne({ name });
        if (existingPlan) {
            return res.status(400).json({ message: 'Plan with this name already exists. Please use a different name.' });
        }

        const newPlan = new PricingPlans({
            name,
            packageType,
            unlimitedAds,
            price,
            durationDays,
            numOfCars,
            featuredAds,
            featuredMaxCar,
            description,
            status,
        });

        await newPlan.save();
        return res.status(201).json({ message: 'Plan added successfully!', newPlan });

    } catch (error) {
        return res.status(500).json({ message: 'Error storing plan details.', error: error.message });
    }
});

router.post("/select-plan", async (req, res) => {
    const { phoneNumber, planId } = req.body;

    try {
        // Check if the user already has an active plan
        const existingPlan = await PricingPlans.findOne({ phoneNumber });

        if (existingPlan) {
            return res.status(400).json({
                status: "error",
                message: "You already have an active plan!",
            });
        }

        // Find the plan by ID
        const selectedPlan = await PricingPlans.findById(planId);

        if (!selectedPlan) {
            return res.status(404).json({
                status: "error",
                message: "Plan not found!",
            });
        }

        // Assign the plan to the user
        selectedPlan.phoneNumber = phoneNumber;
        await selectedPlan.save();

        return res.status(200).json({
            status: "success",
            message: "Plan selected successfully!",
            selectedPlan,
        });

    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Error selecting plan.",
            error: error.message,
        });
    }
});


router.get('/plans', async (req, res) => {
    try {
        const plans = await PricingPlans.find(); // Fetch all plans

        // Filter unique plans based on 'name'
        const uniquePlans = [];
        const seenNames = new Set();

        plans.forEach(plan => {
            if (!seenNames.has(plan.name)) {
                seenNames.add(plan.name);
                uniquePlans.push(plan);
            }
        });

        return res.status(200).json(uniquePlans);
    } catch (error) {
        return res.status(500).json({ message: 'Error retrieving plans.', error: error.message });
    }
});



// Get a specific plan by ID
router.get('/plans/:id', async (req, res) => {
    try {
        const plan = await PricingPlans.findById(req.params.id);
        if (!plan) {
            return res.status(404).json({ message: 'Plan not found.' });
        }
        return res.status(200).json(plan);
    } catch (error) {
        return res.status(500).json({ message: 'Error retrieving plan.', error: error.message });
    }
});





router.get('/get-active-plans', async (req, res) => {
    try {
        const activePlans = await PricingPlans.find({ status: 'active' });
        return res.status(200).json(activePlans);
    } catch (error) {
        return res.status(500).json({ message: 'Error fetching active plans.', error: error.message });
    }
});


router.get('/get-latest-active-plan/:phoneNumber', async (req, res) => {
    const { phoneNumber } = req.params;

    try {
        const latestPlan = await PricingPlans.findOne({ phoneNumber, status: 'active' }).sort({ createdAt: -1 });

        if (!latestPlan) {
            return res.status(404).json({ message: 'No active plan found for this user.' });
        }

        return res.status(200).json(latestPlan);
    } catch (error) {
        return res.status(500).json({ message: 'Error fetching latest active plan.', error: error.message });
    }
});




router.put('/update-plan-data/:id', async (req, res) => {
    const { name, packageType, unlimitedAds, price, durationDays, numOfCars, featuredAds, featuredMaxCar, description, status } = req.body;

    try {
        // Check if another plan already has this name
        const existingPlan = await PricingPlans.findOne({ name, _id: { $ne: req.params.id } });
        if (existingPlan) {
            return res.status(400).json({ message: 'Another plan with this name already exists. Choose a different name.' });
        }

        const updatedPlan = await PricingPlans.findByIdAndUpdate(
            req.params.id,
            { name, packageType, unlimitedAds, price, durationDays, numOfCars, featuredAds, featuredMaxCar, description, status },
            { new: true }
        );

        if (!updatedPlan) {
            return res.status(404).json({ message: 'Plan not found.' });
        }

        return res.status(200).json({ message: 'Plan updated successfully!', updatedPlan });
    } catch (error) {
        return res.status(500).json({ message: 'Error updating plan.', error: error.message });
    }
});


// Update a plan's status by ID
router.put('/update-plan/:id', async (req, res) => {
    const { status } = req.body;

    try {
        const updatedPlan = await PricingPlans.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        if (!updatedPlan) {
            return res.status(404).json({ message: 'Plan not found.' });
        }
        return res.status(200).json({ message: 'Plan status updated successfully!', updatedPlan });
    } catch (error) {
        return res.status(500).json({ message: 'Error updating plan status.', error: error.message });
    }
});

// Delete a plan by ID
router.delete('/delete-plan/:id', async (req, res) => {
    try {
        const deletedPlan = await PricingPlans.findByIdAndDelete(req.params.id);
        if (!deletedPlan) {
            return res.status(404).json({ message: 'Plan not found.' });
        }
        return res.status(200).json({ message: 'Plan deleted successfully!' });
    } catch (error) {
        return res.status(500).json({ message: 'Error deleting plan.', error: error.message });
    }
});

// Get all active plans
router.get('/active-plans', async (req, res) => {
    try {
        const activePlans = await PricingPlans.find({ status: 'active' });
        return res.status(200).json(activePlans);
    } catch (error) {
        return res.status(500).json({ message: 'Error retrieving active plans.', error: error.message });
    }
});




router.get('/get-new-plan', async (req, res) => {
    let { phoneNumber } = req.query;

    if (!phoneNumber) {
        return res.status(400).json({ message: 'Phone number is required.' });
    }

    try {
        // Normalize phone number format
        phoneNumber = phoneNumber.replace(/\D/g, ''); // Remove non-numeric characters

        if (phoneNumber.startsWith('91') && phoneNumber.length === 12) {
            phoneNumber = phoneNumber.slice(2); // Convert '917878789090' → '787878789090'
        }


        // Fetch plans with multiple matching formats
        const plans = await PricingPlans.find({
            $or: [
                { phoneNumber: phoneNumber },          // Matches "787878789090"
                { phoneNumber: `+91${phoneNumber}` },  // Matches "+917878789090"
                { phoneNumber: `91${phoneNumber}` },   // Matches "917878789090"
                { phoneNumber: Number(phoneNumber) }   // Matches if stored as a Number
            ]
        }).exec();


        if (!plans || plans.length === 0) {
            return res.status(404).json({ message: 'No plans found for this phone number' });
        }

        res.status(200).json({ plans });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching plan data', error: error.message });
    }
});




  router.get('/expiring-soon', async (req, res) => {
    try {
        const currentDate = new Date();
        const expiringDate = new Date();
        expiringDate.setDate(currentDate.getDate() + 5); // 5 days before expiry

        const expiringPlans = await PricingPlans.find({
            status: 'active',
            $expr: {
                $lte: [
                    { $add: ["$createdAt", { $multiply: ["$durationDays", 86400000] }] },
                    expiringDate
                ]
            }
        });

        return res.status(200).json(expiringPlans);
    } catch (error) {
        return res.status(500).json({ message: 'Error retrieving expiring plans.', error: error.message });
    }
});


router.get('/expired-plans', async (req, res) => {
    try {
        const currentDate = new Date();

        const expiredPlans = await PricingPlans.find({
            status: 'active',
            $expr: {
                $lt: [
                    { $add: ["$createdAt", { $multiply: ["$durationDays", 86400000] }] },
                    currentDate
                ]
            }
        });

        return res.status(200).json(expiredPlans);
    } catch (error) {
        return res.status(500).json({ message: 'Error retrieving expired plans.', error: error.message });
    }
});


router.put('/update-expired-plans', async (req, res) => {
    try {
        const currentDate = new Date();

        const updatedPlans = await PricingPlans.updateMany(
            {
                status: 'active',
                $expr: {
                    $lt: [
                        { $add: ["$createdAt", { $multiply: ["$durationDays", 86400000] }] },
                        currentDate
                    ]
                }
            },
            { $set: { status: 'expired' } }
        );

        return res.status(200).json({ message: 'Expired plans updated successfully!', updatedPlans });
    } catch (error) {
        return res.status(500).json({ message: 'Error updating expired plans.', error: error.message });
    }
});




module.exports = router;
