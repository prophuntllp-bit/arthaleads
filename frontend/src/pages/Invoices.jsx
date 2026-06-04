import { useState, useEffect, useCallback, useRef } from "react";
import { FileText, X, Download, Send, CheckCircle2, Clock, FileCheck, Pencil, Check } from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { AppSelect } from "../components/UI";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtINR(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d, fmt = "long") {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", fmt === "long"
    ? { day: "numeric", month: "long", year: "numeric" }
    : { day: "2-digit", month: "2-digit", year: "numeric" });
}

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

// ── Brand color helpers ───────────────────────────────────────────────────────
function parseBrand(org) {
  const hex = (org?.brandColor && /^#[0-9a-fA-F]{6}$/.test(org.brandColor))
    ? org.brandColor : "#FF6B00";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { hex, light: `rgba(${r},${g},${b},0.07)` };
}

// ── Shared Letterhead ─────────────────────────────────────────────────────────
function Letterhead({ org, invNumber, invDate }) {
  const c = parseBrand(org);
  return (
    <div>
      <div style={{ height: 4, background: c.hex }} />
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 20px", background: "#fff", borderBottom: "1px solid #e2e8f0",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {org?.logo ? (
            <img src={org.logo} alt={org?.name}
              style={{ height: 40, maxWidth: 110, objectFit: "contain", borderRadius: 4 }} />
          ) : (
            <div style={{
              height: 40, width: 40, display: "flex", alignItems: "center",
              justifyContent: "center", background: c.hex,
              borderRadius: 6, color: "#fff", fontWeight: "bold", fontSize: 18,
            }}>
              {(org?.name || "?")[0].toUpperCase()}
            </div>
          )}
          <p style={{ color: "#1e293b", fontWeight: "800", fontSize: 16, margin: 0 }}>{org?.name || ""}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ display: "inline-block", padding: "4px 12px", background: "#1e293b", borderRadius: 4, marginBottom: 3 }}>
            <span style={{ color: "#fff", fontWeight: "bold", fontSize: 11, letterSpacing: 2 }}>TAX INVOICE</span>
          </div>
          <p style={{ color: "#64748b", fontSize: 10, margin: 0 }}>
            No.&nbsp;{invNumber}&nbsp;&nbsp;|&nbsp;&nbsp;{fmtDate(invDate)}
          </p>
        </div>
      </div>
      <div style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", padding: "3px 20px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0 14px", fontSize: 8.5, color: "#475569", marginBottom: 1 }}>
          {org?.address && <span>📍 {org.address}</span>}
          {org?.phone   && <span>📞 {org.phone}</span>}
          {org?.email   && <span>✉ {org.email}</span>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0 14px", fontSize: 8.5, color: "#475569" }}>
          {org?.gstNo && <span>GST: <strong>{org.gstNo}</strong></span>}
          {org?.pan   && <span>PAN: <strong>{org.pan}</strong></span>}
          {org?.rera  && <span>RERA: <strong>{org.rera}</strong></span>}
        </div>
      </div>
    </div>
  );
}

// ── SIMPLE Invoice Template ───────────────────────────────────────────────────
function SimpleInvoicePDF({ inv, org }) {
  const c = parseBrand(org);
  const secH = { padding: "5px 10px", fontWeight: "bold", background: "#1e293b", color: "#fff", textAlign: "left", fontSize: 10, letterSpacing: 0.3 };
  const tdS  = { padding: "5px 10px", border: "1px solid #e2e8f0", fontSize: 10 };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", fontSize: 10, color: "#1a1a1a", maxWidth: 720, margin: "0 auto", background: "#fff" }}>
      <Letterhead org={org} invNumber={inv.customInvoiceNumber || inv.invoiceNumber} invDate={inv.invoiceDate} />

      <div style={{ padding: "14px 20px" }}>
        {/* Bill To + Invoice Meta */}
        <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
          <div style={{ flex: 1, padding: "10px 12px", borderRadius: 5, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <p style={{ fontSize: 8, fontWeight: "bold", color: "#94a3b8", letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>Bill To</p>
            <p style={{ fontWeight: "bold", fontSize: 12, margin: "0 0 2px", color: "#1e293b" }}>{inv.developerName}</p>
            {inv.developerAddress && <p style={{ fontSize: 9, color: "#64748b", margin: "0 0 2px" }}>{inv.developerAddress}</p>}
            {inv.developerGst && <p style={{ fontSize: 9, margin: 0 }}>GSTIN: <strong>{inv.developerGst}</strong></p>}
            {inv.developerPan && <p style={{ fontSize: 9, margin: 0 }}>PAN: <strong>{inv.developerPan}</strong></p>}
          </div>
          <div style={{ width: 180, padding: "10px 12px", borderRadius: 5, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <p style={{ fontSize: 8, fontWeight: "bold", color: "#94a3b8", letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>Invoice Details</p>
            {[
              ["Invoice No", inv.customInvoiceNumber || inv.invoiceNumber],
              ["Date",       fmtDate(inv.invoiceDate)],
              ["GST Type",   inv.gstType || "CGST+SGST"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, marginBottom: 2 }}>
                <span style={{ color: "#64748b" }}>{k}</span>
                <strong style={{ color: "#1e293b" }}>{v}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Subject */}
        <div style={{ borderLeft: `3px solid ${c.hex}`, background: "#f8fafc", padding: "6px 10px", marginBottom: 10, borderRadius: "0 4px 4px 0" }}>
          <p style={{ fontSize: 10, fontWeight: "bold", margin: 0, color: "#1e293b" }}>
            Brokerage for {inv.unitType} {inv.unitNo}{inv.tower ? ` / Tower ${inv.tower}` : ""}{inv.phase ? ` / Phase ${inv.phase}` : ""} at {inv.projectName}
          </p>
          <p style={{ fontSize: 9, color: "#64748b", margin: "2px 0 0" }}>
            Customer: {inv.customerName}{inv.jointBuyerName ? ` / ${inv.jointBuyerName}` : ""}
          </p>
        </div>

        {/* Charges table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 4 }}>
          <thead>
            <tr>
              <th style={{ ...secH, width: "8%", textAlign: "center" }}>Sr.</th>
              <th style={secH}>Description</th>
              <th style={{ ...secH, textAlign: "right", whiteSpace: "nowrap" }}>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...tdS, textAlign: "center", verticalAlign: "top" }}>1</td>
              <td style={tdS}>
                <strong>Brokerage Charges</strong>
                {inv.brokerageAdjustment > 0 && <p style={{ fontSize: 9, margin: "1px 0 0", color: "#64748b" }}>Less adjustment: {fmtINR(inv.brokerageAdjustment)}</p>}
                {inv.fosIncentive > 0 && <p style={{ fontSize: 9, margin: "1px 0 0", color: "#64748b" }}>FOS Incentive: {fmtINR(inv.fosIncentive)}</p>}
                {inv.eoiIncentive > 0 && <p style={{ fontSize: 9, margin: "1px 0 0", color: "#64748b" }}>EOI Incentive: {fmtINR(inv.eoiIncentive)}</p>}
              </td>
              <td style={{ ...tdS, textAlign: "right", fontWeight: "bold" }}>{fmtINR(inv.totalBrokerage)}</td>
            </tr>
            {inv.gstType !== "IGST" ? (<>
              <tr><td style={{ ...tdS, textAlign: "center" }}></td><td style={tdS}>CGST @ 9%</td><td style={{ ...tdS, textAlign: "right" }}>{fmtINR(inv.cgst)}</td></tr>
              <tr><td style={{ ...tdS, textAlign: "center" }}></td><td style={tdS}>SGST @ 9%</td><td style={{ ...tdS, textAlign: "right" }}>{fmtINR(inv.sgst)}</td></tr>
            </>) : (
              <tr><td style={{ ...tdS, textAlign: "center" }}></td><td style={tdS}>IGST @ 18%</td><td style={{ ...tdS, textAlign: "right" }}>{fmtINR(inv.igst)}</td></tr>
            )}
            <tr style={{ background: "#1e293b" }}>
              <td colSpan={2} style={{ ...tdS, textAlign: "right", fontWeight: "bold", fontSize: 12, color: "#fff", border: "none" }}>GRAND TOTAL</td>
              <td style={{ ...tdS, textAlign: "right", fontWeight: "bold", fontSize: 12, color: c.hex, border: "none" }}>{fmtINR(inv.totalBill)}</td>
            </tr>
          </tbody>
        </table>

        <p style={{ fontSize: 9, fontStyle: "italic", margin: "4px 0 12px", color: "#64748b" }}>
          Amount in Words: <strong style={{ color: "#1e293b" }}>{amountInWords(inv.totalBill)}</strong>
        </p>

        {/* Payment details + signatory */}
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 2, padding: "10px 12px", borderRadius: 5, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <p style={{ fontWeight: "bold", color: "#1e293b", fontSize: 10, marginBottom: 6 }}>Payment Details</p>
            <table style={{ fontSize: 9.5, width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {[
                  ["Account Name",  org?.bankAccountName || ""],
                  ["Account No.",   org?.bankAccountNo   || ""],
                  ["IFSC Code",     org?.bankIfsc        || ""],
                  ["Bank / Branch", [org?.bankName, org?.bankBranch].filter(Boolean).join(", ")],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ color: "#475569", fontWeight: "600", paddingRight: 10, paddingBottom: 3, whiteSpace: "nowrap" }}>{k}</td>
                    <td style={{ paddingBottom: 3, color: "#1e293b" }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ flex: 1, padding: "10px 12px", borderRadius: 5, border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <p style={{ fontSize: 9, color: "#94a3b8", margin: 0 }}>For {org?.name || ""}</p>
            <div>
              <div style={{ height: 44, borderBottom: "1px dashed #cbd5e1", marginBottom: 4 }} />
              <p style={{ fontSize: 9, color: "#64748b", margin: 0 }}>Authorized Signatory</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 16, padding: "6px 14px", borderRadius: 3, background: "#1e293b", color: "#94a3b8", fontSize: 8.5, textAlign: "center" }}>
          {[org?.address, org?.phone, org?.email].filter(Boolean).join("  ·  ")}
        </div>
      </div>
    </div>
  );
}

// ── DETAILED Invoice Template ─────────────────────────────────────────────────
function DetailedInvoicePDF({ inv, org }) {
  const c   = parseBrand(org);
  const secH = { padding: "5px 10px", fontWeight: "bold", background: "#1e293b", color: "#fff", textAlign: "center", fontSize: 9.5, letterSpacing: 0.3 };
  const thL  = { padding: "4px 8px", fontWeight: "600", background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: 9, whiteSpace: "nowrap", color: "#475569" };
  const tdD  = { padding: "4px 8px", border: "1px solid #e2e8f0", fontSize: 9, color: "#1e293b" };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", fontSize: 9.5, color: "#1a1a1a", maxWidth: 760, margin: "0 auto", background: "#fff" }}>
      <Letterhead org={org} invNumber={inv.customInvoiceNumber || inv.invoiceNumber} invDate={inv.invoiceDate} />

      <div style={{ padding: "12px 20px" }}>
        {/* TO / FROM */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
          <thead>
            <tr>
              <th colSpan={2} style={{ ...secH, width: "50%", borderRight: "2px solid #fff" }}>TO (Developer)</th>
              <th colSpan={2} style={secH}>FROM (Brokerage Firm)</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Name",           inv.developerName || "-",                              "Company",       org?.name || ""],
              ["Address",        inv.developerAddress || "-",                           "Address",       org?.address || "-"],
              ["PAN",            inv.developerPan || "-",                               "PAN",           org?.pan || "-"],
              ["CIN",            inv.developerCin || "-",                               "GSTIN",         org?.gstNo || "-"],
              ["GSTIN",          inv.developerGst || "-",                               "RERA Reg. No.", org?.rera || "-"],
              ["RERA No.",       (inv.developerReraNumbers || []).join(", ") || "-",    "CIN",           org?.cin || "-"],
              ["Invoice Date",   fmtDate(inv.invoiceDate, "short").replace(/\//g,"-"), "Invoice No.",   String(inv.invoiceNumber)],
              ["Place of Supply","MAHARASHTRA",                                         "State Code",    "27"],
            ].map(([k1, v1, k2, v2]) => (
              <tr key={k1} style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ ...thL, borderRight: "1px solid #e2e8f0" }}>{k1}</td>
                <td style={{ ...tdD, borderRight: "2px solid #1e293b" }}>{v1}</td>
                <td style={{ ...thL, borderRight: "1px solid #e2e8f0" }}>{k2}</td>
                <td style={tdD}>{v2}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Subject */}
        <div style={{ borderLeft: `3px solid ${c.hex}`, background: "#f8fafc", padding: "5px 10px", marginBottom: 8, borderRadius: "0 3px 3px 0" }}>
          <p style={{ fontWeight: "bold", fontSize: 9.5, margin: 0, color: "#1e293b" }}>
            SUBJECT: BROKERAGE FOR{inv.phase ? ` Phase ${inv.phase}` : ""} {inv.unitType} No.{inv.unitNo}
            {inv.tower ? ` / Tower ${inv.tower}` : ""} AT {(inv.projectName || "").toUpperCase()}
          </p>
        </div>

        {/* Unit + Brokerage side by side */}
        <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
          {/* Unit Details */}
          <table style={{ flex: 1, borderCollapse: "collapse", alignSelf: "start" }}>
            <thead><tr><th colSpan={2} style={secH}>UNIT DETAILS</th></tr></thead>
            <tbody>
              {[
                ["Project",   inv.projectName],
                ["Customer",  inv.jointBuyerName ? `${inv.customerName} / ${inv.jointBuyerName}` : inv.customerName],
                ["Phase",     inv.phase || "-"],
                [inv.unitType === "Plot" ? "Plot No" : "Unit No", inv.unitNo + (inv.tower ? ` (Tower: ${inv.tower})` : "")],
                ["Sale Value", inv.considerationValue ? "₹" + Number(inv.considerationValue).toLocaleString("en-IN") : "-"],
              ].map(([k, v]) => (
                <tr key={k} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ ...thL, borderRight: "1px solid #e2e8f0", width: "40%" }}>{k}</td>
                  <td style={{ ...tdD, fontWeight: "600", textAlign: "right" }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Brokerage Details */}
          <table style={{ flex: 1, borderCollapse: "collapse", alignSelf: "start" }}>
            <thead><tr><th colSpan={2} style={secH}>BROKERAGE DETAILS</th></tr></thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ ...thL, borderRight: "1px solid #e2e8f0" }}>Brokerage @ {inv.brokeragePercent}%</td>
                <td style={{ ...tdD, textAlign: "right", fontWeight: "600" }}>{fmtINR(inv.brokerageAmount)}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ ...thL, borderRight: "1px solid #e2e8f0" }}>Adjustment (–)</td>
                <td style={{ ...tdD, textAlign: "right" }}>{inv.brokerageAdjustment ? `– ${fmtINR(inv.brokerageAdjustment)}` : "–"}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ ...thL, borderRight: "1px solid #e2e8f0" }}>FOS Incentive</td>
                <td style={{ ...tdD, textAlign: "right" }}>{inv.fosIncentive ? fmtINR(inv.fosIncentive) : "–"}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ ...thL, borderRight: "1px solid #e2e8f0" }}>EOI Incentive</td>
                <td style={{ ...tdD, textAlign: "right" }}>{inv.eoiIncentive ? fmtINR(inv.eoiIncentive) : "–"}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                <td style={{ ...thL, fontWeight: "700", color: "#1e293b", borderRight: "1px solid #e2e8f0" }}>Pre-GST Total</td>
                <td style={{ ...tdD, textAlign: "right", fontWeight: "700" }}>{fmtINR(inv.totalBrokerage)}</td>
              </tr>
              {inv.gstType !== "IGST" ? (<>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ ...thL, borderRight: "1px solid #e2e8f0" }}>CGST @ 9%</td>
                  <td style={{ ...tdD, textAlign: "right" }}>{fmtINR(inv.cgst)}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ ...thL, borderRight: "1px solid #e2e8f0" }}>SGST @ 9%</td>
                  <td style={{ ...tdD, textAlign: "right" }}>{fmtINR(inv.sgst)}</td>
                </tr>
              </>) : (
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ ...thL, borderRight: "1px solid #e2e8f0" }}>IGST @ 18%</td>
                  <td style={{ ...tdD, textAlign: "right" }}>{fmtINR(inv.igst)}</td>
                </tr>
              )}
              <tr style={{ background: "#1e293b" }}>
                <td style={{ padding: "5px 8px", fontWeight: "bold", fontSize: 11, color: "#fff", border: "none" }}>TOTAL BILL</td>
                <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: "bold", fontSize: 11, color: c.hex, border: "none" }}>{fmtINR(inv.totalBill)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p style={{ fontSize: 8.5, fontStyle: "italic", color: "#64748b", margin: "0 0 8px" }}>
          Amount in Words: <strong style={{ color: "#1e293b" }}>{amountInWords(inv.totalBill)}</strong>
        </p>

        {/* Payment + Signatory */}
        <div style={{ display: "flex", gap: 10 }}>
          <table style={{ flex: 2, borderCollapse: "collapse", alignSelf: "start" }}>
            <thead><tr><th colSpan={2} style={secH}>PAYMENT DETAILS</th></tr></thead>
            <tbody>
              {[
                ["Payee Name",   org?.bankAccountName || org?.name || ""],
                ["Bank",         [org?.bankName, org?.bankBranch].filter(Boolean).join(", ") || ""],
                ["Account Type", "Current Account"],
                ["Account No.",  org?.bankAccountNo  || ""],
                ["IFSC Code",    org?.bankIfsc       || ""],
              ].filter(([, v]) => v).map(([k, v]) => (
                <tr key={k} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ ...thL, borderRight: "1px solid #e2e8f0", width: "38%" }}>{k}</td>
                  <td style={tdD}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ ...secH }}>AUTHORIZED SIGNATORY</div>
            <div style={{ flex: 1, padding: "10px 12px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <p style={{ fontSize: 9, color: "#94a3b8", margin: 0 }}>For {org?.name || ""}</p>
              <div>
                <div style={{ height: 50 }} />
                <div style={{ borderTop: "1px dashed #cbd5e1", paddingTop: 4 }}>
                  <p style={{ fontSize: 8.5, color: "#64748b", margin: 0 }}>Stamp &amp; Signature</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 12, padding: "6px 14px", borderRadius: 3, background: "#1e293b", color: "#94a3b8", fontSize: 8.5, textAlign: "center" }}>
          {[org?.address, org?.phone, org?.email].filter(Boolean).join("  ·  ")}
        </div>
      </div>
    </div>
  );
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS = {
  draft:            { label: "Draft",            bg: "rgba(107,114,128,0.1)", color: "#6b7280", icon: FileText },
  sent:             { label: "Sent",             bg: "rgba(59,130,246,0.1)",  color: "#3b82f6", icon: Send },
  payment_pending:  { label: "Payment Pending",  bg: "rgba(245,158,11,0.1)",  color: "#f59e0b", icon: Clock },
  payment_received: { label: "Payment Received", bg: "rgba(16,185,129,0.1)",  color: "#10b981", icon: CheckCircle2 },
};
const STATUS_ORDER = ["draft", "sent", "payment_pending", "payment_received"];

// ── PDF Modal ─────────────────────────────────────────────────────────────────
function PDFModal({ inv, org, onClose }) {
  const printRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!printRef.current || downloading) return;
    setDownloading(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const filename = `Invoice-${inv.customInvoiceNumber || inv.invoiceNumber}-${inv.customerName.replace(/\s+/g, "_")}.pdf`;
      await html2pdf()
        .set({
          margin: [6, 6, 6, 6],
          filename,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false, scrollX: 0, scrollY: 0 },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: "avoid-all" },
        })
        .from(printRef.current)
        .save();
    } catch {
      toast.error("Download failed. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", overflowY: "auto", padding: "20px 12px" }}>
      <div className="w-full max-w-3xl" style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 25px 60px rgba(0,0,0,0.4)" }}>
        {/* Toolbar */}
        <div className="no-print flex items-center justify-between px-4 py-3 bg-gray-100">
          <p className="font-bold text-gray-800 text-sm">Invoice #{inv.customInvoiceNumber || inv.invoiceNumber} — {inv.customerName}</p>
          <div className="flex items-center gap-2">
            <button onClick={handleDownload} disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold cursor-pointer transition text-white disabled:opacity-60"
              style={{ background: "#ff6b00" }}>
              {downloading
                ? <><span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Downloading…</>
                : <><Download className="h-4 w-4" /> Download PDF</>}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-xl text-gray-500 hover:text-gray-800 cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
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
  const [viewInv, setViewInv]         = useState(null);
  const [updating, setUpdating]       = useState(null);
  const [editingNum, setEditingNum]   = useState(null); // inv._id being edited
  const [editNumVal, setEditNumVal]   = useState("");
  const editNumRef = useRef(null);

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

  const startEditNum = (inv) => {
    setEditingNum(inv._id);
    setEditNumVal(inv.customInvoiceNumber || String(inv.invoiceNumber));
    setTimeout(() => editNumRef.current?.select(), 30);
  };

  const saveInvoiceNumber = async (inv) => {
    const trimmed = editNumVal.trim();
    setEditingNum(null);
    if (!trimmed || trimmed === (inv.customInvoiceNumber || String(inv.invoiceNumber))) return;
    try {
      const { data } = await api.patch(`/invoices/${inv._id}/number`, { invoiceNumber: trimmed });
      setInvoices(list => list.map(x => x._id === inv._id ? data.data : x));
      toast.success("Invoice number updated.");
    } catch { toast.error("Failed to update invoice number."); }
  };

  const filtered = statusFilter === "all" ? invoices : invoices.filter(i => i.status === statusFilter);
  const totalBill = invoices.reduce((s, i) => s + (i.totalBill || 0), 0);
  const totalRecv = invoices.filter(i => i.status === "payment_received").reduce((s, i) => s + (i.totalBill || 0), 0);
  const totalPend = invoices.filter(i => i.status !== "payment_received").reduce((s, i) => s + (i.totalBill || 0), 0);

  return (
    <div className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-black text-app flex items-center gap-2">
            <FileCheck className="h-5 w-5" style={{ color: "var(--app-primary)" }} />
            Invoices
          </h1>
          <p className="text-sm text-app-soft mt-0.5">Brokerage tax invoices sent to developers</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        {[
          { label: "Total Raised", value: fmtINR(totalBill), color: "#6366f1" },
          { label: "Received",     value: fmtINR(totalRecv), color: "#10b981" },
          { label: "Pending",      value: fmtINR(totalPend), color: "#f59e0b" },
        ].map(s => (
          <div key={s.label} className="card rounded-2xl p-4" style={{ border: "1px solid var(--app-border)" }}>
            <p className="text-xs text-app-soft">{s.label}</p>
            <p className="text-lg font-black mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

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
                  return (
                    <tr key={inv._id} style={{ borderBottom: "1px solid var(--app-border)" }}
                      className="hover:bg-black/2 dark:hover:bg-white/2 transition">
                      <td className="px-4 py-3">
                        {editingNum === inv._id ? (
                          <div className="flex items-center gap-1">
                            <span className="font-black text-app-soft text-base">#</span>
                            <input
                              ref={editNumRef}
                              value={editNumVal}
                              onChange={e => setEditNumVal(e.target.value)}
                              onBlur={() => saveInvoiceNumber(inv)}
                              onKeyDown={e => {
                                if (e.key === "Enter") { e.target.blur(); }
                                if (e.key === "Escape") { setEditingNum(null); }
                              }}
                              className="input text-sm font-bold w-24 py-0.5 px-1.5"
                              style={{ height: 28 }}
                            />
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditNum(inv)}
                            className="group flex items-center gap-1.5 hover:opacity-80 transition cursor-pointer"
                            title="Click to edit invoice number"
                          >
                            <span className="font-black text-app text-base">
                              #{inv.customInvoiceNumber || inv.invoiceNumber}
                            </span>
                            <Pencil className="h-3 w-3 text-app-soft opacity-0 group-hover:opacity-100 transition" />
                          </button>
                        )}
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
                        {updating === inv._id ? (
                          <span className="inline-flex items-center gap-1.5 pl-2.5 pr-2 py-1 rounded-lg text-[10px] font-bold" style={{ background: s.bg, color: s.color }}>
                            <span className="h-2.5 w-2.5 rounded-full border-2 border-current border-t-transparent animate-spin inline-block" />
                            {s.label}
                          </span>
                        ) : (
                          <AppSelect
                            value={inv.status}
                            onChange={v => updateStatus(inv, v)}
                            disabled={updating === inv._id}
                            options={STATUS_ORDER.map(k => ({ value: k, label: STATUS[k].label }))}
                            raw
                            triggerClassName="pl-2.5 pr-2 py-1 rounded-lg text-[10px] font-bold"
                            triggerStyle={{ background: s.bg, color: s.color }}
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-app-soft whitespace-nowrap">
                        {new Date(inv.invoiceDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setViewInv(inv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold cursor-pointer transition"
                          style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.25)" }}>
                          <Download className="h-3 w-3" /> Download PDF
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
