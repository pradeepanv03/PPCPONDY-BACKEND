const express = require('express');
const UserInteraction = require('../visit/VisitAdminModel'); // Assuming UserInteraction model is in models directory
const router = express.Router();

// Endpoint to record user interaction (viewing a file)
router.post('/record-view', async (req, res) => {
    const { userName, viewedFile } = req.body;

    try {
        const newInteraction = new UserInteraction({
            userName,
            viewedFile,
        });

        await newInteraction.save();
        res.status(200).json({ message: 'Interaction recorded successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to record interaction', error: error.message });
    }
});

module.exports = router;
