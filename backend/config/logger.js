// config/logger.js
const winston = require("winston");
const path    = require("path");

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

const transports = [
  new winston.transports.Console({
    format: combine(colorize(), timestamp({ format: "HH:mm:ss" }), logFormat),
  }),
];

// In production: write errors and all logs to files
if (process.env.NODE_ENV === "production") {
  transports.push(
    new winston.transports.File({
      filename: path.join("logs", "error.log"),
      level:    "error",
      maxsize:  5 * 1024 * 1024, // 5 MB
      maxFiles: 5,
      tailable: true,
    }),
    new winston.transports.File({
      filename: path.join("logs", "combined.log"),
      maxsize:  10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
      tailable: true,
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    logFormat
  ),
  transports,
});

module.exports = logger;
