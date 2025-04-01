

const express = require('express');
const router = express.Router();
const City = require('../Places/CityModel');

// Create a new city
router.post('/city-create', async (req, res) => {
    const city = new City({
        cityName: req.body.cityName,
        state: req.body.state  // Include the state in the request body
    });
    try {
        const newCity = await city.save();
        res.status(201).json(newCity);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get all cities
router.get('/city-all', async (req, res) => {
    try {
        const cities = await City.find();
        res.json(cities);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update a city
router.put('/city-update/:id', async (req, res) => {
    try {
        const city = await City.findById(req.params.id);
        if (!city) {
            return res.status(404).json({ message: 'City not found' });
        }
        city.cityName = req.body.cityName;
        city.state = req.body.state;  // Include the state in the update
        const updatedCity = await city.save();
        res.json(updatedCity);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete a city
router.delete('/city-delete/:id', async (req, res) => {
    try {
        const deletedCity = await City.findOneAndDelete({ _id: req.params.id });
        if (!deletedCity) {
            return res.status(404).json({ message: 'City not found' });
        }
        res.json({ message: 'City deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
