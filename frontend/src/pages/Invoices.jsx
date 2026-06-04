import { useState, useEffect, useCallback, useRef } from "react";
import { FileText, X, Printer, ChevronDown, IndianRupee, Send, CheckCircle2, Clock, FileCheck, RotateCcw } from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtINR(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d, fmt = "long") {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", fmt === "long"
    ? { day: "numeric", month: "long", year: "numeric" }
    : { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Convert number to Indian currency words
function toWords(n) {
  if (!n) return "Zero";
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
                 "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen",
                 "Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function twoDigits(n) {
    if (n < 20) return ones[n];
    return tens[Math.floor(n/10)] + (n%10 ? " " + ones[n%10] : "");
  }
  function threeDigits(n) {
    if (n >= 100) return ones[Math.floor(n/100)] + " Hundred" + (n%100 ? " " + twoDigits(n%100) : "");
    return twoDigits(n);
  }
  let parts = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh  = Math.floor(n / 100000);   n %= 100000;
  const thous = Math.floor(n / 1000);     n %= 1000;
  const rest  = n;
  if (crore)  parts.push(threeDigits(crore) + " Crore");
  if (lakh)   parts.push(threeDigits(lakh)  + " Lakh");
  if (thous)  parts.push(threeDigits(thous) + " Thousand");
  if (rest)   parts.push(threeDigits(rest));
  return parts.join(" ");
}

function amountInWords(totalBill) {
  const num = Math.round(Number(totalBill) || 0);
  const paisa = Math.round((Number(totalBill) - num) * 100);
  let w = "Rupees " + toWords(num);
  if (paisa) w += " and " + toWords(paisa) + " Paise";
  return w + " Only.";
}

// ── SIMPLE Invoice Template (#93 style) ──────────────────────────────────────
function SimpleInvoicePDF({ inv, org }) {
  return (
    <div className="invoice-print" style={{
      fontFamily: "Arial, sans-serif", fontSize: 12, color: "#000",
      maxWidth: 700, margin: "0 auto", padding: 24, background: "#fff",
    }}>
      {/* Logo + header */}
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        {org?.logo && <img src={org.logo} alt={org.name} style={{ height: 60, objectFit: "contain" }} />}
        <p style={{ fontWeight: "bold", fontSize: 16, margin: "6px 0 2px" }}>{org?.name || "PropHunt LLP"}</p>
        {org?.address && <p style={{ fontSize: 10, color: "#555" }}>{org.address}</p>}
        {org?.phone && <p style={{ fontSize: 10, color: "#555" }}>Mobile: {org.phone}</p>}
      </div>

      {/* To / Meta row */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, gap: 24 }}>
        <div>
          <p style={{ fontWeight: "bold", marginBottom: 2 }}>To -</p>
          <p style={{ fontWeight: "bold" }}>{inv.developerName}</p>
          {inv.developerAddress && <p style={{ fontSize: 11, color: "#444", maxWidth: 300 }}>{inv.developerAddress}</p>}
          {inv.developerGst && <p style={{ fontSize: 11 }}>GST: {inv.developerGst}</p>}
        </div>
        <div style={{ textAlign: "right", fontSize: 11, lineHeight: "1.8" }}>
          <p><strong>Tax Invoice</strong></p>
          <p>Date: {fmtDate(inv.invoiceDate)}</p>
          {org?.pan   && <p>Pan Number: {org.pan}</p>}
          {org?.gstNo && <p>GST NO: {org.gstNo}</p>}
          {org?.rera  && <p>RERA NO: {org.rera}</p>}
          <p>Invoice No: {inv.invoiceNumber}</p>
        </div>
      </div>

      {/* Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <thead>
          <tr style={{ background: "#f97316" }}>
            <th style={th}>SL. No.</th>
            <th style={{ ...th, textAlign: "left", width: "70%" }}>Description</th>
            <th style={{ ...th, textAlign: "right" }}>Amount (INR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...td, textAlign: "center" }}>1</td>
            <td style={td}>
              <p style={{ fontWeight: "bold", marginBottom: 4 }}>Brokerage Charges for sale of property to Customer</p>
              <p>Name of the Customer: {inv.customerName}{inv.jointBuyerName ? ` / ${inv.jointBuyerName}` : ""}</p>
              <p>Project Name: {inv.projectName}</p>
              <p>Unit No: {inv.unitNo}{inv.tower ? ` &nbsp;&nbsp; Tower: ${inv.tower}` : ""}{inv.phase ? ` &nbsp;&nbsp; Phase: ${inv.phase}` : ""}</p>
            </td>
            <td style={{ ...td, textAlign: "right" }}></td>
          </tr>
          <tr>
            <td style={td}></td>
            <td style={td}>Amount :-</td>
            <td style={{ ...td, textAlign: "right", fontWeight: "bold" }}>{fmtINR(inv.totalBrokerage)}</td>
          </tr>
          {inv.gstType !== "IGST" ? (
            <>
              <tr>
                <td style={td}></td>
                <td style={td}>CGST @9%</td>
                <td style={{ ...td, textAlign: "right", fontWeight: "bold" }}>{fmtINR(inv.cgst)}</td>
              </tr>
              <tr>
                <td style={td}></td>
                <td style={td}>SGST @9%</td>
                <td style={{ ...td, textAlign: "right", fontWeight: "bold" }}>{fmtINR(inv.sgst)}</td>
              </tr>
            </>
          ) : (
            <tr>
              <td style={td}></td>
              <td style={td}>IGST @18%</td>
              <td style={{ ...td, textAlign: "right", fontWeight: "bold" }}>{fmtINR(inv.igst)}</td>
            </tr>
          )}
          <tr style={{ background: "#f8f8f8" }}>
            <td style={{ ...td, textAlign: "right", fontWeight: "bold" }} colSpan={2}>Grand Total</td>
            <td style={{ ...td, textAlign: "right", fontWeight: "bold" }}>{fmtINR(inv.totalBill)}</td>
          </tr>
        </tbody>
      </table>

      <p style={{ fontSize: 11, fontWeight: "bold", margin: "8px 0 16px" }}>
        Amount in Words: {amountInWords(inv.totalBill)}
      </p>

      {/* Payment section */}
      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 11, fontWeight: "bold", marginBottom: 4 }}>Cheque should be on the name of</p>
          <p style={{ fontSize: 13, fontWeight: "bold" }}>"{org?.name || "PropHunt LLP"}"</p>
        </div>
        <div style={{ flex: 2, background: "#1e40af11", borderRadius: 8, padding: "8px 12px" }}>
          <p style={{ fontWeight: "bold", color: "#1e40af", marginBottom: 6, fontSize: 11 }}>Online Payment</p>
          <table style={{ fontSize: 10, width: "100%" }}>
            {[
              ["Account Name", org?.bankAccountName || "PropHunt LLP"],
              ["Account No",   org?.bankAccountNo   || "007305014955"],
              ["IFSC Code",    org?.bankIfsc         || "ICIC0000073"],
              ["Bank Name",    org?.bankName         || "ICICI BANK"],
              ["Branch",       org?.bankBranch       || "AUNDH BRANCH"],
            ].map(([k, v]) => (
              <tr key={k}>
                <td style={{ color: "#1e40af", fontWeight: "bold", paddingRight: 8, paddingBottom: 2 }}>{k}</td>
                <td>{v}</td>
              </tr>
            ))}
          </table>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32, fontSize: 11 }}>
        <span>Authorized Signatory</span>
        <span>Place - Pune</span>
      </div>

      {/* Footer bar */}
      <div style={{ background: "#c2410c", color: "#fff", marginTop: 24, padding: "8px 16px", borderRadius: 4, fontSize: 10, textAlign: "center" }}>
        {org?.address || "291/3 Work katta Baner, Pune 411045"} &nbsp;|&nbsp; {org?.phone || "7066880808"} &nbsp;|&nbsp; {org?.email || "Info@prophuntllp.com"}
      </div>
    </div>
  );
}

// ── DETAILED Invoice Template (#150 style) ───────────────────────────────────
function DetailedInvoicePDF({ inv, org }) {
  return (
    <div className="invoice-print" style={{
      fontFamily: "Arial, sans-serif", fontSize: 11, color: "#000",
      maxWidth: 760, margin: "0 auto", padding: 20, background: "#fff",
    }}>
      <p style={{ textAlign: "center", fontWeight: "bold", fontSize: 14, border: "2px solid #000", padding: "6px 0", marginBottom: 0 }}>
        TAX INVOICE
      </p>

      {/* To / From header */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr style={{ borderBottom: "1px solid #000" }}>
            <th style={{ ...th2, width: "12%", borderRight: "1px solid #000" }}>To</th>
            <td style={{ ...td2, width: "38%", fontWeight: "bold", borderRight: "1px solid #000" }}>{inv.developerName}</td>
            <th style={{ ...th2, width: "12%", borderRight: "1px solid #000" }}>From</th>
            <td style={{ ...td2, fontWeight: "bold" }}>{org?.name || "PropHunt LLP"}</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #000" }}>
            <th style={{ ...th2, borderRight: "1px solid #000" }}>Address</th>
            <td style={{ ...td2, borderRight: "1px solid #000" }}>{inv.developerAddress || "-"}</td>
            <th style={{ ...th2, borderRight: "1px solid #000" }}>Address</th>
            <td style={td2}>{org?.address || "Baner Pune MH - 411045"}</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #000" }}>
            <th style={{ ...th2, borderRight: "1px solid #000" }}>PAN</th>
            <td style={{ ...td2, borderRight: "1px solid #000" }}>{inv.developerPan}</td>
            <th style={{ ...th2, borderRight: "1px solid #000" }}>CP RERA Regn. No.</th>
            <td style={td2}>{org?.rera || "-"}</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #000" }}>
            <th style={{ ...th2, borderRight: "1px solid #000" }}>CIN</th>
            <td style={{ ...td2, borderRight: "1px solid #000" }}>{inv.developerCin}</td>
            <th style={{ ...th2, borderRight: "1px solid #000" }}>Invoice Date</th>
            <td style={td2}>{fmtDate(inv.invoiceDate, "short").replace(/\//g, "-")}</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #000" }}>
            <th style={{ ...th2, borderRight: "1px solid #000" }}>GSTN NO.</th>
            <td style={{ ...td2, borderRight: "1px solid #000" }}>{inv.developerGst}</td>
            <th style={{ ...th2, borderRight: "1px solid #000" }}>Invoice No.</th>
            <td style={td2}>{inv.invoiceNumber}</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #000" }}>
            <th style={{ ...th2, borderRight: "1px solid #000" }}>RERA No</th>
            <td style={{ ...td2, borderRight: "1px solid #000" }}>
              {(inv.developerReraNumbers || []).map((r, i) => <div key={i}>{r}</div>)}
            </td>
            <th style={{ ...th2, borderRight: "1px solid #000" }}>PAN</th>
            <td style={td2}>{org?.pan || "-"}</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #000" }}>
            <th style={{ ...th2, borderRight: "1px solid #000" }}></th>
            <td style={{ ...td2, borderRight: "1px solid #000" }}></td>
            <th style={{ ...th2, borderRight: "1px solid #000" }}>GSTN NO.</th>
            <td style={td2}>{org?.gstNo || "-"}</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #000" }}>
            <th style={{ ...th2, borderRight: "1px solid #000" }}></th>
            <td style={{ ...td2, borderRight: "1px solid #000" }}></td>
            <th style={{ ...th2, borderRight: "1px solid #000" }}>Place of Supply</th>
            <td style={td2}>MAHARASHTRA</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #000" }}>
            <th style={{ ...th2, borderRight: "1px solid #000" }}></th>
            <td style={{ ...td2, borderRight: "1px solid #000" }}></td>
            <th style={{ ...th2, borderRight: "1px solid #000" }}>State</th>
            <td style={td2}>MAHARASHTRA</td>
          </tr>
          <tr style={{ borderBottom: "2px solid #000" }}>
            <th style={{ ...th2, borderRight: "1px solid #000" }}></th>
            <td style={{ ...td2, borderRight: "1px solid #000" }}></td>
            <th style={{ ...th2, borderRight: "1px solid #000" }}>State Code</th>
            <td style={td2}>27</td>
          </tr>
        </tbody>
      </table>

      {/* Subject */}
      <p style={{ fontWeight: "bold", padding: "8px 0", fontSize: 11 }}>
        SUBJECT: BROKERAGE FOR {inv.phase ? `Phase ${inv.phase} ` : ""}{inv.unitType} No -{inv.unitNo} AT {inv.projectName?.toUpperCase()}
      </p>

      {/* Unit Details */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <thead><tr><th colSpan={2} style={{ ...th, background: "#e5e7eb", color: "#000", textAlign: "center" }}>UNIT DETAILS</th></tr></thead>
        <tbody>
          {[
            ["Project Name",       inv.projectName],
            ["Customer Name",      inv.jointBuyerName ? `${inv.customerName} / ${inv.jointBuyerName}` : inv.customerName],
            ["Phase",              inv.phase || "-"],
            [inv.unitType === "Plot" ? "Plot No" : "Unit No", inv.unitNo + (inv.tower ? ` (Tower: ${inv.tower})` : "")],
            ["Consideration Value", inv.considerationValue ? inv.considerationValue.toLocaleString("en-IN") : "-"],
          ].map(([k, v]) => (
            <tr key={k} style={{ borderBottom: "1px solid #ccc" }}>
              <td style={{ ...td, width: "40%", background: "#f9f9f9" }}>{k}</td>
              <td style={{ ...td, textAlign: "center", fontWeight: "bold" }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Brokerage Details */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
        <thead><tr><th colSpan={2} style={{ ...th, background: "#e5e7eb", color: "#000", textAlign: "center" }}>BROKERAGE DETAILS</th></tr></thead>
        <tbody>
          <tr style={{ borderBottom: "1px solid #ccc" }}>
            <td style={{ ...td, width: "60%", color: "#1e40af" }}>Brokerage@{inv.brokeragePercent}%</td>
            <td style={{ ...td, textAlign: "right", fontWeight: "bold" }}>{fmtINR(inv.brokerageAmount)}</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #ccc" }}>
            <td style={td}>Brokerage adjustment (-)</td>
            <td style={{ ...td, textAlign: "right" }}>{inv.brokerageAdjustment ? `-${fmtINR(inv.brokerageAdjustment)}` : "-"}</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #ccc" }}>
            <td style={td}>FOS Incentive</td>
            <td style={{ ...td, textAlign: "right" }}>{inv.fosIncentive ? fmtINR(inv.fosIncentive) : "-"}</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #ccc" }}>
            <td style={td}>EOI Incentive</td>
            <td style={{ ...td, textAlign: "right" }}>{inv.eoiIncentive ? fmtINR(inv.eoiIncentive) : "-"}</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #ccc", fontWeight: "bold" }}>
            <td style={td}>Total Brokerage</td>
            <td style={{ ...td, textAlign: "right" }}>{fmtINR(inv.totalBrokerage)}</td>
          </tr>
          {inv.gstType !== "IGST" ? (
            <>
              <tr style={{ borderBottom: "1px solid #ccc" }}>
                <td style={td}>Add: SGST @ 9%</td>
                <td style={{ ...td, textAlign: "right" }}>{fmtINR(inv.sgst)}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #ccc" }}>
                <td style={td}>Add: CGST @ 9%</td>
                <td style={{ ...td, textAlign: "right" }}>{fmtINR(inv.cgst)}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #ccc" }}>
                <td style={td}>Add: IGST @ 18%</td>
                <td style={{ ...td, textAlign: "right" }}>-</td>
              </tr>
            </>
          ) : (
            <>
              <tr style={{ borderBottom: "1px solid #ccc" }}>
                <td style={td}>Add: SGST @ 9%</td>
                <td style={{ ...td, textAlign: "right" }}>-</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #ccc" }}>
                <td style={td}>Add: CGST @ 9%</td>
                <td style={{ ...td, textAlign: "right" }}>-</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #ccc" }}>
                <td style={td}>Add: IGST @ 18%</td>
                <td style={{ ...td, textAlign: "right" }}>{fmtINR(inv.igst)}</td>
              </tr>
            </>
          )}
          <tr style={{ fontWeight: "bold", fontSize: 13 }}>
            <td style={td}>Total Bill</td>
            <td style={{ ...td, textAlign: "right" }}>{fmtINR(inv.totalBill)}</td>
          </tr>
        </tbody>
      </table>

      {/* Payment Details */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
        <thead><tr><th colSpan={2} style={{ ...th, background: "#e5e7eb", color: "#000", textAlign: "center" }}>PAYMENT DETAILS</th></tr></thead>
        <tbody>
          {[
            ["Payee Name",    org?.bankAccountName || org?.name || "PropHunt LLP"],
            ["Bank Name",     org?.bankName   || "ICICI BANK"],
            ["Branch Address",org?.bankBranch || "ICICI BANK GULMOHAR PARK AUNDH"],
            ["Account Type",  "CURRENT ACCOUNT"],
            ["Account Number","*" + (org?.bankAccountNo || "007305014955")],
            ["IFSC Code",     org?.bankIfsc   || "ICIC0000073"],
          ].map(([k, v]) => (
            <tr key={k} style={{ borderBottom: "1px solid #ccc" }}>
              <td style={{ ...td, width: "40%", background: "#f9f9f9" }}>{k}</td>
              <td style={td}>{v}</td>
            </tr>
          ))}
          <tr>
            <td style={td}>Authorized Signatory Stamp</td>
            <td style={{ ...td, height: 60 }}></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Shared table cell styles
const th = { padding: "6px 10px", fontWeight: "bold", border: "1px solid #ccc", background: "#f97316", color: "#fff" };
const td = { padding: "5px 10px", border: "1px solid #ccc" };
const th2 = { padding: "4px 8px", fontWeight: "bold", background: "#f9f9f9", border: "1px solid #ccc", fontSize: 10 };
const td2 = { padding: "4px 8px", border: "1px solid #ccc", fontSize: 10 };

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS = {
  draft:            { label: "Draft",            bg: "rgba(107,114,128,0.1)", color: "#6b7280", icon: FileText },
  sent:             { label: "Sent",             bg: "rgba(59,130,246,0.1)",  color: "#3b82f6", icon: Send },
  payment_pending:  { label: "Payment Pending",  bg: "rgba(245,158,11,0.1)",  color: "#f59e0b", icon: Clock },
  payment_received: { label: "Payment Received", bg: "rgba(16,185,129,0.1)",  color: "#10b981", icon: CheckCircle2 },
};
// All status options for the dropdown (any → any allowed)
const STATUS_ORDER = ["draft", "sent", "payment_pending", "payment_received"];

// ── PDF Modal ─────────────────────────────────────────────────────────────────
function PDFModal({ inv, org, onClose }) {
  const printRef = useRef(null);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>Invoice #${inv.invoiceNumber}</title>
      <style>
        body { margin: 0; font-family: Arial, sans-serif; }
        @media print { body { margin: 0; } .no-print { display: none !important; } }
      </style></head>
      <body>${content}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", overflowY: "auto", padding: "20px 12px" }}>
      <div className="w-full max-w-3xl" style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 25px 60px rgba(0,0,0,0.4)" }}>
        {/* Toolbar */}
        <div className="no-print flex items-center justify-between px-4 py-3 bg-gray-100">
          <p className="font-bold text-gray-800 text-sm">Invoice #{inv.invoiceNumber} - {inv.customerName}</p>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold cursor-pointer transition text-white"
              style={{ background: "#ff6b00" }}>
              <Printer className="h-4 w-4" /> Print / Download PDF
            </button>
            <button onClick={onClose}
              className="p-1.5 rounded-xl text-gray-500 hover:text-gray-800 cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        {/* Invoice content */}
        <div ref={printRef}>
          {inv.invoiceTemplate === "simple"
            ? <SimpleInvoicePDF inv={inv} org={org} />
            : <DetailedInvoicePDF inv={inv} org={org} />}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Invoices() {
  const { org } = useAuth();
  const [invoices, setInvoices]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [statusFilter, setFilter] = useState("all");
  const [viewInv, setViewInv]     = useState(null);
  const [updating, setUpdating]   = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/invoices");
      setInvoices(data.data);
    } catch { toast.error("Failed to load invoices."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (inv, status) => {
    setUpdating(inv._id);
    try {
      const { data } = await api.patch(`/invoices/${inv._id}/status`, { status });
      setInvoices(list => list.map(x => x._id === inv._id ? data.data : x));
      toast.success(`Invoice marked as "${STATUS[status]?.label}".`);
    } catch { toast.error("Failed to update status."); }
    finally { setUpdating(null); }
  };

  const filtered = statusFilter === "all" ? invoices : invoices.filter(i => i.status === statusFilter);
  const totalBill = invoices.reduce((s, i) => s + (i.totalBill || 0), 0);
  const totalRecv = invoices.filter(i => i.status === "payment_received").reduce((s, i) => s + (i.totalBill || 0), 0);
  const totalPend = invoices.filter(i => i.status !== "payment_received").reduce((s, i) => s + (i.totalBill || 0), 0);

  return (
    <div className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-black text-app flex items-center gap-2">
            <FileCheck className="h-5 w-5" style={{ color: "var(--app-primary)" }} />
            Invoices
          </h1>
          <p className="text-sm text-app-soft mt-0.5">Brokerage tax invoices sent to developers</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        {[
          { label: "Total Raised",    value: fmtINR(totalBill), color: "#6366f1" },
          { label: "Received",        value: fmtINR(totalRecv), color: "#10b981" },
          { label: "Pending",         value: fmtINR(totalPend), color: "#f59e0b" },
        ].map(s => (
          <div key={s.label} className="card rounded-2xl p-3" style={{ border: "1px solid var(--app-border)" }}>
            <p className="text-xs text-app-soft">{s.label}</p>
            <p className="text-lg font-black mt-0.5" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[["all", "All"], ...Object.entries(STATUS).map(([k, v]) => [k, v.label])].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition"
            style={statusFilter === k
              ? { background: "var(--app-primary)", color: "#fff" }
              : { background: "var(--app-surface-low)", color: "var(--app-text-soft)", border: "1px solid var(--app-border)" }}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="h-8 w-8 rounded-full border-2 animate-spin" style={{ borderColor: "var(--app-border)", borderTopColor: "var(--app-primary)" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <FileCheck className="h-12 w-12 mx-auto mb-3 text-app-soft opacity-30" />
          <p className="text-app font-semibold mb-1">No invoices yet</p>
          <p className="text-sm text-app-soft">Create a booking first, then generate an invoice from the Bookings page.</p>
        </div>
      ) : (
        <div className="card rounded-2xl overflow-hidden" style={{ border: "1px solid var(--app-border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--app-border)", background: "var(--app-surface-low)" }}>
                  {["Invoice #", "Customer", "Developer", "Project / Unit", "Total Bill", "Status", "Date", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-app-soft">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => {
                  const s = STATUS[inv.status] || STATUS.draft;
                  const SIcon = s.icon;
                  return (
                    <tr key={inv._id} style={{ borderBottom: "1px solid var(--app-border)" }}
                      className="hover:bg-black/2 dark:hover:bg-white/2 transition">
                      <td className="px-4 py-3">
                        <span className="font-black text-app text-base">#{inv.invoiceNumber}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-app">{inv.customerName}</p>
                        {inv.jointBuyerName && <p className="text-xs text-app-soft">{inv.jointBuyerName}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-app-soft">{inv.developerName || "-"}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-app">{inv.projectName}</p>
                        <p className="text-xs text-app-soft">
                          {inv.unitType} {inv.unitNo}{inv.tower ? ` • ${inv.tower}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-app">{fmtINR(inv.totalBill)}</p>
                        <p className="text-[10px] text-app-soft">Brok: {fmtINR(inv.totalBrokerage)}</p>
                      </td>
                      <td className="px-4 py-3">
                        {/* Status dropdown — any status can be selected */}
                        <div className="relative">
                          <select
                            value={inv.status}
                            disabled={updating === inv._id}
                            onChange={e => updateStatus(inv, e.target.value)}
                            className="appearance-none pl-2 pr-6 py-1 rounded-lg text-[10px] font-bold cursor-pointer border-0 outline-none disabled:opacity-60"
                            style={{ background: s.bg, color: s.color }}>
                            {STATUS_ORDER.map(k => (
                              <option key={k} value={k}>{STATUS[k].label}</option>
                            ))}
                          </select>
                          {updating === inv._id
                            ? <span className="absolute right-1.5 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full border border-current border-t-transparent animate-spin" style={{ color: s.color }} />
                            : <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 h-2.5 w-2.5 pointer-events-none" style={{ color: s.color }} />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-app-soft whitespace-nowrap">
                        {new Date(inv.invoiceDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setViewInv(inv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold cursor-pointer transition"
                          style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.25)" }}>
                          <Printer className="h-3 w-3" /> View PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewInv && <PDFModal inv={viewInv} org={org} onClose={() => setViewInv(null)} />}
    </div>
  );
}
