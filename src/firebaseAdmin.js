
import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// recreate __dirname (important in ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// build absolute path to JSON
const serviceAccountPath = path.join(
  __dirname,
  "./config/firebaseServiceKey.json"
);

// read file
const serviceAccount = JSON.parse(
  fs.readFileSync(serviceAccountPath, "utf-8")
);

// initialize firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export default admin;