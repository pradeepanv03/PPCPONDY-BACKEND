const express = require("express");
const router = express.Router();
const TextModel = require("../TextEdider/TextModel");


router.post("/save-text", async (req, res) => {
    try {
        let { type, content } = req.body;

        if (!type || !content) {
            return res.status(400).json({ error: "Type and content are required." });
        }

        // ✅ Convert to string and sanitize spaces/special characters properly
        content = String(content).replace(/\r/g, ""); // Remove carriage return (\r)

        const existingText = await TextModel.findOne({ type });

        if (existingText) {
            existingText.content = content;
            existingText.updatedAt = new Date();
            await existingText.save();
            return res.status(200).json({ message: "Text updated successfully!" });
        } else {
            const newText = new TextModel({ type, content });
            await newText.save();
            return res.status(201).json({ message: "Text saved successfully!" });
        }
    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
});


// Get text by type
router.get("/get-text/:type", async (req, res) => {
    try {
        const { type } = req.params;
        const textData = await TextModel.findOne({ type });

        if (!textData) {
            return res.status(404).json({ message: "Text not found." });
        }

        return res.status(200).json(textData);
    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
});


router.put("/update-text/:type", async (req, res) => {
    try {
        const { type } = req.params;
        let { content } = req.body;

        if (!content) {
            return res.status(400).json({ error: "Content is required." });
        }

        // ✅ Convert content to string and sanitize it
        content = String(content).replace(/\r/g, ""); // Remove carriage returns

        const updatedText = await TextModel.findOneAndUpdate(
            { type },
            { content, updatedAt: new Date() },
            { new: true } // Return updated document
        );

        if (!updatedText) {
            return res.status(404).json({ message: "Text not found for the given type." });
        }

        return res.status(200).json({ message: "Text updated successfully!", data: updatedText });
    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
});


router.delete("/delete-text/:type", async (req, res) => {
    try {
        const { type } = req.params;

        const deletedText = await TextModel.findOneAndDelete({ type });

        if (!deletedText) {
            return res.status(404).json({ message: "Text not found for the given type." });
        }

        return res.status(200).json({ message: "Text deleted successfully!" });
    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
});


router.get("/get-all-texts", async (req, res) => {
    try {
        const allTexts = await TextModel.find({});

        if (allTexts.length === 0) {
            return res.status(404).json({ message: "No text entries found." });
        }

        return res.status(200).json(allTexts);
    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
});


module.exports = router;
