// validations/schemas.js
const Joi = require("joi");
// Every enumerated lead value comes from one place — see constants/leadOptions.js
// for why (the model/validator/client copies had drifted and broke saves).
const OPTS = require("../constants/leadOptions");

const avatarSchema = Joi.string()
  .pattern(/^(https?:\/\/|data:image\/(?:png|jpe?g|webp|gif);base64,)/i)
  .allow("")
  .optional();

// 8+ chars, 1 uppercase, 1 digit, 1 special character
const passwordSchema = Joi.string()
  .min(8)
  .pattern(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()\-_=+{};:,<.>?/\\|[\]~`])/)
  .messages({
    "string.pattern.base": "Password must have at least 1 uppercase letter, 1 number, and 1 special character",
    "string.min": "Password must be at least 8 characters",
  });

// ── Auth ──────────────────────────────────────────────────────────────────────
const signupSchema = Joi.object({
  orgName:      Joi.string().min(2).max(100).required(),
  name:         Joi.string().min(2).max(80).required(),
  email:        Joi.string().email().required(),
  password:     passwordSchema.required(),
  phone:        Joi.string().min(10).max(15).required(),
  referralCode: Joi.string().length(6).uppercase().alphanum().optional().allow("", null),
  // Proof the email was verified via OTP. MUST be declared here — validate()
  // runs with stripUnknown:true, so an undeclared field is silently dropped
  // before the controller ever sees it (which is exactly how the original
  // verification step ended up being a no-op).
  signupToken:  Joi.string().required(),
  // Frontend sends this for the (currently disabled) reCAPTCHA check; declared
  // so it isn't rejected outright, ignored by the controller.
  recaptchaToken: Joi.string().optional().allow("", null),
});

const loginSchema = Joi.object({
  // Accept either an email address or a phone number (10-digit or +91 format)
  email: Joi.alternatives().try(
    Joi.string().email(),
    Joi.string().pattern(/^\+?[0-9]{7,15}$/)
  ).required().label("Email or Phone"),
  password: Joi.string().required(),
});

const createUserSchema = Joi.object({
  name: Joi.string().min(2).max(80).required(),
  email: Joi.string().email().required(),
  password: passwordSchema.required(),
  role: Joi.string().valid("admin", "manager", "agent").required(),
  phone: Joi.string().allow("").optional(),
  avatar: avatarSchema,
});

const updateUserSchema = Joi.object({
  name: Joi.string().min(2).max(80),
  email: Joi.string().email(),
  password: passwordSchema,
  role: Joi.string().valid("admin", "manager", "agent"),
  phone: Joi.string().allow(""),
  avatar: avatarSchema,
  isActive: Joi.boolean(),
}).min(1);

const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(80),
  phone: Joi.string().allow(""),
  avatar: avatarSchema,
  role: Joi.string().valid("admin", "manager", "agent"),
  currentPassword: Joi.string().allow(""),
  newPassword: passwordSchema.allow(""),
}).min(1);

const createAutomationSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  platform: Joi.string().valid("Facebook", "Google", "WhatsApp", "Website Form", "Custom", "Vistrow Voice").required(),
  mode: Joi.string().valid("webhook", "api", "form", "spreadsheet", "oauth").optional(),
  status: Joi.string().valid("draft", "connected", "paused").optional(),
  description: Joi.string().allow("").max(500).optional(),
  leadSourceLabel: Joi.string().allow("").max(100).optional(),
  externalSourceId: Joi.string().allow("").max(120).optional(),
  pageId: Joi.string().allow("").max(120).optional(),
  formId: Joi.string().allow("").max(120).optional(),
  externalSourceUrl: Joi.string().uri().allow("").optional(),
  webhookPath: Joi.string().allow("").max(200).optional(),
  verifyToken: Joi.string().allow("").max(150).optional(),
  accessToken: Joi.string().allow("").max(500).optional(),
  userToken: Joi.string().allow("").max(500).optional(),
  mappingNotes: Joi.string().allow("").max(1000).optional(),
  lastSyncAt: Joi.date().allow(null).optional(),
  isActive: Joi.boolean().optional(),
});

const updateAutomationSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  platform: Joi.string().valid("Facebook", "Google", "WhatsApp", "Website Form", "Custom", "Vistrow Voice"),
  mode: Joi.string().valid("webhook", "api", "form", "spreadsheet", "oauth"),
  status: Joi.string().valid("draft", "connected", "paused"),
  description: Joi.string().allow("").max(500),
  leadSourceLabel: Joi.string().allow("").max(100),
  externalSourceId: Joi.string().allow("").max(120),
  pageId: Joi.string().allow("").max(120),
  formId: Joi.string().allow("").max(120),
  externalSourceUrl: Joi.string().uri().allow(""),
  webhookPath: Joi.string().allow("").max(200),
  verifyToken: Joi.string().allow("").max(150),
  accessToken: Joi.string().allow("").max(500),
  userToken: Joi.string().allow("").max(500),
  mappingNotes: Joi.string().allow("").max(1000),
  lastSyncAt: Joi.date().allow(null),
  isActive: Joi.boolean(),
}).min(1);

// ── Lead ──────────────────────────────────────────────────────────────────────
const createLeadSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  phone: Joi.string().min(7).max(20).required(),
  email: Joi.string().email().allow("").optional(),
  streetAddress: Joi.string().allow("").optional(),
  city: Joi.string().allow("").optional(),
  propertyType: Joi.string()
    .valid(...OPTS.PROPERTY_TYPE)
    .default("Apartment"),
  budget: Joi.object({
    min: Joi.number().min(0).default(0),
    max: Joi.number().min(0).default(0),
    currency: Joi.string().default("INR"),
  }).default({}),
  preferredLocation: Joi.string().allow("").optional(),
  bhk: Joi.string().valid(...OPTS.BHK).default("N/A"),
  purpose: Joi.string().valid(...OPTS.PURPOSE).default("Buy"),
  status: Joi.string()
    .valid(...OPTS.STATUS)
    .default("New"),
  priority: Joi.string().valid(...OPTS.PRIORITY).default("Medium"),
  source: Joi.string()
    .valid(...OPTS.SOURCE)
    .default("Manual"),
  assignedTo: Joi.string().hex().length(24).allow(null, "").optional(),
  followUpDate: Joi.date().allow(null).optional(),
  followUpNote: Joi.string().allow("").optional(),
  formResponses: Joi.array().items(
    Joi.object({
      fieldKey: Joi.string().required(),
      label: Joi.string().required(),
      value: Joi.string().allow(""),
    })
  ).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
});

const updateLeadSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  phone: Joi.string().min(7).max(20),
  email: Joi.string().email().allow(""),
  streetAddress: Joi.string().allow(""),
  city: Joi.string().allow(""),
  propertyType: Joi.string().valid(...OPTS.PROPERTY_TYPE),
  budget: Joi.object({
    min: Joi.number().min(0),
    max: Joi.number().min(0),
    currency: Joi.string(),
  }),
  preferredLocation: Joi.string().allow(""),
  bhk: Joi.string().valid(...OPTS.BHK),
  purpose: Joi.string().valid(...OPTS.PURPOSE),
  status: Joi.string().valid(...OPTS.STATUS),
  priority: Joi.string().valid(...OPTS.PRIORITY),
  source: Joi.string().valid(...OPTS.SOURCE),
  assignedTo: Joi.string().hex().length(24).allow(null, ""),
  followUpDate: Joi.date().allow(null),
  followUpNote: Joi.string().allow(""),
  formResponses: Joi.array().items(
    Joi.object({
      fieldKey: Joi.string().required(),
      label: Joi.string().required(),
      value: Joi.string().allow(""),
    })
  ),
  followUp2: Joi.date().allow(null, ""),
  siteVisitDate: Joi.date().allow(null),
  siteVisitDone: Joi.boolean(),
  remark1: Joi.string().allow("").max(500),
  remark2: Joi.string().allow("").max(500),
  remark: Joi.string().allow("").max(1000),
  booking: Joi.string().valid(...OPTS.BOOKING).allow(""),
  tags: Joi.array().items(Joi.string()),
  isArchived: Joi.boolean(),
}).min(1); // At least one field required for update

const addNoteSchema = Joi.object({
  text: Joi.string().min(1).max(2000).required(),
});

const assignLeadSchema = Joi.object({
  agentId: Joi.string().hex().length(24).required(),
});

const importLeadsSchema = Joi.object({
  leads: Joi.array().items(
    Joi.object({
      name: Joi.string().min(2).max(100).required(),
      phone: Joi.string().min(7).max(20).required(),
      email: Joi.string().email().allow("").optional(),
      streetAddress: Joi.string().allow("").optional(),
      city: Joi.string().allow("").optional(),
      propertyType: Joi.string().valid(...OPTS.PROPERTY_TYPE).default("Apartment"),
      budget: Joi.object({
        min: Joi.number().min(0).default(0),
        max: Joi.number().min(0).default(0),
        currency: Joi.string().default("INR"),
      }).default({}),
      preferredLocation: Joi.string().allow("").optional(),
      bhk: Joi.string().valid(...OPTS.BHK).default("N/A"),
      purpose: Joi.string().valid(...OPTS.PURPOSE).default("Buy"),
      status: Joi.string().valid(...OPTS.STATUS).default("New"),
      priority: Joi.string().valid(...OPTS.PRIORITY).default("Medium"),
      source: Joi.string().valid(...OPTS.SOURCE).default("Manual"),
      assignedTo: Joi.string().hex().length(24).allow(null, "").optional(),
      followUpDate: Joi.date().allow(null).optional(),
      followUpNote: Joi.string().allow("").optional(),
      formResponses: Joi.array().items(
        Joi.object({
          fieldKey: Joi.string().required(),
          label: Joi.string().required(),
          value: Joi.string().allow(""),
        })
      ).optional(),
      tags: Joi.array().items(Joi.string()).optional(),
      booking: Joi.string().valid(...OPTS.BOOKING).allow("").optional(),
      remark: Joi.string().allow("").optional(),
      remark1: Joi.string().allow("").optional(),
      remark2: Joi.string().allow("").optional(),
    })
  ).min(1).required(),
});

module.exports = {
  signupSchema,
  loginSchema,
  createUserSchema,
  updateUserSchema,
  updateProfileSchema,
  createAutomationSchema,
  updateAutomationSchema,
  createLeadSchema,
  updateLeadSchema,
  addNoteSchema,
  assignLeadSchema,
  importLeadsSchema,
};
