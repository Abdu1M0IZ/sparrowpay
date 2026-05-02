// MongoDB connection helper. Uses Mongoose.

const mongoose = require('mongoose');
const env = require('./env');

mongoose.set('strictQuery', true);

async function connectDB(uri = env.mongoUri) {
  if (!uri) {
    throw new Error('MONGO_URI is not set. Cannot connect to MongoDB.');
  }
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  await mongoose.connect(uri, {
    // Sensible production defaults.
    serverSelectionTimeoutMS: 15_000,
    autoIndex: true,
  });

  // eslint-disable-next-line no-console
  console.log(`[db] connected to MongoDB (${mongoose.connection.name})`);
  return mongoose.connection;
}

async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

module.exports = { connectDB, disconnectDB, mongoose };
