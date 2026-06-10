// Fetches live CRM data to give the AI assistant real context about the user's workspace.
const Lead       = require("../models/Lead");
const Attendance = require("../models/Attendance");
let User, Project, Booking, Invoice;
try { User    = require("../models/User");    } catch { User    = null; }
try { Project = require("../models/Project"); } catch { Project = null; }
try { Booking = require("../models/Booking"); } catch { Booking = null; }
try { Invoice = require("../models/Invoice"); } catch { Invoice = null; }

function pad(n) { return String(n).padStart(2, "0"); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function fetchPageContext(page, userId, orgId, leadId) {
  const parts = [];
  const today = todayStr();
  const now = new Date();

  parts.push(`Today's date: ${today}`);

  // ── If user is viewing a specific lead, include full details ──────────────
  if (leadId) {
    try {
      const lead = await Lead.findOne({ _id: leadId, orgId, isDeleted: { $ne: true } })
        .populate("assignedTo", "name")
        .lean();
      if (lead) {
        parts.push(`CURRENTLY OPEN LEAD (user is viewing this lead right now):
- Lead ID: ${lead._id}
- Name: ${lead.name}
- Phone: ${lead.phone || "not set"}
- Email: ${lead.email || "not set"}
- Status: ${lead.status}
- Priority: ${lead.priority || "Medium"}
- Source: ${lead.source || "Manual"}
- Budget: ${lead.budget?.max ? `₹${lead.budget.max.toLocaleString("en-IN")}` : "not set"}
- Location preference: ${lead.preferredLocation || "not set"}
- Purpose: ${lead.purpose || "Buy"}
- Follow-up date: ${lead.followUpDate ? new Date(lead.followUpDate).toLocaleDateString("en-IN") : "not set"}
- Assigned to: ${lead.assignedTo?.name || "unassigned"}
- Booking status: ${lead.booking || "none"}
- Last remark: ${lead.remark1 || lead.remarkNote || "none"}
- AI Score: ${lead.score ?? "not scored"}
- Notes: ${(lead.notes || []).length} note(s)`);
      }
    } catch { /* non-critical */ }
  }

  // ── Page-specific live stats ──────────────────────────────────────────────
  const cleanPage = (page || "").split("?")[0];

  try {
    if (cleanPage === "/dashboard" || cleanPage === "/leads" || cleanPage === "/") {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const [total, newToday, hotLeads, overdueCount] = await Promise.all([
        Lead.countDocuments({ orgId, isDeleted: { $ne: true } }),
        Lead.countDocuments({ orgId, isDeleted: { $ne: true }, createdAt: { $gte: startOfDay } }),
        Lead.find({ orgId, isDeleted: { $ne: true }, score: { $gte: 60 } })
          .sort({ score: -1 }).limit(3).select("name status score phone").lean(),
        Lead.countDocuments({
          orgId, isDeleted: { $ne: true },
          followUpDate: { $lt: startOfDay, $ne: null },
        }),
      ]);
      parts.push(`LIVE WORKSPACE DATA:
- Total leads: ${total}
- New leads today: ${newToday}
- Overdue follow-ups: ${overdueCount}
- Hot leads (score ≥60): ${hotLeads.length ? hotLeads.map(l => `${l.name} (${l.status}, score ${l.score})`).join(" | ") : "none right now"}`);
    }

    if (cleanPage === "/followups") {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay   = new Date(); endOfDay.setHours(23, 59, 59, 999);
      const [overdueCount, todayCount, overdueLeads] = await Promise.all([
        Lead.countDocuments({ orgId, isDeleted: { $ne: true }, followUpDate: { $lt: startOfDay, $ne: null } }),
        Lead.countDocuments({ orgId, isDeleted: { $ne: true }, followUpDate: { $gte: startOfDay, $lte: endOfDay } }),
        Lead.find({ orgId, isDeleted: { $ne: true }, followUpDate: { $lt: startOfDay, $ne: null } })
          .sort({ followUpDate: 1 }).limit(3).select("name phone status followUpDate").lean(),
      ]);
      parts.push(`LIVE FOLLOW-UP DATA:
- Overdue follow-ups: ${overdueCount}
- Due today: ${todayCount}
- Next overdue: ${overdueLeads.map(l => `${l.name} (due ${new Date(l.followUpDate).toLocaleDateString("en-IN")}, status: ${l.status})`).join(" | ") || "none"}`);
    }

    if (cleanPage === "/pipeline") {
      const stages = ["New", "Contacted", "Site Visit", "Negotiation", "Closed Won", "Closed Lost"];
      const counts = await Promise.all(
        stages.map(s => Lead.countDocuments({ orgId, isDeleted: { $ne: true }, status: s }))
      );
      parts.push(`LIVE PIPELINE DATA:\n${stages.map((s, i) => `- ${s}: ${counts[i]} leads`).join("\n")}`);
    }

    if (cleanPage === "/projects" && Project) {
      const projects = await Project.find({ orgId, isArchived: { $ne: true } })
        .select("name location priceMin priceMax")
        .sort({ createdAt: -1 }).limit(6).lean();
      parts.push(`LIVE PROJECTS DATA:\n${projects.length
        ? projects.map(p => `- ${p.name}${p.location ? ` (${p.location})` : ""}${p.priceMin ? `, ₹${(p.priceMin / 1e5).toFixed(0)}L - ₹${(p.priceMax / 1e5).toFixed(0)}L` : ""}`).join("\n")
        : "No projects created yet."}`);
    }

    if (cleanPage === "/performance" && User) {
      const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
      const agents = await User.find({ orgId, isActive: { $ne: false } })
        .select("name role").limit(10).lean();
      const reportable = agents.filter(a => a.role === "agent" || a.role === "manager").slice(0, 5);
      if (reportable.length) {
        const agentStats = await Promise.all(
          reportable.map(async (a) => {
            const [total, won] = await Promise.all([
              Lead.countDocuments({ orgId, assignedTo: a._id, isDeleted: { $ne: true }, createdAt: { $gte: thirtyDaysAgo } }),
              Lead.countDocuments({ orgId, assignedTo: a._id, isDeleted: { $ne: true }, status: "Closed Won", createdAt: { $gte: thirtyDaysAgo } }),
            ]);
            return `${a.name}: ${total} leads, ${won} won (last 30 days)`;
          })
        );
        parts.push(`LIVE PERFORMANCE DATA (last 30 days):\n${agentStats.map(s => `- ${s}`).join("\n")}`);
      }
    }

    if (cleanPage === "/team" && User) {
      const members = await User.find({ orgId, isActive: { $ne: false } })
        .select("name role email").limit(15).lean();
      parts.push(`LIVE TEAM DATA:
- Total active members: ${members.length}
${members.map(m => `- ${m.name} (${m.role})`).join("\n")}`);
    }

    if ((cleanPage === "/bookings" || cleanPage === "/invoices") && Booking && Invoice) {
      const [totalBookings, newBookings, invoicedBookings, paidBookings] = await Promise.all([
        Booking.countDocuments({ orgId }),
        Booking.countDocuments({ orgId, status: "new" }),
        Booking.countDocuments({ orgId, status: "invoiced" }),
        Booking.countDocuments({ orgId, status: "payment_received" }),
      ]);
      const aggResult = await Booking.aggregate([
        { $match: { orgId: typeof orgId === "string" ? require("mongoose").Types.ObjectId.createFromHexString(orgId) : orgId } },
        { $group: { _id: null, totalBrokerage: { $sum: "$totalBill" } } },
      ]);
      const totalBrokerage = aggResult[0]?.totalBrokerage || 0;

      const recentBookings = await Booking.find({ orgId })
        .sort({ createdAt: -1 }).limit(3)
        .select("customerName developerName projectName status totalBill").lean();

      const [draftInvoices, pendingInvoices] = await Promise.all([
        Invoice.countDocuments({ orgId, status: "draft" }),
        Invoice.countDocuments({ orgId, status: { $in: ["sent", "payment_pending"] } }),
      ]);

      parts.push(`LIVE BOOKINGS & INVOICES DATA:
- Total bookings: ${totalBookings} (New: ${newBookings}, Invoiced: ${invoicedBookings}, Paid: ${paidBookings})
- Total brokerage value: ₹${totalBrokerage.toLocaleString("en-IN")}
- Draft invoices: ${draftInvoices}
- Invoices awaiting payment: ${pendingInvoices}
- Recent bookings: ${recentBookings.length ? recentBookings.map(b => `${b.customerName} / ${b.developerName} (${b.status}, ₹${(b.totalBill || 0).toLocaleString("en-IN")})`).join(" | ") : "none yet"}`);
    }

    if (cleanPage === "/attendance") {
      const rec = await Attendance.findOne({ userId, date: today }).lean();
      parts.push(`ATTENDANCE TODAY:
- Clock in: ${rec?.clockIn ? new Date(rec.clockIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "not yet"}
- Clock out: ${rec?.clockOut ? new Date(rec.clockOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "not yet"}
- Hours worked: ${rec?.totalMinutes ? `${Math.floor(rec.totalMinutes / 60)}h ${rec.totalMinutes % 60}m` : "-"}
- Status: ${rec?.clockIn ? (rec.clockOut ? "Completed" : "Active") : "Not clocked in"}`);
    }
  } catch { /* non-critical */ }

  return parts.join("\n\n");
}

module.exports = { fetchPageContext };
