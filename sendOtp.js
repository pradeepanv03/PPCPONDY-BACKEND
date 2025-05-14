
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");

const snsClient = new SNSClient({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}



const sendOtp = async (phoneNumber) => {
  const otp = generateOTP();

  // This message must EXACTLY match your approved DLT template
  const message = `Your OTP is : ${otp} Thanks for using PPC Pondy`;

  const params = {
    Message: message,
    PhoneNumber: `+91${phoneNumber}`,
    MessageAttributes: {
      'AWS.SNS.SMS.SMSType': {
        DataType: 'String',
        StringValue: 'Transactional'
      },
      'AWS.SNS.SMS.SenderID': {
        DataType: 'String',
        StringValue: process.env.SENDER_ID || 'PONDYY'
      },
      'AWS.SNS.SMS.EntityId': {
        DataType: 'String',
        StringValue: process.env.DLT_ENTITY_ID
      },
      'AWS.SNS.SMS.TemplateId': {
        DataType: 'String',
        StringValue: process.env.DLT_TEMPLATE_ID
      }
    }
  };

  try {
    const command = new PublishCommand(params);
    const result = await snsClient.send(command);
    return { success: true, otp, messageId: result.MessageId };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

module.exports = sendOtp;
