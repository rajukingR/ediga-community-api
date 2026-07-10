import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export const sendOTP = async (mobile, otp) => {
  try {
    // Normalize mobile number
    const to = mobile.startsWith("+91") ? mobile : `+91${mobile}`;

    // Send SMS
    const message = await client.messages.create({
      body: `Your Ediga Community OTP is ${otp}. It is valid for 5 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });

    // Wait 5 seconds so Twilio can update the delivery status
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Fetch latest message status
    const result = await client.messages(message.sid).fetch();

    return {
      success:
        result.status === "delivered" ||
        result.status === "sent" ||
        result.status === "queued",

      sid: result.sid,
      status: result.status,

      to: result.to,
      from: result.from,

      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      price: result.price,
      priceUnit: result.priceUnit,
    };
  } catch (error) {
    console.error("Twilio Error:", error);

    return {
      success: false,
      sid: null,
      status: "failed",
      code: error.code,
      message: error.message,
      moreInfo: error.moreInfo,
    };
  }
};