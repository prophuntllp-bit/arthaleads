// validations/schemas.js
const Joi = require("joi");
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
  platform: Joi.string().valid("Facebook", "Google", "WhatsApp", "Website Form", "Custom").required(),
  mode: Joi.string().valid("webhook", "api", "form", "spreadsheet").optional(),
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
  platform: Joi.string().valid("Facebook", "Google", "WhatsApp", "Website Form", "Custom"),
  mode: Joi.string().valid("webhook", "api", "form", "spreadsheet"),
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
    .valid("Apartment","Villa","Plot","Commercial","Office","Penthouse","Other")
    .default("Apartment"),
  budget: Joi.object({
    min: Joi.number().min(0).default(0),
    max: Joi.number().min(0).default(0),
    currency: Joi.string().default("INR"),
  }).default({}),
  preferredLocation: Joi.string().allow("").optional(),
  bhk: Joi.string().valid("1BHK","2BHK","3BHK","4BHK","5BHK+","Studio","N/A").default("N/A"),
  purpose: Joi.string().valid("Buy","Rent","Invest","N/A").default("Buy"),
  status: Joi.string()
    .valid("New","Contacted","Site Visit","Negotiation","Closed Won","Closed Lost")
    .default("New"),
  priority: Joi.string().valid("Low","Medium","High","Hot").default("Medium"),
  source: Joi.string()
    .valid("Facebook","Google","WhatsApp","Manual","Website","Referral","Walk-in","PropTiger","99acres","MagicBricks","Other")
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
  propertyType: Joi.string().valid("Apartment","Villa","Plot","Commercial","Office","Penthouse","Other"),
  budget: Joi.object({
    min: Joi.number().min(0),
    max: Joi.number().min(0),
    currency: Joi.string(),
  }),
  preferredLocation: Joi.string().allow(""),
  bhk: Joi.string().valid("1BHK","2BHK","3BHK","4BHK","5BHK+","Studio","N/A"),
  purpose: Joi.string().valid("Buy","Rent","Invest","N/A"),
  status: Joi.string().valid("New","Contacted","Site Visit","Negotiation","Closed Won","Closed Lost"),
  priority: Joi.string().valid("Low","Medium","High","Hot"),
  source: Joi.string().valid("Facebook","Google","WhatsApp","Manual","Website","Referral","Walk-in","PropTiger","99acres","MagicBricks","Other"),
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
  booking: Joi.string().valid("", "Interested", "Site Visit Booked", "Site Visit Done", "Booked", "Not Interested", "Call Back", "Not Reachable", "Low Budget").allow(""),
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
      propertyType: Joi.string().valid("Apartment","Villa","Plot","Commercial","Office","Penthouse","Other").default("Apartment"),
      budget: Joi.object({
        min: Joi.number().min(0).default(0),
        max: Joi.number().min(0).default(0),
        currency: Joi.string().default("INR"),
      }).default({}),
      preferredLocation: Joi.string().allow("").optional(),
      bhk: Joi.string().valid("1BHK","2BHK","3BHK","4BHK","5BHK+","Studio","N/A").default("N/A"),
      purpose: Joi.string().valid("Buy","Rent","Invest","N/A").default("Buy"),
      status: Joi.string().valid("New","Contacted","Site Visit","Negotiation","Closed Won","Closed Lost").default("New"),
      priority: Joi.string().valid("Low","Medium","High","Hot").default("Medium"),
      source: Joi.string().valid("Facebook","Google","WhatsApp","Manual","Website","Referral","Walk-in","PropTiger","99acres","MagicBricks","Other").default("Manual"),
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
      booking: Joi.string().valid("", "Interested", "Site Visit Booked", "Site Visit Done", "Booked", "Not Interested", "Call Back", "Not Reachable", "Low Budget").allow("").optional(),
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
