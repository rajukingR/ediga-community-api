import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import db from './config/db.js';
import authRoutes from './routes/auth_routs/authRoutes.js';
import communityRoutes from "./routes/communityRoutes.js";
import membersRoutes from "./routes/membersRoutes.js";
import professionalMasterRoutes from "./routes/professionalMasterRoutes.js";
import issueCategoryRoutes from "./routes/issueCategoryRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import issueRoutes from "./routes/issueRoutes.js";
import broadcastRoutes from './routes/broadcastRoutes.js';

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

// ✅ STANDARDIZED ROUTES - All without /api prefix
app.use('/auth', authRoutes);                     // /auth/signin, /auth/signup
app.use('/issues', issueRoutes);                  // /issues, /issues/create
app.use('/community-types', communityRoutes);     // /community-types
app.use('/members', membersRoutes);               // /members
app.use('/issue-categories', issueCategoryRoutes); // /issue-categories
app.use('/categories', categoryRoutes); // /issue-categories
app.use('/professional-masters', professionalMasterRoutes); // /professional-masters
app.use('/broadcasts', broadcastRoutes);


// ✅ Server Start
const PORT = process.env.PORT || 4040;

app.listen(PORT, () =>
  console.log(`🚀 Server running on ${process.env.NODE_ENV?.toUpperCase()} port ${PORT}`)
);

export default app;