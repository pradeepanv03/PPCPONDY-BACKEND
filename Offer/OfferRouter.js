
const express = require('express');
const router = express.Router();
const Offer = require('../Offer/OfferModel'); 
const AddModel = require('../AddModel');


router.get("/offers/owner/:phoneNumber", async (req, res) => {
    try {
        let { phoneNumber } = req.params;

        // Normalize phone number format (remove non-numeric characters)
        phoneNumber = phoneNumber.replace(/\D/g, "");

        const phoneVariants = [
            phoneNumber,
            `${phoneNumber}`,
            `+${phoneNumber}`
        ];


        // Find all offers made by the buyer
        const buyerOffers = await Offer.find({ phoneNumber: { $in: phoneVariants } });


        if (!buyerOffers.length) {
            return res.status(404).json({ message: "No offers found for this buyer." });
        }


        // Extract unique property PPC IDs from offers
        const uniquePpcIds = [...new Set(buyerOffers.map((offer) => offer.ppcId))];


        // Fetch property details in one query
        const properties = await AddModel.find({ ppcId: { $in: uniquePpcIds } }).lean();


        // Map properties for quick lookup
        const propertyMap = new Map(properties.map((property) => [property.ppcId, property]));

        // Construct response with property & offer details
        const offersData = buyerOffers.map((offer) => {
            const property = propertyMap.get(offer.ppcId);
            return {
                ppcId: offer.ppcId,
                offeredPrice: offer.price,
                buyerPhoneNumber: offer.phoneNumber,
                originalPrice: property ? property.price : null,
                propertyMode: property ? property.propertyMode : null,
                propertyType: property ? property.propertyType : null,
                postedUserPhoneNumber: property ? property.phoneNumber : null, // Owner's phone number
                status: offer.status || "pending"
            };
        });

        res.status(200).json({
            message: "Buyer’s offers fetched successfully.",
            offers: offersData
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching buyer offers.", error: error.message });
    }
});


router.post('/offer', async (req, res) => {
    try {
        const { ppcId, phoneNumber, price } = req.body;

        if (!ppcId || !phoneNumber || !price) {
            return res.status(400).json({ message: "All fields are required: ppcId, phoneNumber, price" });
        }

        const numericPrice = Number(price);
        if (isNaN(numericPrice) || numericPrice <= 0) {
            return res.status(400).json({ message: "Invalid price. It must be a positive number." });
        }

        // Fetch property details
        const property = await AddModel.findOne({ ppcId });
        if (!property) {
            return res.status(404).json({ message: "Property not found" });
        }


        // Check if an offer already exists from the same buyer
        let existingOffer = await Offer.findOne({ ppcId, phoneNumber });

        if (existingOffer) {
            // Update existing offer
            existingOffer.price = numericPrice;
            existingOffer.originalPrice = property.price; // Store original price
            existingOffer.postedUserPhoneNumber = property.phoneNumber; // Store property owner phone
            await existingOffer.save();
            return res.status(200).json({ 
                message: "Offer updated successfully", 
                offer: existingOffer
            });
        }

        // Create a new offer and store property details
        const newOffer = new Offer({
            ppcId,
            phoneNumber,
            price: numericPrice,
            status: 'pending', // Offer status
            originalPrice: property.price, // Store property price
            postedUserPhoneNumber: property.phoneNumber // Store property owner phone
        });

        await newOffer.save();
        res.status(201).json({
            message: "Offer created successfully",
            offer: newOffer
        });

    } catch (error) {
        res.status(500).json({ message: "Error processing offer", error: error.message });
    }
});


router.get('/offers', async (req, res) => {
    try {
        const { ppcId } = req.params;

        // Find the property
        const property = await AddModel.findOne({ ppcId });
        if (!property) {
            return res.status(404).json({ message: "Property not found" });
        }

        // Find all offers for the property
        const offers = await Offer.find({ ppcId });

        res.status(200).json({
            offers,
            property: {
                originalPrice: property.price,
                postedBy: property.phoneNumber
            }
        });

    } catch (error) {
        res.status(500).json({ message: "Error fetching offers", error: error.message });
    }
});


router.get('/all-offers', async (req, res) => {
    try {
        // Fetch all offers from the database
        const offers = await Offer.find();

        if (offers.length === 0) {
            return res.status(404).json({ message: "No offers found" });
        }

        res.status(200).json({ offers });

    } catch (error) {
        res.status(500).json({ message: "Error fetching offers", error: error.message });
    }
});



/** 🏠 GET ALL OFFERS RECEIVED BY AN OWNER (MULTIPLE BUYERS, MULTIPLE PROPERTIES) **/
router.get('/offers/buyer/:phoneNumber', async (req, res) => {
    try {
        let { phoneNumber } = req.params;

        // Normalize phone number format (removes non-numeric characters)
        phoneNumber = phoneNumber.replace(/\D/g, "");
        if (phoneNumber.startsWith("91") && phoneNumber.length === 12) {
            phoneNumber = phoneNumber.slice(2);
        }

        // Find all properties posted by this owner
        const propertiesByOwner = await AddModel.find({
            $or: [
                { phoneNumber },
                { phoneNumber: `+91${phoneNumber}` },
                { phoneNumber: `91${phoneNumber}` }
            ]
        });

        if (!propertiesByOwner.length) {
            return res.status(404).json({ message: "No properties found for this owner." });
        }

        // Extract property IDs
        const propertyIds = propertiesByOwner.map(property => property.ppcId);

        // Fetch all offers on these properties
        const ownerOffers = await Offer.find({ ppcId: { $in: propertyIds } });

        if (!ownerOffers.length) {
            return res.status(404).json({ message: "No offers found for properties owned by this user." });
        }

        // Map offer details with property data
        const offersData = ownerOffers.map(offer => {
            const property = propertiesByOwner.find(prop => prop.ppcId === offer.ppcId);
            return {
                ppcId: offer.ppcId,
                offeredPrice: offer.price,
                status: offer.status,
                buyerPhoneNumber: offer.phoneNumber,
                createdAt:offer.createdAt,
                postedUserPhoneNumber: property ? property.phoneNumber : null, // Owner's phone
                propertyDetails: property || {}
            };
        });

        res.status(200).json({ message: "Owner's property offers fetched successfully.", offers: offersData });

    } catch (error) {
        res.status(500).json({ message: "Error fetching owner offers.", error: error.message });
    }
});


router.put('/offers/delete/:ppcId/:buyerPhoneNumber', async (req, res) => {
    try {
        const { ppcId, buyerPhoneNumber } = req.params;

        // Normalize phone number (remove non-numeric characters)
        let formattedPhoneNumber = buyerPhoneNumber.replace(/\D/g, "");

        // Handle cases where the phone number might already have "91" or "+91"
        if (formattedPhoneNumber.startsWith("91") && formattedPhoneNumber.length === 12) {
            formattedPhoneNumber = formattedPhoneNumber.slice(2); // Remove leading "91"
        }

        // Generate possible formats
        const phoneVariants = [
            formattedPhoneNumber,
            `91${formattedPhoneNumber}`,
            `+91${formattedPhoneNumber}`
        ];


        // Find the offer using $in for multiple formats
        const offer = await Offer.findOne({
            ppcId,
            phoneNumber: { $in: phoneVariants }
        });

        if (!offer) {
            return res.status(404).json({ message: "No matching offer found." });
        }

        // Fetch the corresponding property details
        const property = await AddModel.findOne({ ppcId });

        // Store previous status before updating
        const previousStatus = offer.status;

        // Update offer status to "delete"
        offer.status = "delete";
        offer.previousStatus = previousStatus; // Store old status for undo
        await offer.save();

        res.status(200).json({
            message: "Offer marked as deleted.",
            offerDetails: {
                ppcId: offer.ppcId,
                offeredPrice: offer.price,
                buyerPhoneNumber: offer.phoneNumber,
                originalPrice: property ? property.price : null,
                propertyMode: property ? property.propertyMode : null, // Sale / Rent
                propertyType: property ? property.propertyType : null, // Apartment / Villa
                postedUserPhoneNumber: property ? property.phoneNumber : null, // Owner's phone
                status: offer.status || "pending" // Ensure status is included
            }
        });

    } catch (error) {
        res.status(500).json({ message: "Error updating offer status.", error: error.message });
    }
});



router.put('/offers/undo/:ppcId/:buyerPhoneNumber', async (req, res) => {
    try {
        const { ppcId, buyerPhoneNumber } = req.params;

        // Normalize phone number (remove non-numeric characters)
        let formattedPhoneNumber = buyerPhoneNumber.replace(/\D/g, "");

        // Handle cases where the phone number might already have "91" or "+91"
        if (formattedPhoneNumber.startsWith("91") && formattedPhoneNumber.length === 12) {
            formattedPhoneNumber = formattedPhoneNumber.slice(2); // Remove leading "91"
        }

        // Generate possible formats
        const phoneVariants = [
            formattedPhoneNumber,
            `91${formattedPhoneNumber}`,
            `+91${formattedPhoneNumber}`
        ];


        // Find the deleted offer
        const offer = await Offer.findOne({
            ppcId,
            phoneNumber: { $in: phoneVariants },
            status: "delete" // Only allow undo if status is "delete"
        });

        if (!offer) {
            return res.status(404).json({ message: "No deleted offer found to restore." });
        }

        // Fetch related property details
        const property = await AddModel.findOne({ ppcId });

        // Restore previous status
        offer.status = offer.previousStatus || "pending"; // Default to "pending" if previousStatus is missing
        delete offer.previousStatus; // Remove previousStatus field
        await offer.save();

        res.status(200).json({
            message: "Offer status restored successfully.",
            restoredOffer: {
                ppcId: offer.ppcId,
                offeredPrice: offer.price,
                buyerPhoneNumber: offer.phoneNumber,
                originalPrice: property ? property.price : null,
                propertyMode: property ? property.propertyMode : null, // Sale / Rent
                propertyType: property ? property.propertyType : null, // Apartment / Villa
                postedUserPhoneNumber: property ? property.phoneNumber : null, // Owner's phone
                status: offer.status || "pending" // Ensure status is included
            }
        });

    } catch (error) {
        res.status(500).json({ message: "Error restoring offer status.", error: error.message });
    }
});


router.put("/accept-offer", async (req, res) => {
    try {
        const { ppcId, buyerPhoneNumber } = req.body;

        if (!ppcId || !buyerPhoneNumber) {
            return res.status(400).json({ message: "Missing required fields." });
        }

        // Normalize phone number format
        let formattedPhoneNumber = buyerPhoneNumber.replace(/\D/g, "");
        if (formattedPhoneNumber.startsWith("91") && formattedPhoneNumber.length === 12) {
            formattedPhoneNumber = formattedPhoneNumber.slice(2);
        }


        // Find the offer
        const offer = await Offer.findOne({
            ppcId,
            phoneNumber: { $regex: `${formattedPhoneNumber}$`, $options: "i" },
        });

        if (!offer) {
            return res.status(404).json({ message: "Offer not found for the given property and buyer." });
        }

        // ✅ Update status to "accept"
        offer.status = "accept";
        await offer.save();

        res.status(200).json({ message: "Offer accepted successfully.", updatedOffer: offer });

    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

router.put('/offers/deleted/:ppcId/:buyerPhoneNumber', async (req, res) => {
    try {
        const { ppcId, buyerPhoneNumber } = req.params;

        // Normalize phone number (remove non-numeric characters)
        let formattedPhoneNumber = buyerPhoneNumber.replace(/\D/g, "");

        // Handle cases where the phone number might already have "91" or "+91"
        if (formattedPhoneNumber.startsWith("91") && formattedPhoneNumber.length === 12) {
            formattedPhoneNumber = formattedPhoneNumber.slice(2); // Remove leading "91"
        }

        // Generate possible formats
        const phoneVariants = [
            formattedPhoneNumber,
            `91${formattedPhoneNumber}`,
            `+91${formattedPhoneNumber}`
        ];


        // Find the offer using $in for multiple formats
        const offer = await Offer.findOne({
            ppcId,
            phoneNumber: { $in: phoneVariants }
        });

        if (!offer) {
            return res.status(404).json({ message: "No matching offer found." });
        }

        // Store previous status before updating
        const previousStatus = offer.status;

        // Update offer status to "delete"
        offer.status = "delete";
        offer.previousStatus = previousStatus; // Store old status for undo
        await offer.save();

        res.status(200).json({
            message: "Offer marked as deleted.",
            offerDetails: offer // Sending full offer details in the response
        });

    } catch (error) {
        res.status(500).json({ message: "Error updating offer status.", error: error.message });
    }
});



router.put("/reject-offer", async (req, res) => {
    try {
        const { ppcId, buyerPhoneNumber } = req.body;

        if (!ppcId || !buyerPhoneNumber) {
            return res.status(400).json({ message: "Missing required fields." });
        }

        // Normalize phone number format
        let formattedPhoneNumber = buyerPhoneNumber.replace(/\D/g, "");
        if (formattedPhoneNumber.startsWith("91") && formattedPhoneNumber.length === 12) {
            formattedPhoneNumber = formattedPhoneNumber.slice(2);
        }


        // Find the offer
        const offer = await Offer.findOne({
            ppcId,
            phoneNumber: { $regex: `${formattedPhoneNumber}$`, $options: "i" },
        });

        if (!offer) {
            return res.status(404).json({ message: "Offer not found for the given property and buyer." });
        }

        offer.status = "reject";
        await offer.save();

        res.status(200).json({ message: "Offer rejected successfully.", updatedOffer: offer });

    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});



// Fetch All Offers
// router.get("/fetch-offers", async (req, res) => {
//     try {
//       const offers = await Offer.find();
//       res.status(200).json({ message: "Offers fetched successfully!", data: offers });
//     } catch (error) {
//       res.status(500).json({ message: "Error fetching offers", error });
//     }
//   });
  
  // Fetch Single Offer by ID
  router.get("/fetch-offer/:id", async (req, res) => {
    try {
      const offer = await Offer.findById(req.params.id);
      if (!offer) {
        return res.status(404).json({ message: "Offer not found" });
      }
      res.status(200).json({ message: "Offer fetched successfully!", data: offer });
    } catch (error) {
      res.status(500).json({ message: "Error fetching offer", error });
    }
  });
  
  // Update Offer by ID
  router.put("/update-offer/:id", async (req, res) => {
    try {
      const updatedOffer = await Offer.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!updatedOffer) {
        return res.status(404).json({ message: "Offer not found" });
      }
      res.status(200).json({ message: "Offer updated successfully!", data: updatedOffer });
    } catch (error) {
      res.status(500).json({ message: "Error updating offer", error });
    }
  });
  
  // Delete Offer by ID
  router.delete("/delete-offer/:id", async (req, res) => {
    try {
      const deletedOffer = await Offer.findByIdAndDelete(req.params.id);
      if (!deletedOffer) {
        return res.status(404).json({ message: "Offer not found" });
      }
      res.status(200).json({ message: "Offer deleted successfully!" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting offer", error });
    }
  });


  
// Accept Offer by ID
router.put("/accept-offer/:id", async (req, res) => {
    try {
      const updatedOffer = await Offer.findByIdAndUpdate(req.params.id, { status: "accept" }, { new: true });
      if (!updatedOffer) {
        return res.status(404).json({ message: "Offer not found" });
      }
      res.status(200).json({ message: "Offer accepted successfully!", data: updatedOffer });
    } catch (error) {
      res.status(500).json({ message: "Error accepting offer", error });
    }
  });
  
  // Reject Offer by ID
  router.put("/reject-offer/:id", async (req, res) => {
    try {
      const updatedOffer = await Offer.findByIdAndUpdate(req.params.id, { status: "reject" }, { new: true });
      if (!updatedOffer) {
        return res.status(404).json({ message: "Offer not found" });
      }
      res.status(200).json({ message: "Offer rejected successfully!", data: updatedOffer });
    } catch (error) {
      res.status(500).json({ message: "Error rejecting offer", error });
    }
  });
  

module.exports = router;



















