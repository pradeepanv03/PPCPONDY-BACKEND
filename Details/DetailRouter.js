const express = require('express');
const AddModel = require('../AddModel');
const DetailSchema = require ('./DetailModel');
const { updateSearchIndex } = require('../SendDataAdmin/DataModel');

const router = express.Router();


router.post("/send-interests", async (req, res) => {
    const { phoneNumber, ppcId } = req.body;

    try {
        const property = await AddModel.findOne({ ppcId });

        if (!property) {
            return res.status(404).json({ message: "Property not found" });
        }

        // Check if the user has already shown interest in this property
        const isAlreadyInterested = property.interestRequests.some(
            (request) => request.phoneNumber === phoneNumber
        );

        if (isAlreadyInterested) {
            return res.status(400).json({
                message: "You have already shown interest in this property.",
                status: "alreadySaved",
                alreadySaved: property.interestRequests.map(req => req.phoneNumber),
            });
        }

        // Add interest request and update timestamp
        const updatedProperty = await AddModel.findOneAndUpdate(
            { ppcId },
            {
                $push: { interestRequests: { phoneNumber, createdAt: new Date() } },
                $set: { updatedAt: new Date() }
            },
            { new: true }
        );

        return res.status(200).json({
            message: "Your interest has been recorded!",
            status: "sendInterest",
            postedUserPhoneNumber: updatedProperty.phoneNumber,
            ownerName: updatedProperty.ownerName, 
            propertyMode: updatedProperty.propertyMode,
            propertyType: updatedProperty.propertyType,
            price: updatedProperty.price,
            area: updatedProperty.area,
            city:updatedProperty.city,
            createdAt:updatedProperty.createdAt,
            updatedAt:updatedProperty.updatedAt,
            alreadySaved: updatedProperty.interestRequests.map(req => req.phoneNumber),
            views: updatedProperty.views,
            photos: updatedProperty.photos || []
        });

    } catch (error) {
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});



router.get('/get-interest-owner', async (req, res) => {
    try {
        const { phoneNumber } = req.query;  // Extract phoneNumber from query parameters
        
        if (!phoneNumber) {
            return res.status(400).json({ message: 'Phone number is required.' });
        }

        // Fetch properties where the phone number is included in the interestRequests
        const propertiesWithInterestRequests = await AddModel.find({
            'interestRequests.phoneNumber': phoneNumber
        });

        if (propertiesWithInterestRequests.length === 0) {
            return res.status(404).json({ message: 'No properties found for this phone number.' });
        }

        // Map through the properties to get the relevant data
        const interestRequestsData = propertiesWithInterestRequests.map(property => ({
            ppcId: property.ppcId,
            postedUserPhoneNumber: property.phoneNumber,  // Property owner's phone number
            interestedUserPhoneNumbers: property.interestRequests ? 
                property.interestRequests.map(request => request.phoneNumber) : [],  // Collecting the phone numbers of users who showed interest
                views: property.views || 0,
                propertyMode:property.propertyMode,
                propertyType:property.propertyType,
                area:property.area,
                city:property.city,
                createdAt:property.createdAt,
                updatedAt:property.updatedAt,
                price:property.price,
            status: property.status  ,
            photos: property.photos || []               
        }));

        return res.status(200).json({ message: 'Interest requests fetched successfully', interestRequestsData });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});



// ✅ Get interested buyers for properties posted by a specific user
router.get("/get-interest-buyers", async (req, res) => {
    try {
      let { postedPhoneNumber } = req.query;
  
      if (!postedPhoneNumber) {
        return res.status(400).json({ message: "Posted user phone number is required." });
      }
  
      // Normalize phone number format (removes non-numeric characters)
      postedPhoneNumber = postedPhoneNumber.replace(/\D/g, "");
      if (postedPhoneNumber.startsWith("91") && postedPhoneNumber.length === 12) {
        postedPhoneNumber = postedPhoneNumber.slice(2);
      }
  
      // Find properties posted by the owner
      const propertiesByOwner = await AddModel.find({
        $or: [
          { phoneNumber: postedPhoneNumber },
          { phoneNumber: `+91${postedPhoneNumber}` },
          { phoneNumber: `91${postedPhoneNumber}` }
        ]
      });
  
      if (!propertiesByOwner.length) {
        return res.status(404).json({ message: "No properties found for this owner." });
      }
  
      // Extract only properties with interested buyers
      const propertiesWithInterest = propertiesByOwner
        .filter(property => property.interestRequests?.length > 0)
        .map(property => ({
          ppcId: property.ppcId,
          _id: property._id,
          status: property.status,
          views: property.views || 0,
          propertyMode:property.propertyMode,
          propertyType:property.propertyType,
          area:property.area,
          city:property.city,
          createdAt:property.createdAt,
          updatedAt:property.updatedAt,
          price:property.price,
          photos: property.photos || [],
          postedUserPhoneNumber: property.phoneNumber,
          propertyDetails: property.propertyDetails || {},
          interestedUsers: property.interestRequests.map(req => req.phoneNumber),
        }));
  
      if (!propertiesWithInterest.length) {
        return res.status(404).json({ message: "No interested buyers found for this owner." });
      }
  
      return res.status(200).json({ message: "Properties with interested buyers", propertiesData: propertiesWithInterest });
  
    } catch (error) {
      return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
  });
  
  // ✅ Delete property or remove interest based on ppcId and phoneNumber
  router.post("/delete-details-property", async (req, res) => {
    const { ppcId, phoneNumber } = req.body;
  
    try {
      // Find the property by its ppcId
      const property = await AddModel.findOne({ ppcId });
  
      if (!property) {
        return res.status(404).json({ message: "Property not found." });
      }
  
      // Check if the user's phone number exists in the interestRequests array
      const userInterestIndex = property.interestRequests.findIndex(request => request.phoneNumber === phoneNumber);
      
      if (userInterestIndex !== -1) {
        // If user exists, remove their interest
        property.interestRequests.splice(userInterestIndex, 1);
      }
  
      // If there are no more interested users, mark the property as 'deleted'
      if (property.interestRequests.length === 0) {
        property.status = "delete";
      }
  
      await property.save();
  
      return res.status(200).json({ message: "Property status updated successfully.", property });
  
    } catch (error) {
      return res.status(500).json({ message: "Error removing property.", error: error.message });
    }
  });

router.get('/get-all-sendinterest', async (req, res) => {
    try {
        // Fetch all properties where interest requests exist
        const interestedProperties = await AddModel.find({ interestRequests: { $exists: true, $ne: [] } });

        // If no interested properties are found
        if (interestedProperties.length === 0) {
            return res.status(404).json({ message: 'No interest requests found.' });
        }

        // Extracting interest request details
        const interestRequestsData = interestedProperties.map(property => ({
            ppcId: property.ppcId,
            postedUserPhoneNumber: property.phoneNumber, // Property owner's phone number
            interestedUserPhoneNumbers: property.interestRequests.map(request => request.phoneNumber),
            propertyMode: property.propertyMode, // Rent/Sale
            propertyType: property.propertyType, // House/Apartment
            price: property.price, // Property price
            area: property.area,
            ownerName: property.ownerName || 'Unknown', // Fallback if owner name is missing
            views: property.views || 0, // Default views to 0 if missing
            createdAt: property.createdAt,
            updatedAt: property.updatedAt
        }));

        const propertiesData = interestedProperties.map(property => ({
            ppcId: property.ppcId,
            postedUserPhoneNumber: property.phoneNumber, // Property owner's phone number
            propertyDetails: property.propertyDetails || 'No details available', // Fallback value
            interestedUsers: property.interestRequests.map(request => request.phoneNumber),
            views: property.views || 0,
            views: property.views || 0,
            propertyMode:property.propertyMode,
            propertyType:property.propertyType,
            area:property.area,
            city:property.city,
            createdAt:property.createdAt,
            updatedAt:property.updatedAt,
            price:property.price,
            status: property.status  ,
            photos: property.photos || [],  
        }));

        return res.status(200).json({
            message: 'Interest request data fetched successfully',
            interestRequestsData,
            propertiesData
        });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});


// Delete property by PPC ID
router.delete('/delete-interest/:ppcId', async (req, res) => {
    try {
        const { ppcId } = req.params;  // Extract PPC ID from URL params

        // Find and delete the property with the given PPC ID
        const deletedProperty = await AddModel.findOneAndDelete({ ppcId });

        if (!deletedProperty) {
            return res.status(404).json({ message: 'Property not found.' });
        }

        return res.status(200).json({ message: 'Property deleted successfully.' });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});


router.get('/get-all-owners-and-buyers', async (req, res) => {
    try {
        // Fetch all properties from the database
        const allProperties = await AddModel.find({});

        // If no properties are found
        if (allProperties.length === 0) {
            return res.status(404).json({ message: 'No properties found.' });
        }

        // Extract owners' and buyers' data separately
        const owners = allProperties.map(property => ({
            ppcId: property.ppcId,
            status: property.status  ,
            photos: property.photos || [],            
            ownerPhoneNumber: property.phoneNumber,  // Property owner's phone number
            views: property.views || 0,
            propertyMode:property.propertyMode,
            propertyType:property.propertyType,
            area:property.area,
            city:property.city,
            createdAt:property.createdAt,
            updatedAt:property.updatedAt,
            price:property.price,
            propertyDetails: property.propertyDetails  // Additional property details
        }));

        const buyers = [];

        allProperties.forEach(property => {
            if (property.interestRequests && property.interestRequests.length > 0) {
                property.interestRequests.forEach(request => {
                    buyers.push({
                        interestedUserPhoneNumber: request.phoneNumber,
                        interestedInPpcId: property.ppcId,
                        interestedInOwnerPhoneNumber: property.phoneNumber,
                        views: property.views || 0,
            propertyMode:property.propertyMode,
            propertyType:property.propertyType,
            area:property.area,
            city:property.city,
            createdAt:property.createdAt,
            updatedAt:property.updatedAt,
            price:property.price,
                        views: property.views || 0,  // Default to 0 if undefined
                        createdAt: property.createdAt,
                        updatedAt: property.updatedAt,
                        status: property.status  ,
                        photos: property.photos || [],  
                    });
                });
            }
        });

        return res.status(200).json({ message: 'Owners and Buyers fetched successfully', owners, buyers });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});




// ******* Need Help ********




router.post('/need-help', async (req, res) => {
    const { phoneNumber, ppcId } = req.body;

    try {
        const property = await AddModel.findOne({ ppcId });

        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        // Check if the phone number has already requested help for this property
        const isAlreadyInterested = property.helpRequests.some(
            (request) => request.phoneNumber === phoneNumber
        );

        if (isAlreadyInterested) {
            return res.status(400).json({
                message: "You have already requested help for this property.",
                status: "alreadySaved",
                alreadySavedNumbers: property.helpRequests.map((request) => request.phoneNumber),
            });
        }

        // Add the new help request
        const updatedProperty = await AddModel.findOneAndUpdate(
            { ppcId },
            { 
                $push: { helpRequests: { phoneNumber } }, // Store the requesting phone number
                $set: { updatedAt: Date.now() }
            },
            { new: true } // Return the updated document
        );

        return res.status(200).json({
            message: 'Your help request has been recorded!',
            status: 'needHelp',
            postedUserPhoneNumber: updatedProperty.phoneNumber, // Owner's phone number
            ownerName: updatedProperty.ownerName, 
            propertyMode: updatedProperty.propertyMode,
            propertyType: updatedProperty.propertyType,
            price: updatedProperty.price,
            area: updatedProperty.area,
            city:updatedProperty.city,
            createdAt:updatedProperty.createdAt,
            updatedAt:updatedProperty.updatedAt,
            views: updatedProperty.views, // Current views count
            status: updatedProperty.status,
            photos: updatedProperty.photos || [],  
            helpRequestedUserPhoneNumbers: updatedProperty.helpRequests.map(req => req.phoneNumber) // List of help request numbers
        });

    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});



router.get('/get-help-as-buyer', async (req, res) => {
    try {
        let { postedPhoneNumber } = req.query;

        if (!postedPhoneNumber) {
            return res.status(400).json({ message: 'Posted user phone number is required.' });
        }

        // Normalize phone number format
        postedPhoneNumber = postedPhoneNumber.replace(/\D/g, '');
        if (postedPhoneNumber.startsWith('91') && postedPhoneNumber.length === 12) {
            postedPhoneNumber = postedPhoneNumber.slice(2);
        }

        // Find properties with help requests
        const propertiesWithBuyerHelpRequests = await AddModel.find({
            $or: [
                { phoneNumber: postedPhoneNumber },
                { phoneNumber: `+91${postedPhoneNumber}` },
                { phoneNumber: `91${postedPhoneNumber}` }
            ]
        });

        if (propertiesWithBuyerHelpRequests.length === 0) {
            return res.status(404).json({ message: 'No properties found for this buyer help request.' });
        }

        // Map properties with help requests
        const helpRequestsData = propertiesWithBuyerHelpRequests.map(property => ({
            ppcId: property.ppcId,
            status: property.status,
            views: property.views || 0,
            propertyMode:property.propertyMode,
            propertyType:property.propertyType,
            area:property.area,
            city:property.city,
            createdAt:property.createdAt,
            updatedAt:property.updatedAt,
            price:property.price,
            photos: property.photos || [],
            postedUserPhoneNumber: property.phoneNumber,
            propertyDetails: property.propertyDetails || {},
            helpRequestersPhoneNumbers: (property.helpRequests || [])
                .filter(req => req.phoneNumber)
                .map(req => req.phoneNumber)
        }));

        return res.status(200).json({
            message: 'Properties with help requests fetched successfully.',
            helpRequestsData
        });

    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});



router.get('/get-help-as-owner', async (req, res) => {
    const { phoneNumber } = req.query;  // Extract phoneNumber from query parameters

    if (!phoneNumber) {
        return res.status(400).json({ message: 'Phone number is required.' });
    }

    try {
        // Fetch properties where the helpRequests include this phoneNumber
        const propertiesWithHelpRequests = await AddModel.find({
            'helpRequests.phoneNumber': phoneNumber
        });

        if (propertiesWithHelpRequests.length === 0) {
            return res.status(404).json({ message: 'No properties found with help requests for this phone number.' });
        }

        const helpRequestsData = propertiesWithHelpRequests.map(property => ({
            ppcId: property.ppcId,
            status: property.status,
            photos: property.photos || [],  
            postedUserPhoneNumber: property.phoneNumber,  
            ownerName: property.ownerName,
            views: property.views || 0,
            propertyMode:property.propertyMode,
            propertyType:property.propertyType,
            area:property.area,
            city:property.city,
            createdAt:property.createdAt,
            updatedAt:property.updatedAt,
            price:property.price,
            helpRequestedUserPhoneNumbers: property.helpRequests 
                ? property.helpRequests.map(request => request.phoneNumber) 
                : [],  
        }));

        return res.status(200).json({ 
            message: 'Help requests fetched successfully', 
            helpRequestsData 
        });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});



router.get('/get-all-help-requests', async (req, res) => {
    try {
        // Fetch all properties where help requests exist
        const propertiesWithHelpRequests = await AddModel.find({ helpRequests: { $exists: true, $ne: [] } });

        // If no help request properties are found
        if (propertiesWithHelpRequests.length === 0) {
            return res.status(404).json({ message: 'No help requests found.' });
        }

        // Extracting help request details for owners
        const helpRequestsData = propertiesWithHelpRequests.map(property => ({
            ppcId: property.ppcId,
            postedUserPhoneNumber: property.phoneNumber, // Property owner's phone number
            helpRequestedUserPhoneNumbers: property.helpRequests.map(request => request.phoneNumber),
            propertyMode: property.propertyMode, // Rent/Sale
            propertyType: property.propertyType, // House/Apartment
            price: property.price, // Property price
            area: property.area,
            ownerName: property.ownerName || 'Unknown', // Fallback if owner name is missing
            views: property.views || 0, // Default views to 0 if missing
            views: property.views || 0,
            propertyMode:property.propertyMode,
            propertyType:property.propertyType,
            area:property.area,
            city:property.city,
            createdAt:property.createdAt,
            updatedAt:property.updatedAt,
            price:property.price,
            status: property.status  ,
            photos: property.photos || [],  
        }));

        // Extracting help request details for buyers
        const propertiesData = propertiesWithHelpRequests.map(property => ({
            ppcId: property.ppcId,
            postedUserPhoneNumber: property.phoneNumber, // Property owner's phone number
            propertyDetails: property.propertyDetails || 'No details available', // Fallback value
            helpRequesters: property.helpRequests.map(request => request.phoneNumber),
            views: property.views || 0,
            views: property.views || 0,
            propertyMode:property.propertyMode,
            propertyType:property.propertyType,
            area:property.area,
            city:property.city,
            createdAt:property.createdAt,
            updatedAt:property.updatedAt,
            price:property.price,
            status: property.status  ,
            photos: property.photos || [],  
        }));

        return res.status(200).json({
            message: 'Help request data fetched successfully',
            helpRequestsData,
            propertiesData
        });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});



// Delete a help request for a specific property (ppcId)
router.delete('/delete-help/:ppcId', async (req, res) => {
    try {
        const { ppcId } = req.params;  // Extract PPC ID from URL params

        // Update the property by pulling out the helpRequests entry
        const updatedProperty = await AddModel.findOneAndUpdate(
            { ppcId },
            { $pull: { helpRequests: { phoneNumber: { $exists: true } } } },
            { new: true }
        );

        if (!updatedProperty) {
            return res.status(404).json({ message: 'Property not found or no help request to delete.' });
        }

        return res.status(200).json({ message: 'Help request removed successfully.' });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});


// ********* Contact ***********

router.post('/contact', async (req, res) => {
    const { phoneNumber, ppcId } = req.body;

    try {
        // Find the property by its ppcId
        const property = await AddModel.findOne({ ppcId });

        if (!property) {
            return res.status(404).json({ success: false, message: 'Property not found' });
        }

        const postedUserPhoneNumber = property.phoneNumber;
        const propertyMode = property.propertyMode;
        const propertyType = property.propertyType;
        const price = property.price;
        const area = property.area;
        const email = property.email;
        const bestTimeToCall = property.bestTimeToCall;
        const ownerName = property.ownerName;
        const status = property.status;
        const photos = property.photos || [];
        
        if (!postedUserPhoneNumber) {
            return res.status(404).json({ success: false, message: 'Phone number not found for the property owner.' });
        }

        // Check if the user has already made a contact request
        const isAlreadyContacted = property.contactRequests.some(req => req.phoneNumber === phoneNumber);

        if (isAlreadyContacted) {
            return res.status(400).json({
                success: false,
                message: 'You have already requested contact for this property.',
                status: 'alreadyContacted',
                alreadyContactedNumbers: property.contactRequests.map(req => req.phoneNumber),
            });
        }

        // Add the phone number to the contactRequests array and update other fields
        const updatedProperty = await AddModel.findOneAndUpdate(
            { ppcId },
            {
                $push: { contactRequests: { phoneNumber, createdAt: new Date() } },
                $set: { status: 'contact', updatedAt: new Date() },
                $inc: { views: 1 }
            },
            { new: true } // Return the updated document
        );

        if (!updatedProperty) {
            return res.status(500).json({ success: false, message: 'Failed to update contact requests.' });
        }

        return res.status(200).json({
            success: true,
            message: 'Your contact request has been recorded!',
            status: 'contact',
            postedUserPhoneNumber,
            email,
            propertyMode,
            propertyType,
            price,
            area,
            bestTimeToCall,
            ownerName,
            status: updatedProperty.status,
            photos,
            views: updatedProperty.views,
            contactRequests: updatedProperty.contactRequests, // Send updated contactRequests array
            createdAt: new Date(),
            updatedAt: new Date()
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
});


router.get("/get-contact-buyer", async (req, res) => {
    try {
        let { postedPhoneNumber } = req.query;

        if (!postedPhoneNumber) {
            return res.status(400).json({ message: "Posted user phone number is required." });
        }

        // Normalize phone number format for consistent querying
        postedPhoneNumber = postedPhoneNumber.replace(/\D/g, ""); // Remove non-numeric characters
        if (postedPhoneNumber.startsWith("91") && postedPhoneNumber.length === 12) {
            postedPhoneNumber = postedPhoneNumber.slice(2); // Convert '917878789090' → '7878789090'
        }

        // Find properties listed by this owner
        const propertiesWithBuyerContactRequests = await AddModel.find({
            $or: [
                { phoneNumber: postedPhoneNumber },
                { phoneNumber: `+91${postedPhoneNumber}` },
                { phoneNumber: `91${postedPhoneNumber}` }
            ]
        });

        if (propertiesWithBuyerContactRequests.length === 0) {
            return res.status(404).json({ message: "No properties found for this owner." });
        }

        // Map properties and fetch contact request phone numbers
        const contactRequestsData = propertiesWithBuyerContactRequests.map(property => ({
            ppcId: property.ppcId,
            status: property.status,
            views: property.views || 0,
            propertyMode:property.propertyMode,
            propertyType:property.propertyType,
            area:property.area,
            city:property.city,
            createdAt:property.createdAt,
            updatedAt:property.updatedAt,
            price:property.price,
            photos: property.photos || [],
            postedUserPhoneNumber: property.phoneNumber,
            propertyDetails: property.propertyDetails || {},
            contactRequestersPhoneNumbers: property.contactRequests
                .filter(req => req.phoneNumber) // Ensure no null values
                .map(req => req.phoneNumber)
        }));

        return res.status(200).json({
            message: "Properties with contact requests fetched successfully.",
            contactRequestsData
        });

    } catch (error) {
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// 📌 PUT: Delete a Contact Buyer Request
router.put("/contact/delete/:ppcId/:contactUser", async (req, res) => {
    try {
        const { ppcId, contactUser } = req.params;

        const property = await AddModel.findOne({ ppcId });
        if (!property) {
            return res.status(404).json({ message: "Property not found." });
        }

        // Filter out the deleted contact request
        property.contactRequests = property.contactRequests.filter(req => req.phoneNumber !== contactUser);

        await property.save();

        return res.status(200).json({ message: "Contact request deleted successfully." });

    } catch (error) {
        return res.status(500).json({ message: "Error deleting contact request.", error: error.message });
    }
});

// 📌 PUT: Undo a Deleted Contact Buyer Request
router.put("/contact/undo/:ppcId/:contactUser", async (req, res) => {
    try {
        const { ppcId, contactUser } = req.params;

        const property = await AddModel.findOne({ ppcId });
        if (!property) {
            return res.status(404).json({ message: "Property not found." });
        }

        // Check if the contact already exists to prevent duplicates
        if (!property.contactRequests.some(req => req.phoneNumber === contactUser)) {
            property.contactRequests.push({ phoneNumber: contactUser });
        }

        await property.save();

        return res.status(200).json({
            message: "Contact request restored successfully.",
            property,
            createdAt:property.createdAt
        });

    } catch (error) {
        return res.status(500).json({ message: "Error restoring contact request.", error: error.message });
    }
});


router.get('/get-contact-owner', async (req, res) => {
    const { phoneNumber } = req.query;  // Extract phoneNumber from query parameters

    if (!phoneNumber) {
        return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    try {
        // Fetch properties where the phone number is in the contactRequests array
        const propertiesWithContactRequests = await AddModel.find({
            'contactRequests.phoneNumber': phoneNumber
        });

        if (!propertiesWithContactRequests.length) {
            return res.status(404).json({ success: false, message: 'No properties found with contact requests for this phone number.' });
        }

        const contactRequestsData = propertiesWithContactRequests.map(property => ({
            ppcId: property.ppcId,
            postedUserPhoneNumber: property.phoneNumber,  // Property owner's phone number
            contactRequestedUserPhoneNumbers: property.contactRequests.map(req => req.phoneNumber),  
            views: property.views || 0,
            propertyMode:property.propertyMode,
            propertyType:property.propertyType,
            area:property.area,
            city:property.city,
            createdAt:property.createdAt,
            updatedAt:property.updatedAt,
            price:property.price,
            bestTimeToCall: property.bestTimeToCall,
            email: property.email,
            status: property.status,
            photos: property.photos || [],  
        }));

        return res.status(200).json({ success: true, message: 'Contact requests fetched successfully', contactRequestsData });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
});


router.get('/get-all-contact-requests', async (req, res) => {
    try {
        // Fetch all properties where contact requests exist
        const propertiesWithContactRequests = await AddModel.find({ contactRequests: { $exists: true, $ne: [] } });

        // If no contact request properties are found
        if (propertiesWithContactRequests.length === 0) {
            return res.status(404).json({ message: 'No contact requests found.' });
        }

        // Extracting contact request details for owners
        const contactRequestsData = propertiesWithContactRequests.map(property => ({
            ppcId: property.ppcId,
            postedUserPhoneNumber: property.phoneNumber, // Property owner's phone number
            contactRequestedUserPhoneNumbers: property.contactRequests.map(request => request.phoneNumber),
            propertyMode: property.propertyMode, // Rent/Sale
            propertyType: property.propertyType, // House/Apartment
            price: property.price, // Property price
            area: property.area,
            bestTimeToCall: property.bestTimeToCall || 'Not specified', // Default if missing
            email: property.email || 'Not provided', // Default if missing
            views: property.views || 0, // Default views to 0 if missing
            createdAt: property.createdAt,
            updatedAt: property.updatedAt,
            status: property.status  ,
            photos: property.photos || [],  
        }));

        // Extracting contact request details for buyers
        const propertiesData = propertiesWithContactRequests.map(property => ({
            ppcId: property.ppcId,
            postedUserPhoneNumber: property.phoneNumber, // Property owner's phone number
            propertyDetails: property.propertyDetails || 'No details available', // Fallback value
            contactRequesters: property.contactRequests.map(request => request.phoneNumber),
            bestTimeToCall: property.bestTimeToCall || 'Not specified',
            email: property.email || 'Not provided',
            views: property.views || 0,
            views: property.views || 0,
            propertyMode:property.propertyMode,
            propertyType:property.propertyType,
            area:property.area,
            city:property.city,
            createdAt:property.createdAt,
            updatedAt:property.updatedAt,
            price:property.price,
            status: property.status  ,
            photos: property.photos || [],  
        }));

        return res.status(200).json({
            message: 'Contact request data fetched successfully',
            contactRequestsData,
            propertiesData
        });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});


// Delete all contact requests for a specific property (ppcId)
router.delete('/delete-contact/:ppcId', async (req, res) => {
    try {
        const { ppcId } = req.params;

        // Clear all contact requests for the property
        const updatedProperty = await AddModel.findOneAndUpdate(
            { ppcId },
            { $set: { contactRequests: [] } }, // Removes all contact requests
            { new: true }
        );

        if (!updatedProperty) {
            return res.status(404).json({ message: 'Property not found or no contact requests to delete.' });
        }

        return res.status(200).json({ message: 'All contact requests removed successfully.' });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});




// **************** Report Property **************



router.post('/report-property', async (req, res) => {
    const { phoneNumber, ppcId, reportReason } = req.body;

    try {
        const property = await AddModel.findOne({ ppcId });

        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        // Check if the phone number has already reported this property
        const isAlreadyReported = property.reportProperty.some(
            (request) => request.phoneNumber === phoneNumber
        );

        if (isAlreadyReported) {
            return res.status(400).json({
                message: "You have already reported this property.",
                status: "alreadyReported",
                reportedNumbers: property.reportProperty.map(req => req.phoneNumber), // Show existing reported numbers
            });
        }

        // Update the property with the new report request
        const updatedProperty = await AddModel.findOneAndUpdate(
            { ppcId },
            { 
                $push: { reportProperty: { phoneNumber, reportReason, createdAt: new Date() } },
                $set: { updatedAt: new Date() }
            },
            { new: true } // Return updated document
        );

        return res.status(200).json({
            message: 'Your report has been recorded!',
            status: 'reportProperties',
            postedUserPhoneNumber: updatedProperty.phoneNumber,
            ownerName: updatedProperty.ownerName, 
            propertyMode: updatedProperty.propertyMode,
            propertyType: updatedProperty.propertyType,
            price: updatedProperty.price,
            area: updatedProperty.area,
            city:updatedProperty.city,
            createdAt:updatedProperty.createdAt,
            updatedAt:updatedProperty.updatedAt,
            views: updatedProperty.views,
            status: updatedProperty.status,
            photos: updatedProperty.photos || [],
            reportedNumbers: updatedProperty.reportProperty.map(req => ({ 
                phoneNumber: req.phoneNumber, 
                reportReason: req.reportReason 
            })) // Return all reported numbers and reasons
        });

    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});


router.get('/get-reportproperty-buyer', async (req, res) => {
    try {
        let { postedPhoneNumber } = req.query;

        if (!postedPhoneNumber) {
            return res.status(400).json({ message: 'Posted user phone number is required.' });
        }

        // Normalize phone number format for consistent querying
        postedPhoneNumber = postedPhoneNumber.replace(/\D/g, ''); // Remove non-numeric characters
        if (postedPhoneNumber.startsWith('91') && postedPhoneNumber.length === 12) {
            postedPhoneNumber = postedPhoneNumber.slice(2); // Convert '917878789090' → '7878789090'
        }

        // Fetch properties where the buyer has reported issues
        const propertiesWithBuyerReportRequests = await AddModel.find({
            $or: [
                { phoneNumber: postedPhoneNumber },
                { phoneNumber: `+91${postedPhoneNumber}` },
                { phoneNumber: `91${postedPhoneNumber}` }
            ]
        });

        if (propertiesWithBuyerReportRequests.length === 0) {
            return res.status(404).json({ message: 'No properties found for this buyer report request.' });
        }

        // Map properties to include report requests
        const reportPropertyRequestsData = propertiesWithBuyerReportRequests.map(property => ({
            ppcId: property.ppcId,
            status: property.status,
            views: property.views || 0,
            propertyMode:property.propertyMode,
            propertyType:property.propertyType,
            area:property.area,
            city:property.city,
            createdAt:property.createdAt,
            updatedAt:property.updatedAt,
            price:property.price,
            photos: property.photos || [],
            postedUserPhoneNumber: property.phoneNumber, // Owner's phone number
            propertyDetails: property.propertyDetails || {},
            reportPropertyRequestersPhoneNumbers: (property.reportProperty || []) // Ensure it's an array
                .filter(req => req.phoneNumber) // Remove empty/null entries
                .map(req => req.phoneNumber) // Get phone numbers
        }));

        return res.status(200).json({
            message: 'Properties with report requests fetched successfully.',
            reportPropertyRequestsData
        });

    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});

// ✅ Delete Report Property Request
router.put("/reportproperty/delete/:ppcId/:phoneNumber", async (req, res) => {
    try {
        const { ppcId, phoneNumber } = req.params;

        const property = await AddModel.findOne({ ppcId });

        if (!property) {
            return res.status(404).json({ message: "Property not found." });
        }

        // Find the report request related to the phoneNumber
        const reportIndex = property.reportProperty.findIndex(req => req.phoneNumber === phoneNumber);

        if (reportIndex === -1) {
            return res.status(404).json({ message: "Report request not found." });
        }

        // Remove the specific report request
        property.reportProperty.splice(reportIndex, 1);

        // If no reports remain, change status
        if (property.reportProperty.length === 0) {
            property.status = "active"; // Reset status if no reports exist
        }

        await property.save();

        res.status(200).json({ message: "Report request removed successfully.", property });
    } catch (error) {
        res.status(500).json({ message: "Error deleting report request.", error: error.message });
    }
});

// ✅ Undo Report Property Request Deletion
router.put("/reportproperty/undo/:ppcId/:phoneNumber", async (req, res) => {
    try {
        const { ppcId, phoneNumber } = req.params;

        const property = await AddModel.findOne({ ppcId });

        if (!property) {
            return res.status(404).json({ message: "Property not found." });
        }

        // Restore the report request if it was deleted
        if (!property.reportProperty.some(req => req.phoneNumber === phoneNumber)) {
            property.reportProperty.push({ phoneNumber, date: new Date() });
        }

        // Optionally update status
        property.status = property.previousStatus || "active";

        await property.save();

        res.status(200).json({ message: "Report request restored successfully!", property });
    } catch (error) {
        res.status(500).json({ message: "Error restoring report request.", error: error.message });
    }
});

router.get('/get-reportproperty-owner', async (req, res) => {
    const { phoneNumber } = req.query;  // Extract phoneNumber from query parameters

    if (!phoneNumber) {
        return res.status(400).json({ message: 'Phone number is required.' });
    }

    try {
        // Fetch properties where the phone number is included in the helpRequests
        const propertiesWithreportPropertyRequests = await AddModel.find({
            'reportProperty.phoneNumber': phoneNumber
        });

        if (propertiesWithreportPropertyRequests.length === 0) {
            return res.status(404).json({ message: 'No properties found with help requests for this phone number.' });
        }

        const reportPropertyRequestsData = propertiesWithreportPropertyRequests.map(property => ({
            ppcId: property.ppcId,
            postedUserPhoneNumber: property.phoneNumber,  // Property owner's phone number
            reportPropertyRequestedUserPhoneNumbers: Array.isArray(property.reportPropertyRequests) ? 
                property.reportPropertyRequests.map(request => request.phoneNumber) : [],  
                views: property.views || 0,
                propertyMode:property.propertyMode,
                propertyType:property.propertyType,
                area:property.area,
                city:property.city,
                createdAt:property.createdAt,
                updatedAt:property.updatedAt,
                price:property.price,
            status: property.status  ,
            photos: property.photos || [],  
        }));

        return res.status(200).json({ message: 'Help requests fetched successfully', reportPropertyRequestsData });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});


router.get('/get-all-reportproperty-requests', async (req, res) => {
    try {
        // Fetch all properties where report property requests exist
        const propertiesWithReportRequests = await AddModel.find({ reportProperty: { $exists: true, $ne: [] } });

        // If no report property requests are found
        if (propertiesWithReportRequests.length === 0) {
            return res.status(404).json({ message: 'No report property requests found.' });
        }

        // Extracting report property request details for owners
        const reportPropertyRequestsData = propertiesWithReportRequests.map(property => ({
            ppcId: property.ppcId,
            postedUserPhoneNumber: property.phoneNumber, // Property owner's phone number
            reportRequestedUserPhoneNumbers: property.reportProperty.map(request => request.phoneNumber),
            propertyMode: property.propertyMode, // Rent/Sale
            propertyType: property.propertyType, // House/Apartment
            price: property.price, // Property price
            area: property.area,
            views: property.views || 0, // Default views to 0 if missing
            createdAt: property.createdAt,
            updatedAt: property.updatedAt,
            city:property.city,
            status: property.status  ,
            photos: property.photos || [],  
        }));

        // Extracting report property request details for buyers
        const propertiesData = propertiesWithReportRequests.map(property => ({
            ppcId: property.ppcId,
            postedUserPhoneNumber: property.phoneNumber, // Property owner's phone number
            propertyDetails: property.propertyDetails || 'No details available', // Fallback value
            reportRequesters: property.reportProperty.map(request => request.phoneNumber),
            views: property.views || 0,
            createdAt: property.createdAt,
            updatedAt: property.updatedAt,
            views: property.views || 0,
            propertyMode:property.propertyMode,
            propertyType:property.propertyType,
            area:property.area,
            city:property.city,
            price:property.price,
            status: property.status  ,
            photos: property.photos || [],  
        }));

        return res.status(200).json({
            message: 'Report property request data fetched successfully',
            reportPropertyRequestsData,
            propertiesData
        });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});


// Delete all reported property requests for a specific property (ppcId)
router.delete('/delete-report/:ppcId', async (req, res) => {
    try {
        const { ppcId } = req.params;

        // Update the property by removing all reportProperty entries
        const updatedProperty = await AddModel.findOneAndUpdate(
            { ppcId },
            { $set: { reportProperty: [] } }, // Clears all reported requests
            { new: true }
        );

        if (!updatedProperty) {
            return res.status(404).json({ message: 'Property not found or no report to delete.' });
        }

        return res.status(200).json({ message: 'All reported property requests removed successfully.' });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});




// **************Sold Out **********


router.post('/report-sold-out', async (req, res) => {
    const { phoneNumber, ppcId } = req.body;

    try {
        const property = await AddModel.findOne({ ppcId });

        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        // Check if the phone number has already reported the property as sold out
        const isAlreadyReported = property.soldOutReport.some(
            (request) => request.phoneNumber === phoneNumber
        );

        if (isAlreadyReported) {
            return res.status(400).json({
                message: "You have already marked this property as sold out.",
                status: "alreadyReported",
                reportedNumbers: property.soldOutReport.map(req => req.phoneNumber), // List of reported numbers
            });
        }

        // Update the property with the new sold-out report
        const updatedProperty = await AddModel.findOneAndUpdate(
            { ppcId },
            { 
                $push: { soldOutReport: { phoneNumber, createdAt: new Date() } },  
                $set: { status: 'soldOut', updatedAt: new Date() }
            },
            { new: true } // Return updated document
        );

        return res.status(200).json({
            message: 'The property has been marked as sold out.',
            status: 'soldOut',
            postedUserPhoneNumber: updatedProperty.phoneNumber,
            propertyMode: updatedProperty.propertyMode,
            propertyType: updatedProperty.propertyType,
            price: updatedProperty.price,
            area: updatedProperty.area,
            ownerName: updatedProperty.ownerName,
            views: updatedProperty.views, 
            city:updatedProperty.city,
            updatedAt:updatedProperty.updatedAt,
            createdAt:updatedProperty.createdAt,
            photos: updatedProperty.photos || [],  
            reportedNumbers: updatedProperty.soldOutReport.map(req => ({
                phoneNumber: req.phoneNumber,
                reportedAt: req.createdAt
            })) // Returning all reported phone numbers
        });

    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});



// ✅ Fetch Sold-Out Requests
router.get('/get-soldout-buyer', async (req, res) => {
    try {
        let { postedPhoneNumber } = req.query;

        if (!postedPhoneNumber) {
            return res.status(400).json({ message: 'Posted user phone number is required.' });
        }

        // Normalize phone number format for consistent querying
        postedPhoneNumber = postedPhoneNumber.replace(/\D/g, ''); // Remove non-numeric characters
        if (postedPhoneNumber.startsWith('91') && postedPhoneNumber.length === 12) {
            postedPhoneNumber = postedPhoneNumber.slice(2); // Convert '917878789090' → '7878789090'
        }

        // Fetch properties where the buyer has submitted a sold-out request
        const propertiesWithBuyerSoldOutRequests = await AddModel.find({
            $or: [
                { phoneNumber: postedPhoneNumber },
                { phoneNumber: `+91${postedPhoneNumber}` },
                { phoneNumber: `91${postedPhoneNumber}` }
            ]
        });

        if (propertiesWithBuyerSoldOutRequests.length === 0) {
            return res.status(404).json({ message: 'No properties found for this buyer sold-out request.' });
        }

        // Map properties to include sold-out requests
        const soldOutRequestsData = propertiesWithBuyerSoldOutRequests.map(property => ({
            ppcId: property.ppcId,
            area:property.area,
            createdAt:property.createdAt,
            updatedAt:property.updatedAt,
            price:property.price,
            city:property.city,
            totalArea:property.totalArea,
            areaUnit:property.areaUnit,
            price:property.price,
            ownerName:property.ownerName,
            bedrooms:property.bedrooms,
            ownerShip:property.ownership,
            status: property.status,
            photos: property.photos || [],
            postedUserPhoneNumber: property.phoneNumber, // Owner's phone number
            propertyDetails: property.propertyDetails || {},
            soldOutRequestersPhoneNumbers: (property.soldOutReport || []) // Ensure it's an array
                .filter(req => req.phoneNumber) // Remove empty/null entries
                .map(req => req.phoneNumber) // Get phone numbers
        }));

        return res.status(200).json({
            message: 'Properties with sold-out requests fetched successfully.',
            soldOutRequestsData
        });

    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});

// ✅ Delete Sold-Out Request
router.put("/soldout/delete/:ppcId/:phoneNumber", async (req, res) => {
    try {
        const { ppcId, phoneNumber } = req.params;

        const property = await AddModel.findOne({ ppcId });

        if (!property) {
            return res.status(404).json({ message: "Property not found." });
        }

        // Find the sold-out request related to the phoneNumber
        const soldOutIndex = property.soldOutReport.findIndex(req => req.phoneNumber === phoneNumber);

        if (soldOutIndex === -1) {
            return res.status(404).json({ message: "Sold-out request not found." });
        }

        // Remove the specific sold-out request
        property.soldOutReport.splice(soldOutIndex, 1);

        // If no sold-out requests remain, change status
        if (property.soldOutReport.length === 0) {
            property.status = "delete";
        }

        await property.save();

        res.status(200).json({ message: "Sold-out request removed successfully.", property });
    } catch (error) {
        res.status(500).json({ message: "Error deleting sold-out request.", error: error.message });
    }
});

// ✅ Undo Sold-Out Request Deletion
router.put("/soldout/undo/:ppcId/:phoneNumber", async (req, res) => {
    try {
        const { ppcId, phoneNumber } = req.params;

        const property = await AddModel.findOne({ ppcId });

        if (!property) {
            return res.status(404).json({ message: "Property not found." });
        }

        // Restore the sold-out request if it was deleted
        if (!property.soldOutReport.some(req => req.phoneNumber === phoneNumber)) {
            property.soldOutReport.push({ phoneNumber, date: new Date() });
        }

        // Restore previous status
        property.status = property.previousStatus || "active";

        await property.save();

        res.status(200).json({ message: "Sold-out request restored successfully!", property });
    } catch (error) {
        res.status(500).json({ message: "Error restoring sold-out request.", error: error.message });
    }
});



router.get('/get-soldout-owner', async (req, res) => {
    const { phoneNumber } = req.query;  // Extract phoneNumber from query parameters

    if (!phoneNumber) {
        return res.status(400).json({ message: 'Phone number is required.' });
    }

    try {

        // Use $elemMatch to find documents where soldOutReport contains an object with the specified phoneNumber
        const propertiesWithSoldOutRequests = await AddModel.find({
            // soldOutReport: { $elemMatch: { phoneNumber: phoneNumber } }
            'soldOutReport.phoneNumber': phoneNumber

        });


        if (propertiesWithSoldOutRequests.length === 0) {
            return res.status(404).json({
                message: 'No properties found with soldout requests for this phone number.',
                phoneNumber
            });
        }

        // Map over the results to structure the response
        const soldOutRequestsData = propertiesWithSoldOutRequests.map(property => ({
            ppcId: property.ppcId,
            postedUserPhoneNumber: property.phoneNumber,  // Property owner's phone number
            soldOutRequestedUserPhoneNumbers: Array.isArray(property.soldOutReport) ?
                property.soldOutReport.map(request => request.phoneNumber) : [],  
                views: property.views || 0,
                propertyMode:property.propertyMode,
                propertyType:property.propertyType,
                area:property.area,
                city:property.city,
                createdAt:property.createdAt,
                updatedAt:property.updatedAt,
                price:property.price,
            status: property.status  ,
            photos: property.photos || [],  
        }));

        return res.status(200).json({ message: 'Soldout requests fetched successfully', soldOutRequestsData });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});


router.get('/get-all-soldout-requests', async (req, res) => {
    try {
        // Fetch all properties where sold-out requests exist
        const propertiesWithSoldOutRequests = await AddModel.find({ soldOutReport: { $exists: true, $ne: [] } });

        // If no sold-out properties are found
        if (propertiesWithSoldOutRequests.length === 0) {
            return res.status(404).json({ message: 'No sold-out requests found.' });
        }

        // Extracting sold-out request details for owners
        const soldOutRequestsData = propertiesWithSoldOutRequests.map(property => ({
            ppcId: property.ppcId,
            postedUserPhoneNumber: property.phoneNumber, // Property owner's phone number
            soldOutRequestedUserPhoneNumbers: property.soldOutReport.map(request => request.phoneNumber),
            views: property.views || 0,
            propertyMode:property.propertyMode,
            propertyType:property.propertyType,
            area:property.area,
            city:property.city,
            createdAt:property.createdAt,
            updatedAt:property.updatedAt,
            price:property.price,
            status: property.status  ,
            photos: property.photos || [],  
        }));

        // Extracting sold-out request details for buyers
        const propertiesData = propertiesWithSoldOutRequests.map(property => ({
            ppcId: property.ppcId,
            postedUserPhoneNumber: property.phoneNumber, // Property owner's phone number
            propertyDetails: property.propertyDetails || 'No details available', // Fallback value
            soldOutRequesters: property.soldOutReport.map(request => request.phoneNumber),
            views: property.views || 0,
            propertyMode:property.propertyMode,
            propertyType:property.propertyType,
            area:property.area,
            city:property.city,
            createdAt:property.createdAt,
            updatedAt:property.updatedAt,
            price:property.price,
            status: property.status  ,
            photos: property.photos || [],  
        }));

        return res.status(200).json({
            message: 'Sold-out request data fetched successfully',
            soldOutRequestsData,
            propertiesData
        });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});


// Delete a sold-out request for a specific property (ppcId)
router.delete('/delete-soldout/:ppcId', async (req, res) => {
    try {
        const { ppcId } = req.params;  // Extract PPC ID from URL params

        // Update the property by pulling out the soldOutReport entry
        const updatedProperty = await AddModel.findOneAndUpdate(
            { ppcId },
            { $pull: { soldOutReport: { phoneNumber: { $exists: true } } } },
            { new: true }
        );

        if (!updatedProperty) {
            return res.status(404).json({ message: 'Property not found or no sold-out request to delete.' });
        }

        return res.status(200).json({ message: 'Sold-out request removed successfully.' });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});


router.post("/add-favorite", async (req, res) => {
    const { phoneNumber, ppcId } = req.body;

    if (!phoneNumber || !ppcId) {
        return res.status(400).json({ message: "Phone number and Property ID are required" });
    }

    try {
        const property = await AddModel.findOne({ ppcId });

        if (!property) {
            return res.status(404).json({ message: "Property not found" });
        }

        // Use schema method to add favorite request
        await property.addFavoriteRequest(phoneNumber);

        return res.status(200).json({
            message: "Property added to your favorites!",
            status: "favorite",
            postedUserPhoneNumber: property.phoneNumber,
            ownerName: property.ownerName,
            propertyMode: property.propertyMode,
            propertyType: property.propertyType,
            price: property.price,
            area: property.area,
            city: property.city,
            createdAt: property.createdAt,
            updatedAt: new Date(),
            photos: property.photos || [],
            views: property.views,
            favoriteRequests: property.favoriteRequests.map(fav => ({
                phoneNumber: fav.phoneNumber,
                favoritedAt: fav.date
            })),
        });
    } catch (error) {
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// Remove from Favorites
router.post("/remove-favorite", async (req, res) => {
    const { phoneNumber, ppcId } = req.body;

    if (!phoneNumber || !ppcId) {
        return res.status(400).json({ message: "Phone number and Property ID are required" });
    }

    try {
        const property = await AddModel.findOne({ ppcId });

        if (!property) {
            return res.status(404).json({ message: "Property not found" });
        }

        // Use schema method to remove favorite request
        await property.removeFavoriteRequest(phoneNumber);

        return res.status(200).json({
            message: "Property removed from your favorites!",
            status: "favoriteRemoved",
            postedUserPhoneNumber: property.phoneNumber,
            ownerName: property.ownerName,
            propertyMode: property.propertyMode,
            propertyType: property.propertyType,
            price: property.price,
            area: property.area,
            city: property.city,
            createdAt: property.createdAt,
            updatedAt: new Date(),
            favoriteRequests: property.favoriteRequests.map(fav => fav.phoneNumber),
            favoriteRemoved: property.favoriteRemoved.map(fav => ({
                phoneNumber: fav.phoneNumber,
                removedAt: fav.removedAt
            })),
        });
    } catch (error) {
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// Get Favorite Added & Removed Data
router.get("/favorite-history/:phoneNumber", async (req, res) => {
    const { phoneNumber } = req.params;

    if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number is required." });
    }

    try {
        // Find all properties where the user has added or removed favorites
        const properties = await AddModel.find({
            $or: [
                { "favoriteRequests.phoneNumber": phoneNumber },
                { "favoriteRemoved.phoneNumber": phoneNumber }
            ]
        });

        // Format response data
        const favoriteAdded = properties
            .filter(property => property.favoriteRequests.some(fav => fav.phoneNumber === phoneNumber))
            .map(property => ({
                ppcId: property.ppcId,
                ownerPhoneNumber: property.phoneNumber, // Property owner's phone number
                propertyType: property.propertyType,
                price: property.price,
                city: property.city,
                addedAt: property.favoriteRequests.find(fav => fav.phoneNumber === phoneNumber)?.date,
                addedByPhoneNumber: phoneNumber // The user who added this property to favorites
            }));

        const favoriteRemoved = properties
            .filter(property => property.favoriteRemoved.some(fav => fav.phoneNumber === phoneNumber))
            .map(property => ({
                ppcId: property.ppcId,
                ownerPhoneNumber: property.phoneNumber, // Property owner's phone number
                propertyType: property.propertyType,
                price: property.price,
                city: property.city,
                removedAt: property.favoriteRemoved.find(fav => fav.phoneNumber === phoneNumber)?.removedAt,
                removedByPhoneNumber: phoneNumber // The user who removed this property from favorites
            }));

        return res.status(200).json({ favoriteAdded, favoriteRemoved });
    } catch (error) {
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});




router.get("/favorite-removed-buyer/:phoneNumber", async (req, res) => {
    const { phoneNumber } = req.params;

    if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number is required." });
    }

    try {
        // Fetch all properties posted by this user
        const properties = await AddModel.find({ postedUserPhoneNumber: phoneNumber });

        // Format the response with all favoriteRemoved entries
        const favoriteRemoved = properties.flatMap(property => 
            property.favoriteRemoved.map(fav => ({
                ppcId: property.ppcId,
                ownerPhoneNumber: property.postedUserPhoneNumber,
                removedByPhoneNumber: fav.phoneNumber,
                propertyType: property.propertyType,
                price: property.price,
                area: property.area,
                city: property.city,
                removedAt: fav.removedAt
            }))
        );

        return res.status(200).json({ favoriteRemoved });
    } catch (error) {
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});











router.get("/remove-favorite-buyer", async (req, res) => {
    try {
        let { postedPhoneNumber } = req.query;

        if (!postedPhoneNumber) {
            return res.status(400).json({ message: "Posted user phone number is required." });
        }

        // Normalize phone number format for consistent querying
        postedPhoneNumber = postedPhoneNumber.replace(/\D/g, ""); // Remove non-numeric characters
        if (postedPhoneNumber.startsWith("91") && postedPhoneNumber.length === 12) {
            postedPhoneNumber = postedPhoneNumber.slice(2); // Convert '917878789090' → '7878789090'
        }

        // Fetch properties listed by the given owner
        const propertiesWithfavoriteRemoved = await AddModel.find({
            $or: [
                { phoneNumber: postedPhoneNumber },
                { phoneNumber: `+91${postedPhoneNumber}` },
                { phoneNumber: `91${postedPhoneNumber}` }
            ]
        });

        if (propertiesWithfavoriteRemoved.length === 0) {
            return res.status(404).json({ message: "No properties found for this owner." });
        }

        // Map properties to include details about the favorite requests and removed favorites
        const favoriteRemovedData = propertiesWithfavoriteRemoved.map(property => ({
            ppcId: property.ppcId,
            status: property.status,
            propertyMode: property.propertyMode,
            propertyType: property.propertyType,
            bedrooms:property.bedrooms,
            totalArea:property.totalArea,
            bestTimeToCall:property.bestTimeToCall,
            areaUnit:property.areaUnit,
            ownerShip:property.ownership,
            ownerName:property.ownerName,
            area: property.area,
            city: property.city,
            createdAt: property.createdAt,
            updatedAt: property.updatedAt,
            price: property.price,
            photos: property.photos || [],
            postedUserPhoneNumber: property.phoneNumber, // Property owner's phone number
            propertyDetails: property.propertyDetails || {}, // Property details
            // favoritedUsersPhoneNumbers: (property.favoriteRequests || []) // Ensure it's an array
            //     .filter(req => req.phoneNumber) // Remove empty/null entries
            //     .map(req => req.phoneNumber), // Get phone numbers
            removedFavoriteUserPhoneNumbers: (property.favoriteRemoved || []) // Ensure it's an array
                .map(fav => ({
                    phoneNumber: fav.phoneNumber,
                    removedAt: fav.removedAt
                })) // Get removed favorite users
        }));

        return res.status(200).json({
            message: "Properties with favorite requests fetched successfully.",
            favoriteRemovedData: favoriteRemovedData || [] // Ensure an array
        });
        

    } catch (error) {
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});




// Get properties that a specific user has favorited
router.get('/remove-favorite-owner', async (req, res) => {
    try {
        const phoneNumber = req.query.phoneNumber?.trim(); // Ensure phoneNumber is provided and trimmed

        if (!phoneNumber) {
            return res.status(400).json({ message: "Phone number is required." });
        }

        // Find properties where the user has favorited
        const propertiesWithFavorites = await AddModel.find({
            "favoriteRemoved": { $elemMatch: { phoneNumber } } // Ensure array contains phoneNumber
        });

        if (!propertiesWithFavorites.length) {
            return res.status(404).json({ message: "No favorite properties found for this phone number." });
        }

        // Format response
        const favoriteRemovedData = propertiesWithFavorites.map((property) => ({
            ppcId: property.ppcId,
            postedUserPhoneNumber: property.phoneNumber, // Property owner's phone number
            removedFavoriteUserPhoneNumbers: property.favoriteRemoved 
                ? property.favoriteRemoved.map((fav) => fav.phoneNumber) 
                : [],
            propertyMode: property.propertyMode,
            propertyType: property.propertyType,
            bedrooms:property.bedrooms,
            totalArea:property.totalArea,
            bestTimeToCall:property.bestTimeToCall,
            areaUnit:property.areaUnit,
            ownerShip:property.ownership,
            ownerName:property.ownerName,
            area: property.area,
            city: property.city,
            createdAt: property.createdAt,
            updatedAt: property.updatedAt,
            price: property.price,
            status: property.status,
            photos: property.photos || [],  
        }));

        return res.status(200).json({
            message: "Favorite properties fetched successfully",
            favoriteRemovedData,
        });

    } catch (error) {
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

router.put("/favoriteRemoved/delete/:ppcId/:favoriteUserPhone", async (req, res) => {
    try {
        const { ppcId, favoriteUserPhone } = req.params;

        const property = await AddModel.findOne({ ppcId });

        if (!property) {
            return res.status(404).json({ message: "Property not found." });
        }

        property.favoriteRemoved = property.favoriteRemoved.filter(
            (fav) => fav.phoneNumber !== favoriteUserPhone
        );

        await property.save();

        return res.status(200).json({
            message: "Favorite request removed successfully.",
        });
    } catch (error) {
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

router.put("/favoriteRemoved/undo/:ppcId/:favoriteUserPhone", async (req, res) => {
    try {
        const { ppcId, favoriteUserPhone } = req.params;

        const property = await AddModel.findOne({ ppcId });

        if (!property) {
            return res.status(404).json({ message: "Property not found." });
        }

        // Remove from removed list
        property.favoriteRemoved = property.favoriteRemoved.filter(
            (fav) => fav.phoneNumber !== favoriteUserPhone
        );

        await property.save();

        return res.status(200).json({
            message: "Favorite request restored successfully.",
        });
    } catch (error) {
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});




















// ---------------

// Get properties that a specific user has favorited
router.get('/get-favorite-owner', async (req, res) => {
    try {
        const { phoneNumber } = req.query; // Extract phoneNumber from query parameters

        if (!phoneNumber) {
            return res.status(400).json({ message: "Phone number is required." });
        }

        // Find properties where the user has favorited
        const propertiesWithFavorites = await AddModel.find({
            "favoriteRequests.phoneNumber": phoneNumber, // Corrected query
        });

        if (propertiesWithFavorites.length === 0) {
            return res.status(404).json({ message: "No favorite properties found for this phone number." });
        }

        // Format response
        const favoriteRequestsData = propertiesWithFavorites.map((property) => ({
            ppcId: property.ppcId,
            postedUserPhoneNumber: property.phoneNumber, // Property owner's phone number
            favoritedUserPhoneNumbers: property.favoriteRequests.map((fav) => fav.phoneNumber), // List of users who favorited
            propertyMode:property.propertyMode,
            propertyType:property.propertyType,
            area:property.area,
            city:property.city,
            createdAt:property.createdAt,
            updatedAt:property.updatedAt,
            price:property.price,
            status: property.status  ,
            photos: property.photos || [],  
        }));

        return res.status(200).json({
            message: "Favorite requests fetched successfully.",
            favoriteRequestsData: favoriteRequestsData || []  // Ensuring it’s never undefined
        });
        
    } catch (error) {
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});


router.get("/get-favorite-buyer", async (req, res) => {
    try {
        let { postedPhoneNumber } = req.query;

        if (!postedPhoneNumber) {
            return res.status(400).json({ message: "Posted user phone number is required." });
        }

        // Normalize phone number format for consistent querying
        postedPhoneNumber = postedPhoneNumber.replace(/\D/g, ""); // Remove non-numeric characters
        if (postedPhoneNumber.startsWith("91") && postedPhoneNumber.length === 12) {
            postedPhoneNumber = postedPhoneNumber.slice(2); // Convert '917878789090' → '7878789090'
        }

        // Fetch properties listed by the given owner
        const propertiesWithFavoriteRequests = await AddModel.find({
            $or: [
                { phoneNumber: postedPhoneNumber },
                { phoneNumber: `+91${postedPhoneNumber}` },
                { phoneNumber: `91${postedPhoneNumber}` }
            ]
        });

        if (propertiesWithFavoriteRequests.length === 0) {
            return res.status(404).json({ message: "No properties found for this owner." });
        }

        // Map properties to include details about the favorite requests
        const favoriteRequestsData = propertiesWithFavoriteRequests.map(property => ({
            ppcId: property.ppcId,
            status: property.status,
            propertyMode:property.propertyMode,
            propertyType:property.propertyType,
            area:property.area,
            city:property.city,
            createdAt:property.createdAt,
            updatedAt:property.updatedAt,
            price:property.price,
            photos: property.photos || [],
            postedUserPhoneNumber: property.phoneNumber, // Property owner's phone number
            propertyDetails: property.propertyDetails || {}, // Property details
            favoritedUsersPhoneNumbers: (property.favoriteRequests || []) // Ensure it's an array
                .filter(req => req.phoneNumber) // Remove empty/null entries
                .map(req => req.phoneNumber) // Get phone numbers

        }));

        return res.status(200).json({
            message: "Properties with favorite requests fetched successfully.",
            favoriteRequestsData
        });

    } catch (error) {
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});



// 📌 PUT: Delete a Favorite Buyer Request
router.put("/favorite/delete/:ppcId/:favoriteUser", async (req, res) => {
    try {
        const { ppcId, favoriteUser } = req.params;

        const property = await AddModel.findOne({ ppcId });
        if (!property) {
            return res.status(404).json({ message: "Property not found." });
        }

        // Remove the favorite request from the array
        property.favoriteRequests = property.favoriteRequests.filter(req => req.phoneNumber !== favoriteUser);

        await property.save();

        return res.status(200).json({ message: "Favorite request deleted successfully." });

    } catch (error) {
        return res.status(500).json({ message: "Error deleting favorite request.", error: error.message });
    }
});

// 📌 PUT: Undo a Deleted Favorite Buyer Request
router.put("/favorite/undo/:ppcId/:favoriteUser", async (req, res) => {
    try {
        const { ppcId, favoriteUser } = req.params;

        const property = await AddModel.findOne({ ppcId });
        if (!property) {
            return res.status(404).json({ message: "Property not found." });
        }

        // Ensure the favorite request isn't duplicated
        if (!property.favoriteRequests.some(req => req.phoneNumber === favoriteUser)) {
            property.favoriteRequests.push({ phoneNumber: favoriteUser });
        }

        await property.save();

        return res.status(200).json({
            message: "Favorite request restored successfully.",
            property
        });

    } catch (error) {
        return res.status(500).json({ message: "Error restoring favorite request.", error: error.message });
    }
});



router.get('/get-all-favorite-requests', async (req, res) => {
    try {
        // Fetch all properties where favorite requests exist
        const propertiesWithFavorites = await AddModel.find({ favoriteRequests: { $exists: true, $ne: [] } });

        // If no favorite properties are found
        if (propertiesWithFavorites.length === 0) {
            return res.status(404).json({ message: 'No favorite properties found.' });
        }

        // Extracting favorite request details for owners
        const favoriteRequestsData = propertiesWithFavorites.map(property => ({
            ppcId: property.ppcId,
            postedUserPhoneNumber: property.phoneNumber, // Property owner's phone number
            favoritedUserPhoneNumbers: property.favoriteRequests.map(fav => fav.phoneNumber),
            propertyMode: property.propertyMode, // Rent/Sale
            propertyType: property.propertyType, // House/Apartment
            price: property.price, // Property price
            area: property.area,
            // ownerName: property.ownerName || 'Unknown', // Fallback if owner name is missing
            views: property.views || 0, // Default views to 0 if missing
            createdAt: property.createdAt,
            updatedAt: property.updatedAt,
            status: property.status  ,
            photos: property.photos || [],  
        }));

        // Extracting favorite request details for buyers
        const propertiesData = propertiesWithFavorites.map(property => ({
            ppcId: property.ppcId,
            postedUserPhoneNumber: property.phoneNumber, // Property owner's phone number
            propertyDetails: property.propertyDetails || 'No details available', // Fallback value
            favoritedUsers: property.favoriteRequests.map(fav => fav.phoneNumber),
            views: property.views || 0,
            createdAt: property.createdAt,
            updatedAt: property.updatedAt,
            status: property.status  ,
            photos: property.photos || [],  
        }));

        return res.status(200).json({
            message: 'Favorite request data fetched successfully',
            favoriteRequestsData,
            propertiesData
        });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});


// Delete a favorite request for a specific property (ppcId)
router.delete('/delete-favorite/:ppcId', async (req, res) => {
    try {
        const { ppcId } = req.params;  // Extract PPC ID from URL params

        // Update the property by pulling out the favoriteRequests entry
        const updatedProperty = await AddModel.findOneAndUpdate(
            { ppcId },
            { $pull: { favoriteRequests: { phoneNumber: { $exists: true } } } },
            { new: true }
        );

        if (!updatedProperty) {
            return res.status(404).json({ message: 'Property not found or no favorite request to delete.' });
        }

        return res.status(200).json({ message: 'Favorite request removed successfully.' });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});





// **************** Delete And Undo Property Actions *****************


// Delete property endpoint
router.post('/delete-detail-property', async (req, res) => {
    const { ppcId, phoneNumber } = req.body;
  
    try {
      // Find the property by its ppcId and phoneNumber
      const property = await AddModel.findOne({ ppcId });
  
      if (!property) {
        return res.status(404).json({ message: 'Property not found.' });
      }
  
      // Check if the user's phone number is in the interestRequests array
      const userInterestIndex = property.interestRequests.findIndex(request => request.phoneNumber === phoneNumber);
      if (userInterestIndex !== -1) {
        // If the user is interested, remove their interest or handle as needed
        property.interestRequests.splice(userInterestIndex, 1);  // Remove the user's interest
      }
  
      // Change the property status to 'delete'
      property.status = 'delete';
      await property.save();
  
      // Send the updated property as a response
      res.status(200).json({ message: 'Property removed successfully.', property });
    } catch (error) {
      res.status(500).json({ message: 'Error removing property.' });
    }
  });
  



// Undo delete property endpoint
router.post('/undo-delete-detail', async (req, res) => {
    const { ppcId, phoneNumber } = req.body;
  
    try {
      // Find the property by its ppcId
      const property = await AddModel.findOne({ ppcId });
  
      if (!property) {
        return res.status(404).json({ message: 'Property not found.' });
      }
  
      // Revert the property status to 'incomplete' or whatever was the previous status
      property.status = 'incomplete'; // Or 'complete', based on the previous status
      // Optionally, add the user's interest request back (if you need to track that)
      if (!property.interestRequests.some(request => request.phoneNumber === phoneNumber)) {
        property.interestRequests.push({ phoneNumber, date: new Date() });
      }
  
      await property.save();
  
      // Send the updated property as a response
      res.status(200).json({ message: 'Property status reverted successfully!', property });
    } catch (error) {
      res.status(500).json({ message: 'Error undoing property status.' });
    }
  });
  
// // ********

router.put("/interest/delete/:ppcId/:phoneNumber", async (req, res) => {
    try {
      const { ppcId, phoneNumber } = req.params;
  
      const property = await AddModel.findOne({ ppcId });
  
      if (!property) {
        return res.status(404).json({ message: "Property not found." });
      }
  
      // Find the interest request related to the phoneNumber
      const interestIndex = property.interestRequests.findIndex(
        (req) => req.phoneNumber === phoneNumber
      );
  
      if (interestIndex === -1) {
        return res.status(404).json({ message: "Interest request not found." });
      }
  
      // Store previous status before deleting
      property.interestRequests.splice(interestIndex, 1); // Remove the specific request

      if (property.interestRequests.length === 0) {
        property.status = "delete";

      }
  
      await property.save();
  
      res.status(200).json({ message: "Interest request removed successfully.", property });
    } catch (error) {
      res.status(500).json({ message: "Error deleting interest request.", error: error.message });
    }
  });


  
  router.put("/interest/undo/:ppcId/:phoneNumber", async (req, res) => {
    try {
      const { ppcId, phoneNumber } = req.params;
  
      const property = await AddModel.findOne({ ppcId });
  
      if (!property) {
        return res.status(404).json({ message: "Property not found." });
      }
  
    //   if (!property.previousStatus) {
    //     return res.status(400).json({ message: "No previous status found to restore." });
    //   }
  
      // Restore the interest request if it was deleted
      if (!property.interestRequests.some((req) => req.phoneNumber === phoneNumber)) {
        property.interestRequests.push({ phoneNumber, date: new Date() });
      }
      // Restore previous status
      property.status = property.previousStatus;
  
      await property.save();
  
      res.status(200).json({ message: "Interest request restored successfully!", property });
    } catch (error) {
      res.status(500).json({ message: "Error restoring interest request.", error: error.message });
    }
  });

//   -------------help -------------



router.put("/help/delete/:ppcId/:phoneNumber", async (req, res) => {
    try {
        const { ppcId, phoneNumber } = req.params;

        const property = await AddModel.findOne({ ppcId });

        if (!property) {
            return res.status(404).json({ message: "Property not found." });
        }

        // Find the help request to delete
        const helpIndex = property.helpRequests.findIndex(req => req.phoneNumber === phoneNumber);

        if (helpIndex === -1) {
            return res.status(404).json({ message: "Help request not found." });
        }

        // Store previous status before deleting
        if (!property.previousStatus) {
            property.previousStatus = property.status;
        }

        // Remove the help request
        property.helpRequests.splice(helpIndex, 1);

        // If no help requests left, update status
        if (property.helpRequests.length === 0) {
            property.status = "delete";
        }

        await property.save();

        res.status(200).json({ message: "Help request removed successfully.", property });
    } catch (error) {
        res.status(500).json({ message: "Error deleting help request.", error: error.message });
    }
});


router.put("/help/undo/:ppcId/:phoneNumber", async (req, res) => {
    try {
        const { ppcId, phoneNumber } = req.params;

        const property = await AddModel.findOne({ ppcId });

        if (!property) {
            return res.status(404).json({ message: "Property not found." });
        }

        // Check if the request already exists
        if (!property.helpRequests.some(req => req.phoneNumber === phoneNumber)) {
            property.helpRequests.push({ phoneNumber, date: new Date() });
        }

        // Restore previous status if available
        if (property.previousStatus) {
            property.status = property.previousStatus;
            property.previousStatus = null;
        }

        await property.save();

        res.status(200).json({ message: "Help request restored successfully!", property });
    } catch (error) {
        res.status(500).json({ message: "Error restoring help request.", error: error.message });
    }
});


  
module.exports = router;
