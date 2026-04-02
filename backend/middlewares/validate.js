const { AppError } = require("./errorHandler");

function validate(schema, property = "body") {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return next(new AppError(error.details.map((item) => item.message).join(", "), 400));
    }

    req[property] = value;
    next();
  };
}

module.exports = validate;
