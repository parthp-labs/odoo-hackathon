import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env files in override-precedence order:
//   1. backend/.env   — local, developer-specific overrides (gitignored)
//   2. repo-root .env — shared config (Atlas URI, agent keys, session secret)
// __dirname is backend/src/config, so '../..' is the backend/ dir.
// dotenv never clobbers a var that is already set, so loading the local file
// first means it wins, and the root file only fills in what is still missing.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const connectDB = async () => {
  try {
    // Accept either name: MONGO_URI (canonical, and what local .env overrides
    // use) or MONGODB_URI (the name the repo-root .env has always used).
    // Precedence: MONGO_URI first so a backend/.env override wins.
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error('MONGO_URI is not defined in environment variables (MONGODB_URI also accepted)');
    }

    if (mongoUri.includes('<db_password>')) {
      console.warn(
        '[Database Warning] MONGO_URI contains placeholder "<db_password>". Please replace it with your actual Atlas password in backend/.env'
      );
    }

    const conn = await mongoose.connect(mongoUri);
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[Database Error] ${error.message}`);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

export default connectDB;
