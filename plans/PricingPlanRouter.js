const express = require('express');
const router = express.Router();
const PricingPlans = require('../plans/PricingPlanModel');
const AddModel = require('../AddModel');
const NotificationUser = require('../Notification/NotificationDetailModel');
const moment = require("moment"); // if you're using moment.js (optional but helpful)




// Normalize phone number function
const normalizePhoneNumber = (phoneNumber) => {
    return phoneNumber.replace(/^\+?91/, ""); // Convert +91XXXXXX or 91XXXXXX to XXXXXX
};

// // ✅ Get all plans for a specific phone number


router.get("/plans/:phoneNumber", async (req, res) => {
    try {
        let { phoneNumber } = req.params;
        phoneNumber = normalizePhoneNumber(phoneNumber);

        const plans = await PricingPlans.find({ phoneNumber });
        if (plans.length === 0) {
            return res.status(404).json({ message: "No plans found for this phone number." });
        }

        return res.status(200).json({ 
            success: true, 
            plans: plans.map(plan => ({
                ...plan.toObject(),
                createdDate: plan.createdAt ? moment(plan.createdAt).format('YYYY-MM-DD') : null,
                expireDate: plan.expireDate ? moment(plan.expireDate).format('YYYY-MM-DD') : null
            }))
        });
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
        // Find the plan by ID
        const selectedPlan = await PricingPlans.findById(planId);

        if (!selectedPlan) {
            return res.status(404).json({
                status: "error",
                message: "Plan not found!",
            });
        }

        // Add phone number to the plan's phoneNumber array
        if (!selectedPlan.phoneNumber.includes(phoneNumber)) {
            selectedPlan.phoneNumber.push(phoneNumber);
        } else {
            return res.status(400).json({
                status: "error",
                message: "Phone number is already associated with this plan!",
            });
        }

        // Update createdAt and expireDate
        selectedPlan.createdAt = new Date();
        selectedPlan.expireDate = moment(selectedPlan.createdAt)
            .add(selectedPlan.durationDays, 'days')
            .toDate();

        await selectedPlan.save();

        // Send notification
        try {
            await NotificationUser.create({
                recipientPhoneNumber: phoneNumber,
                senderPhoneNumber: phoneNumber,
                ppcId: "PLAN-" + planId,
                message: `A new plan has been selected by ${phoneNumber}.`,
                createdAt: new Date()
            });
        } catch (notifErr) {
        }

        return res.status(200).json({
            status: "success",
            message: "Phone number added successfully to the plan!",
            selectedPlan,
            createdDate: moment(selectedPlan.createdAt).format('YYYY-MM-DD'),
            expireDate: moment(selectedPlan.expireDate).format('YYYY-MM-DD')
        });

    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Error selecting plan.",
            error: error.message,
        });
    }
});


router.get("/selected-plans", async (req, res) => {
    try {
        const selectedPlans = await PricingPlans.find({ phoneNumber: { $exists: true } });

        return res.status(200).json({
            status: "success",
            data: selectedPlans,
        });
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Failed to fetch selected plans.",
            error: error.message,
        });
    }
});




router.get("/all-selected-plans", async (req, res) => {
    try {
        // Get all pricing plans with assigned phoneNumber (i.e., selected plans)
        const allPlans = await PricingPlans.find({ phoneNumber: { $exists: true } });

        const plansWithExpiry = allPlans.map(plan => {
            const createdAt = new Date(plan.createdAt);
            const duration = plan.durationDays || 0;

            // Calculate expiry date
            const expiryDate = new Date(createdAt);
            expiryDate.setDate(expiryDate.getDate() + duration);

            return {
                ...plan._doc,
                expiryDate: expiryDate.toISOString().split("T")[0], // Format: YYYY-MM-DD
            };
        });

        return res.status(200).json({
            status: "success",
            data: plansWithExpiry
        });

    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Failed to fetch plans with expiry date.",
            error: error.message
        });
    }
});

router.get("/fetch-plan-by-phone", async (req, res) => {
    try {
        // Step 1: Extract phoneNumber from the request query
        const { phoneNumber } = req.query;

        // Step 2: Find the plan for the user with the given phone number
        const plan = await PricingPlans.findOne({ phoneNumber });

        // If the plan is not found
        if (!plan) {
            return res.status(404).json({ message: 'No plan found for this phone number.' });
        }

        // Step 3: Calculate the expiry date based on the createdAt and durationDays
        const createdAt = new Date(plan.createdAt);
        const duration = plan.durationDays || 0; // Default to 0 if durationDays is undefined

        const expiryDate = new Date(createdAt);
        expiryDate.setDate(expiryDate.getDate() + duration);

        // Step 4: Return plan details including expiry date
        return res.status(200).json({
            status: "success",
            phoneNumber: plan.phoneNumber,
            planName: plan.name,
            packageType: plan.packageType,
            durationDays: plan.durationDays,
            price: plan.price,
            createdAt: plan.createdAt,
            expiryDate: expiryDate.toISOString().split("T")[0], // Format as YYYY-MM-DD
        });
    } catch (error) {
        // Error handling
        return res.status(500).json({
            status: "error",
            message: "Failed to fetch plan by phone number.",
            error: error.message
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



router.get('/plan-names', async (req, res) => {
    try {
        const plans = await PricingPlans.find({}, 'name'); // Fetch only the 'name' field

        // Filter unique names
        const uniqueNames = [];
        const seenNames = new Set();

        plans.forEach(plan => {
            if (!seenNames.has(plan.name)) {
                seenNames.add(plan.name);
                uniqueNames.push(plan.name); // Push only the name
            }
        });

        return res.status(200).json(uniqueNames); // Return array of names
    } catch (error) {
        return res.status(500).json({ message: 'Error retrieving plan names.', error: error.message });
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
        expiringDate.setDate(currentDate.getDate() + 5); // Adjust this as needed (e.g., 5 days before expiry)

        const expiringPlans = await PricingPlans.find({
            status: 'active',
            $expr: {
                $lte: [
                    { $add: ["$createdAt", { $multiply: ["$durationDays", 86400000] }] },
                    expiringDate
                ]
            }
        });

        if (expiringPlans.length > 0) {
            return res.status(200).json({
                success: true,
                message: "Some plans are expiring soon.",
                expiringPlans
            });
        } else {
            return res.status(200).json({
                success: true,
                message: "No plans are expiring soon."
            });
        }
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

        if (expiredPlans.length > 0) {
            return res.status(200).json({
                success: true,
                message: "Some plans have expired.",
                expiredPlans
            });
        } else {
            return res.status(200).json({
                success: true,
                message: "No plans have expired."
            });
        }
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
