const express = require('express');
const router = express.Router();
const State = require('../Places/StateModel'); // Correct import

// Get all states
router.get('/state-all', async (req, res) => {
    try {
        const states = await State.find();
        res.json(states);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create a new state
router.post('/state-create', async (req, res) => {
    const state = new State({
        stateName: req.body.stateName
    });
    try {
        const newState = await state.save();
        res.status(201).json(newState);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Update a state
router.put('/state-update/:id', async (req, res) => {
    try {
        const state = await State.findById(req.params.id);
        if (!state) {
            return res.status(404).json({ message: 'State not found' });
        }
        state.stateName = req.body.stateName;
        const updatedState = await state.save();
        res.json(updatedState);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});


// Delete a state using findOneAndDelete
router.delete('/state-delete/:id', async (req, res) => {
    try {
        const deletedState = await State.findOneAndDelete({ _id: req.params.id });
        if (!deletedState) {
            return res.status(404).json({ message: 'State not found' });
        }
        res.json({ message: 'State deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});



module.exports = router;
