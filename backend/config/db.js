const mongoose = require("mongoose");
const logger = require("./logger");

let isConnected = false;

async function connectDB() {
  if (isConnected) return mongoose.connection;

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing. Add it to backend/.env");
  }

  mongoose.set("strictQuery", true);

  const conn = await mongoose.connect(process.env.MONGO_URI);
  isConnected = true;
  logger.info(`MongoDB connected: ${conn.connection.host}`);

  mongoose.connection.on("error", (err) => {
    logger.error(`MongoDB error: ${err.message}`);
  });

  return conn.connection;
}

module.exports = connectDB;
