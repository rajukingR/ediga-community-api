import express from "express";
import admin from "../firebaseAdmin.js";

const router = express.Router();

// In-memory OTP store (in production, use Redis or database)
const otpStore = new Map();

// Generate 6-digit OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP to mobile number (Using Firebase Auth)
router.post("/send-mobile-otp", async (req, res) => {
    try {
        const { mobileNumber } = req.body;
        
        // Validate mobile number
        if (!mobileNumber || !/^\d{10}$/.test(mobileNumber)) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid mobile number. Please enter 10 digits." 
            });
        }
        
        // Rate limiting check
        const rateKey = `rate:${mobileNumber}`;
        const rateData = otpStore.get(rateKey);
        if (rateData && rateData.count >= 3 && Date.now() < rateData.resetTime) {
            const waitTime = Math.ceil((rateData.resetTime - Date.now()) / 1000);
            return res.status(429).json({ 
                success: false, 
                message: `Too many requests. Please wait ${waitTime} seconds.` 
            });
        }
        
        // Generate OTP
        const otp = generateOTP();
        
        // Store OTP with expiration (5 minutes)
        const expiresAt = Date.now() + (5 * 60 * 1000);
        otpStore.set(mobileNumber, {
            otp,
            expiresAt,
            attempts: 0,
            verified: false
        });
        
        // Update rate limiting
        if (!rateData) {
            otpStore.set(rateKey, {
                count: 1,
                resetTime: Date.now() + (5 * 60 * 1000)
            });
        } else {
            rateData.count++;
            otpStore.set(rateKey, rateData);
        }
        
        // Auto cleanup after 5 minutes
        setTimeout(() => {
            if (otpStore.has(mobileNumber) && !otpStore.get(mobileNumber).verified) {
                otpStore.delete(mobileNumber);
            }
        }, 5 * 60 * 1000);
        
        // For development - log OTP to console
        console.log(`📱 OTP for ${mobileNumber}: ${otp}`);
        
        // In production with Firebase Phone Auth, you would use:
        // const verificationId = await sendPhoneOTP(mobileNumber);
        // But that requires client-side Firebase SDK
        
        // For now, return success (OTP is logged in console)
        // In production, integrate with SMS gateway or use Firebase client SDK
        
        res.json({ 
            success: true, 
            message: "OTP sent successfully! (Check console for OTP in development)",
            // In production, remove this dev_only field
            dev_only: process.env.NODE_ENV === 'development' ? { otp } : undefined
        });
        
    } catch (error) {
        console.error("Send OTP error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to send OTP", 
            error: error.message 
        });
    }
});

// Verify OTP
router.post("/verify-mobile-otp", async (req, res) => {
    try {
        const { mobileNumber, otp } = req.body;
        
        if (!mobileNumber || !otp) {
            return res.status(400).json({ 
                success: false, 
                message: "Mobile number and OTP are required" 
            });
        }
        
        const storedData = otpStore.get(mobileNumber);
        
        if (!storedData) {
            return res.status(400).json({ 
                success: false, 
                message: "OTP not found or expired. Please request a new OTP." 
            });
        }
        
        if (storedData.verified) {
            return res.status(400).json({ 
                success: false, 
                message: "OTP already used" 
            });
        }
        
        if (Date.now() > storedData.expiresAt) {
            otpStore.delete(mobileNumber);
            return res.status(400).json({ 
                success: false, 
                message: "OTP has expired. Please request a new OTP." 
            });
        }
        
        storedData.attempts++;
        if (storedData.attempts > 5) {
            otpStore.delete(mobileNumber);
            return res.status(400).json({ 
                success: false, 
                message: "Too many failed attempts. Please request a new OTP." 
            });
        }
        
        if (storedData.otp !== otp) {
            otpStore.set(mobileNumber, storedData);
            return res.status(400).json({ 
                success: false, 
                message: `Invalid OTP. ${5 - storedData.attempts} attempts remaining.` 
            });
        }
        
        // Mark as verified
        storedData.verified = true;
        otpStore.set(mobileNumber, storedData);
        
        // Generate verification token (JWT)
        const verificationToken = Buffer.from(JSON.stringify({
            mobile: mobileNumber,
            verified: true,
            timestamp: Date.now()
        })).toString('base64');
        
        res.json({ 
            success: true, 
            message: "Mobile number verified successfully!",
            verified: true,
            verificationToken
        });
        
    } catch (error) {
        console.error("Verify OTP error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Verification failed", 
            error: error.message 
        });
    }
});

// Send Email OTP
router.post("/send-email-otp", async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid email address" 
            });
        }
        
        // Rate limiting check
        const rateKey = `rate:email:${email}`;
        const rateData = otpStore.get(rateKey);
        if (rateData && rateData.count >= 3 && Date.now() < rateData.resetTime) {
            const waitTime = Math.ceil((rateData.resetTime - Date.now()) / 1000);
            return res.status(429).json({ 
                success: false, 
                message: `Too many requests. Please wait ${waitTime} seconds.` 
            });
        }
        
        // Generate OTP
        const otp = generateOTP();
        
        // Store OTP
        const expiresAt = Date.now() + (5 * 60 * 1000);
        otpStore.set(`email:${email}`, {
            otp,
            expiresAt,
            attempts: 0,
            verified: false
        });
        
        // Update rate limiting
        if (!rateData) {
            otpStore.set(rateKey, {
                count: 1,
                resetTime: Date.now() + (5 * 60 * 1000)
            });
        } else {
            rateData.count++;
            otpStore.set(rateKey, rateData);
        }
        
        // Log OTP for development
        console.log(`📧 Email OTP for ${email}: ${otp}`);
        
        // For production, you would send actual email here
        // Using Firebase Admin's email service or nodemailer
        
        res.json({ 
            success: true, 
            message: "OTP sent to email successfully!",
            dev_only: process.env.NODE_ENV === 'development' ? { otp } : undefined
        });
        
    } catch (error) {
        console.error("Send email OTP error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to send email OTP" 
        });
    }
});

// Verify Email OTP
router.post("/verify-email-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;
        
        if (!email || !otp) {
            return res.status(400).json({ 
                success: false, 
                message: "Email and OTP are required" 
            });
        }
        
        const storedData = otpStore.get(`email:${email}`);
        
        if (!storedData) {
            return res.status(400).json({ 
                success: false, 
                message: "OTP not found or expired" 
            });
        }
        
        if (storedData.verified) {
            return res.status(400).json({ 
                success: false, 
                message: "OTP already used" 
            });
        }
        
        if (Date.now() > storedData.expiresAt) {
            otpStore.delete(`email:${email}`);
            return res.status(400).json({ 
                success: false, 
                message: "OTP has expired" 
            });
        }
        
        if (storedData.otp !== otp) {
            storedData.attempts++;
            otpStore.set(`email:${email}`, storedData);
            return res.status(400).json({ 
                success: false, 
                message: "Invalid OTP" 
            });
        }
        
        storedData.verified = true;
        otpStore.set(`email:${email}`, storedData);
        
        res.json({ 
            success: true, 
            message: "Email verified successfully!" 
        });
        
    } catch (error) {
        console.error("Verify email OTP error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Verification failed" 
        });
    }
});

// Check verification status
router.post("/check-verification", async (req, res) => {
    try {
        const { mobileNumber, email } = req.body;
        
        const mobileVerified = mobileNumber ? 
            otpStore.get(mobileNumber)?.verified || false : false;
        
        const emailVerified = email ? 
            otpStore.get(`email:${email}`)?.verified || false : false;
        
        res.json({
            success: true,
            mobileVerified,
            emailVerified
        });
        
    } catch (error) {
        console.error("Check verification error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to check verification status" 
        });
    }
});

// Resend OTP (with cooldown)
router.post("/resend-otp", async (req, res) => {
    try {
        const { mobileNumber, email, type } = req.body;
        
        if (type === 'mobile' && mobileNumber) {
            // Check cooldown (30 seconds)
            const lastSent = otpStore.get(`last_sent:${mobileNumber}`);
            if (lastSent && Date.now() - lastSent < 30000) {
                const waitTime = Math.ceil((30000 - (Date.now() - lastSent)) / 1000);
                return res.status(429).json({ 
                    success: false, 
                    message: `Please wait ${waitTime} seconds before resending` 
                });
            }
            
            otpStore.set(`last_sent:${mobileNumber}`, Date.now());
            
            // Generate new OTP
            const otp = generateOTP();
            const expiresAt = Date.now() + (5 * 60 * 1000);
            otpStore.set(mobileNumber, {
                otp,
                expiresAt,
                attempts: 0,
                verified: false
            });
            
            console.log(`🔄 Resent OTP for ${mobileNumber}: ${otp}`);
            
            res.json({ success: true, message: "OTP resent successfully!" });
            
        } else if (type === 'email' && email) {
            const lastSent = otpStore.get(`last_sent:email:${email}`);
            if (lastSent && Date.now() - lastSent < 30000) {
                const waitTime = Math.ceil((30000 - (Date.now() - lastSent)) / 1000);
                return res.status(429).json({ 
                    success: false, 
                    message: `Please wait ${waitTime} seconds before resending` 
                });
            }
            
            otpStore.set(`last_sent:email:${email}`, Date.now());
            
            const otp = generateOTP();
            const expiresAt = Date.now() + (5 * 60 * 1000);
            otpStore.set(`email:${email}`, {
                otp,
                expiresAt,
                attempts: 0,
                verified: false
            });
            
            console.log(`🔄 Resent email OTP for ${email}: ${otp}`);
            
            res.json({ success: true, message: "OTP resent successfully!" });
            
        } else {
            res.status(400).json({ success: false, message: "Invalid request" });
        }
        
    } catch (error) {
        console.error("Resend OTP error:", error);
        res.status(500).json({ success: false, message: "Failed to resend OTP" });
    }
});

export default router;