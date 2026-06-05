import multer from "multer";
import path from "path";
import sharp from "sharp";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const uploadsPath = path.resolve(__dirname, "../uploads");

// Create uploads folder if not exists
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

// Multer Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsPath);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    // Keep .webp as it is
    if (ext === ".webp") {
      cb(null, Date.now() + ".webp");
    } else {
      // Save temporary original file first
      cb(null, Date.now() + ext);
    }
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 50, // 50MB
  },
});

// Middleware to convert images to webp
export const convertToWebp = async (req, res, next) => {
  try {
    if (!req.file) {
      return next();
    }

    const ext = path.extname(req.file.filename).toLowerCase();

    // Skip if already webp
    if (ext === ".webp") {
      return next();
    }

    // Allowed image formats
    const allowedImages = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff"];

    if (!allowedImages.includes(ext)) {
      return next();
    }

    const oldPath = req.file.path;

    const newFilename =
      path.parse(req.file.filename).name + ".webp";

    const newPath = path.join(uploadsPath, newFilename);

    // Convert image to webp
    await sharp(oldPath)
      .webp({ quality: 80 })
      .toFile(newPath);

    // Remove old image
    fs.unlinkSync(oldPath);

    // Update req.file
    req.file.filename = newFilename;
    req.file.path = newPath;
    req.file.mimetype = "image/webp";

    next();
  } catch (error) {
    console.error("WEBP Conversion Error:", error);
    next(error);
  }
};

export default upload;