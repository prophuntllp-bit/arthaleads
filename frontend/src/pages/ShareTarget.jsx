// ShareTarget.jsx — handles data shared TO the app via Web Share Target API
// When a user shares a contact / phone number / URL from another app,
// Android routes it to /share-target?text=...&title=...&url=...
// We parse it and redirect to /leads with the form pre-filled.
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Very small phone extractor — finds the first digit-sequence that looks like
// a phone number (10+ digits, optionally prefixed with +91 or 0)
function extractPhone(str = "") {
  const match = str.match(/(?:\+91[-\s]?|0)?[6-9]\d{9}/);
  return match ? match[0].replace(/[-\s]/g, "") : "";
}

// Extract a name if the shared text contains one before the number
function extractName(str = "") {
  // e.g. "Ravi Kumar 9876543210" → "Ravi Kumar"
  const match = str.match(/^([A-Za-z ]{2,40})\s+(?:\+91[-\s]?|0)?[6-9]\d{9}/);
  return match ? match[1].trim() : "";
}

export default function ShareTarget() {
  const navigate = useNavigate();

  useEffect(() => {
    const params  = new URLSearchParams(window.location.search);
    const title   = params.get("name")  || params.get("title") || "";
    const text    = params.get("text")  || "";
    const url     = params.get("url")   || "";
    const combined = `${title} ${text} ${url}`.trim();

    const phone = extractPhone(combined);
    const name  = extractName(combined) || title || "";

    // Pass as state so the Leads page / AddLeadModal can pre-fill the form
    navigate("/leads", {
      replace: true,
      state: {
        openAddLead: true,
        prefill: { name, phone, source: "Share Target" },
      },
    });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">
      Opening lead form…
    </div>
  );
}
