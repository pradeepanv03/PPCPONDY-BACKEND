
const express = require('express');
const Contact = require('./ContactUsModel'); // Import Contact model

const router = express.Router();


router.post('/contactUs', async (req, res) => {
    try {
        const { name, email, phoneNumber, message } = req.body;

        // Validate request data
        if (!name || !email || !phoneNumber || !message) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Create new contact entry
        const newContact = new Contact({ name, email, phoneNumber, message });
        await newContact.save();

        res.status(201).json({ message: 'Contact form submitted successfully', data: newContact });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});


router.get('/all-contactUs', async (req, res) => {
    try {
        const contacts = await Contact.find();
        res.status(200).json({ message: 'All contacts retrieved', data: contacts });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});


router.get('/get-contactUs/:id', async (req, res) => {
    try {
        const contact = await Contact.findById(req.params.id);
        if (!contact) {
            return res.status(404).json({ error: 'Contact not found' });
        }
        res.status(200).json({ message: 'Contact retrieved', data: contact });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});


router.put('/update-contactUs/:id', async (req, res) => {
    try {
        const { name, email, phoneNumber, message } = req.body;

        // Validate request data
        if (!name || !email || !phoneNumber || !message) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const updatedContact = await Contact.findByIdAndUpdate(
            req.params.id,
            { name, email, phoneNumber, message },
            { new: true, runValidators: true }
        );

        if (!updatedContact) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        res.status(200).json({ message: 'Contact updated successfully', data: updatedContact });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});


router.delete('/delete-contactUs/:id', async (req, res) => {
    try {
        const deletedContact = await Contact.findByIdAndDelete(req.params.id);

        if (!deletedContact) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        res.status(200).json({ message: 'Contact deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
