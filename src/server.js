import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import axios from 'axios';
import https from 'https';
import db from './config/db.js';
import authRoutes from './routes/auth_routs/authRoutes.js';
import communityRoutes from "./routes/communityRoutes.js";
import professionalMasterRoutes from "./routes/professionalMasterRoutes.js";
import issueCategoryRoutes from "./routes/issueCategoryRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import issueRoutes from "./routes/issueRoutes.js";
import broadcastRoutes from './routes/broadcastRoutes.js';
import notificationRoutes from "./routes/notificationRoutes.js";
import announcementsRoutes from "./routes/announcementsRoutes.js";
import fcmRoutes from "./routes/fcmRoutes.js";
import firebaseOtpRoutes from "./routes/firebaseOtpRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import workRoutes from "./routes/workRoutes.js";

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Load ENV
dotenv.config({
  path:
    process.env.NODE_ENV === 'production'
      ? '.env.production'
      : process.env.NODE_ENV === 'development'
        ? '.env.development'
        : '.env',
});

const app = express();

// ✅ Middleware
app.use(express.json());

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? [
      "https://edigacommunity.innogenx.co.in",
      "https://www.edigacommunity.innogenx.co.in",
    ]
    : [
      "http://localhost:4040",
      "http://localhost:8080",
    ];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like Postman/mobile apps)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed: " + origin));
      }
    },
    credentials: true,
  })
);

// ✅ Logger (only dev)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ✅ DB Connection
db.authenticate()
  .then(() => console.log('💾 Database connected successfully'))
  .catch(err => console.log('❌ Database connection failed:', err));

// ✅ Static Files
app.use('/uploads', express.static(path.resolve(__dirname, 'uploads')));


// ================ PINCODE API PROXY ROUTE ================

app.get('/pincode/:pincode', async (req, res) => {
  const { pincode } = req.params;
    
  // Validate pincode format
  if (!/^[1-9][0-9]{5}$/.test(pincode)) {
    return res.status(400).json({ 
      Status: "Error", 
      Message: "Invalid pincode format. Please enter a valid 6-digit pincode." 
    });
  }
  
  try {
    // Create HTTPS agent that ignores SSL certificate errors (certificate has expired)
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
    });
    
    const apiUrl = `https://api.postalpincode.in/pincode/${pincode}`;
    
    const response = await axios.get(apiUrl, {
      httpsAgent: httpsAgent,
      timeout: 15000, // 15 seconds timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    });
        
    if (response.data && Array.isArray(response.data)) {
      const result = response.data[0];
      if (result.Status === "Success") {
        console.log(`✅ Successfully fetched data for pincode ${pincode}. Found ${result.PostOffice?.length || 0} locations.`);
      } else {
        console.log(`⚠️ API returned status: ${result.Status}, Message: ${result.Message}`);
      }
      res.status(200).json(response.data);
    } else {
      throw new Error('Invalid response format from postal API');
    }
  } catch (error) {
    console.error(`❌ Postal API error for pincode ${pincode}:`, error.message);
    
    // Return a proper error response
    res.status(500).json([{
      Status: "Error",
      Message: "Unable to fetch pincode details. The postal API service may be temporarily unavailable.",
      PostOffice: []
    }]);
  }
});

// OPTIONS handler for preflight requests
app.options('/pincode/:pincode', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.status(200).send();
});


app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/issues', issueRoutes);
app.use('/community-types', communityRoutes);
app.use('/issue-categories', issueCategoryRoutes);
app.use('/categories', categoryRoutes);
app.use('/professional-masters', professionalMasterRoutes);
app.use('/broadcasts', broadcastRoutes);
app.use("/notifications", notificationRoutes);
app.use("/announcements", announcementsRoutes);
app.use("/token", fcmRoutes);
app.use("/otp", firebaseOtpRoutes);
app.use("/work", workRoutes);

// ✅ Server Start
const PORT = process.env.PORT || 4040;

app.listen(PORT, () =>
  console.log(`🚀 Server running on ${process.env.NODE_ENV?.toUpperCase()} port ${PORT}`)
);

export default app;