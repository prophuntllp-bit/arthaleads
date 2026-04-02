require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const User = require("../models/User");
const Lead = require("../models/Lead");
const logger = require("../config/logger");

const USERS = [
  { name: "Rahul Kapoor", email: "admin@propcrm.in", password: "admin123", role: "admin" },
  { name: "Sneha Patil", email: "manager@propcrm.in", password: "manager123", role: "manager" },
  { name: "Ravi Kulkarni", email: "ravi@propcrm.in", password: "agent123", role: "agent" },
  { name: "Pooja Dubey", email: "pooja@propcrm.in", password: "agent123", role: "agent" },
];

const LEADS = [
  { name: "Priya Sharma", phone: "9876543210", email: "priya@gmail.com", source: "Facebook", status: "New", priority: "Hot", propertyType: "Apartment", bhk: "3BHK", purpose: "Buy", preferredLocation: "Baner, Pune", budget: { min: 8500000, max: 11000000 } },
  { name: "Anil Desai", phone: "9823456789", email: "anil@yahoo.com", source: "Google", status: "Site Visit", priority: "High", propertyType: "Villa", bhk: "4BHK", purpose: "Buy", preferredLocation: "Koregaon Park, Pune", budget: { min: 25000000, max: 30000000 } },
  { name: "Meena Joshi", phone: "9765432187", email: "meena@email.com", source: "Referral", status: "Negotiation", priority: "High", propertyType: "Apartment", bhk: "2BHK", purpose: "Buy", preferredLocation: "Wakad, Pune", budget: { min: 5500000, max: 7000000 } },
  { name: "Suresh Kumar", phone: "9654321876", email: "suresh@corp.com", source: "Manual", status: "Contacted", priority: "Medium", propertyType: "Plot", bhk: "N/A", purpose: "Invest", preferredLocation: "Hinjewadi, Pune", budget: { min: 4000000, max: 6000000 } },
  { name: "Kavita Rao", phone: "9543218765", email: "kavita@gmail.com", source: "Facebook", status: "Closed Won", priority: "Medium", propertyType: "Apartment", bhk: "2BHK", purpose: "Buy", preferredLocation: "Viman Nagar, Pune", budget: { min: 6500000, max: 8000000 } },
  { name: "Deepak Mehta", phone: "9432187654", email: "deepak@corp.com", source: "99acres", status: "Closed Lost", priority: "Low", propertyType: "Commercial", bhk: "N/A", purpose: "Buy", preferredLocation: "SB Road, Pune", budget: { min: 10000000, max: 15000000 } },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  logger.info("Connected to MongoDB");

  await Promise.all([User.deleteMany({}), Lead.deleteMany({})]);
  const users = await User.create(USERS);
  const admin = users.find((user) => user.role === "admin");
  const agents = users.filter((user) => user.role === "agent");

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const leads = LEADS.map((lead, index) => {
    const agent = agents[index % agents.length];
    return {
      ...lead,
      budget: { ...lead.budget, currency: "INR" },
      createdBy: admin._id,
      assignedTo: agent._id,
      assignedToName: agent.name,
      followUpDate: index % 2 === 0 ? today : tomorrow,
      notes: [
        {
          text: "Seed lead imported for demo dashboard data.",
          addedBy: admin._id,
          addedByName: admin.name,
        },
      ],
      activities: [
        {
          type: "created",
          description: `Lead created and assigned to ${agent.name}`,
          performedBy: admin._id,
          performedByName: admin.name,
          meta: {},
        },
      ],
    };
  });

  await Lead.create(leads);

  logger.info("Seed complete. Test users:");
  USERS.forEach((user) => logger.info(`${user.role}: ${user.email} / ${user.password}`));

  await mongoose.disconnect();
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error(`Seed failed: ${err.message}`);
    process.exit(1);
  });
