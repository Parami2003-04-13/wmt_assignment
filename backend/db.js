// Database Connection Setup
// Connects the Node.js backend to the MongoDB database using Mongoose.
const mongoose = require('mongoose');

let cached = global.__mongoCache;
if (!cached) {
  global.__mongoCache = cached = { promise: null };
}

/**
 * Reuses MongoDB connections across warm Vercel serverless invocations
 * instead of stacking new connects (which causes intermittent failures).
 */
async function connectDB() {
  // Logic: Retrieves the MongoDB connection string from environment variables.
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is not defined');
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(mongoUri, {
        
        bufferCommands: false,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        family: 4,
      })
      .then(() => {
        console.log('Connected to MongoDB');
        return mongoose.connection;
      })
      .catch((err) => {
        cached.promise = null;
        throw err;
      });
  }

  return cached.promise;
}

module.exports = { connectDB };
