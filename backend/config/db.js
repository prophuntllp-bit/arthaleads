const mongoose = require("mongoose");
const logger = require("./logger");

async function connectDB() {
  // Use live connection state instead of a stale module-level flag.
  // readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (mongoose.connection.readyState === 2) {
    await new Promise((res) => mongoose.connection.once("connected", res));
    return mongoose.connection;
  }

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing. Add it to backend/.env");
  }

  mongoose.set("strictQuery", true);

  const conn = await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,  // fail fast if Atlas is unreachable
    socketTimeoutMS:          45000,  // abort stalled queries after 45s
    maxPoolSize:              10,
    retryWrites:              true,
  });

  logger.info(`MongoDB connected: ${conn.connection.host}`);

  mongoose.connection.on("error",        (err) => logger.error(`MongoDB error: ${err.message}`));
  mongoose.connection.on("disconnected", ()    => logger.warn("MongoDB disconnected — mongoose will auto-reconnect"));
  mongoose.connection.on("reconnected",  ()    => logger.info("MongoDB reconnected"));

  return conn.connection;
}

module.exports = connectDB;
