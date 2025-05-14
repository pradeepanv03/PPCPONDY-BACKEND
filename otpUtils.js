



const UserLogin = require('./user/UserModel'); // Import your UserLogin model

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Store OTP in database with all required fields
const storeOTP = async (phoneNumber, otp, loginMode, version, countryCode = '+91') => {
  try {
    // Remove all non-digit characters and ensure proper formatting
    const cleanedPhone = phoneNumber.replace(/\D/g, '');
    const formattedPhone = cleanedPhone.startsWith('91') && cleanedPhone.length === 12 
      ? `+${cleanedPhone}`
      : cleanedPhone.length === 10
      ? `+91${cleanedPhone}`
      : phoneNumber;

    await UserLogin.create({
      phone: formattedPhone.replace(/\D/g, '').slice(-10), // Store only last 10 digits
      otp,
      loginDate: new Date(),
      otpStatus: 'pending',
      countryCode,
      loginMode,
      version,
      status: 'active' // Default status
    });

  } catch (error) {
    throw error;
  }
};

// Verify OTP against database record
const verifyOTP = async (phoneNumber, otp) => {
  try {
    // Clean and format phone number
    const cleanedPhone = phoneNumber.replace(/\D/g, '');
    const phoneDigits = cleanedPhone.startsWith('91') && cleanedPhone.length === 12 
      ? cleanedPhone.slice(-10)
      : cleanedPhone.length === 10
      ? cleanedPhone
      : cleanedPhone.slice(-10);

    // Find the most recent OTP for this phone number
    const userLogin = await UserLogin.findOne({
      phone: phoneDigits,
      otpStatus: 'pending'
    }).sort({ loginDate: -1 });

    if (!userLogin) {
      return { isValid: false, message: 'No pending OTP found for this number' };
    }

    // Check if OTP matches and is not expired (5 minute expiry)
    const isOtpValid = userLogin.otp === otp;
    const isOtpExpired = new Date() - userLogin.loginDate > 5 * 60 * 1000;

    if (!isOtpValid) {
      return { isValid: false, message: 'Invalid OTP' };
    }

    if (isOtpExpired) {
      return { isValid: false, message: 'OTP expired' };
    }

    // Update the record to mark as verified
    userLogin.otpStatus = 'verified';
    await userLogin.save();

    return { 
      isValid: true, 
      message: 'OTP verified successfully',
      userLogin 
    };

  } catch (error) {
    return { isValid: false, message: 'Error verifying OTP' };
  }
};

module.exports = { generateOTP, storeOTP, verifyOTP };














