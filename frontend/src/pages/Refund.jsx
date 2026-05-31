import { useState } from "react";
import LegalLayout, { Section, ContactBox } from "../components/LegalLayout";
import { usePublicTheme } from "../context/PublicThemeContext";
import { useSEO } from "../utils/useSEO";
import { CheckCircle2, XCircle, CalendarDays } from "lucide-react";

// ── Interactive 7-day refund eligibility checker ──────────────────────────────
function RefundChecker() {
  const { isDark } = usePublicTheme();
  const [paidOn, setPaidOn] = useState("");
  const cardBg = isDark ? "rgba(255,255,255,0.03)" : "#ffffff";
  const border = isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb";
  const label  = isDark ? "rgba(255,255,255,0.7)" : "#374151";

  let result = null;
  if (paidOn) {
    const days = Math.floor((Date.now() - new Date(paidOn).getTime()) / 86400000);
    const eligible = days >= 0 && days <= 7;
    result = { eligible, days };
  }

  return (
    <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: "0.75rem", padding: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <CalendarDays style={{ width: 18, height: 18, color: "#ff6b00" }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? "#fff" : "#111827" }}>
          Check your refund eligibility
        </span>
      </div>
      <label style={{ display: "block", fontSize: 13, color: label, marginBottom: 6 }}>
        When did you make the payment?
      </label>
      <input
        type="date"
        value={paidOn}
        max={new Date().toISOString().split("T")[0]}
        onChange={(e) => setPaidOn(e.target.value)}
        style={{
          width: "100%", padding: "10px 12px", borderRadius: 8,
          border: `1px solid ${border}`, background: isDark ? "rgba(255,255,255,0.05)" : "#f9fafb",
          color: isDark ? "#fff" : "#111827", fontSize: 14, cursor: "pointer",
        }}
      />
      {result && (
        <div
          style={{
            marginTop: 14, padding: "12px 14px", borderRadius: 8,
            display: "flex", alignItems: "center", gap: 10,
            background: result.eligible ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${result.eligible ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
          }}
        >
          {result.eligible
            ? <CheckCircle2 style={{ width: 20, height: 20, color: "#22c55e", flexShrink: 0 }} />
            : <XCircle style={{ width: 20, height: 20, color: "#ef4444", flexShrink: 0 }} />}
          <span style={{ fontSize: 13, color: isDark ? "rgba(255,255,255,0.85)" : "#374151", lineHeight: 1.5 }}>
            {result.eligible
              ? `You're within the 7-day window (${result.days} day${result.days !== 1 ? "s" : ""} ago). You're eligible for a full refund — contact us to process it.`
              : `It's been ${result.days} days since payment, which is past the 7-day window. A refund isn't available, but you can cancel anytime to stop future billing.`}
          </span>
        </div>
      )}
      <p style={{ fontSize: 11, color: isDark ? "rgba(255,255,255,0.4)" : "#9ca3af", marginTop: 10 }}>
        This tool is for guidance only. Final eligibility is confirmed by our team.
      </p>
    </div>
  );
}

export default function Refund() {
  useSEO({
    title:       "Refund & Cancellation Policy | Arthaleads Real Estate CRM",
    description: "Arthaleads refund and cancellation policy. 7-day money-back guarantee on new subscriptions. Cancel anytime. Learn how refunds and cancellations work.",
    canonical:   "https://www.arthaleads.com/refund",
  });

  return (
    <LegalLayout title="Refund & Cancellation Policy" badge="Billing" updated="31 May 2026">

      <Section title="1. Overview">
        <p>
          This Refund & Cancellation Policy explains how subscription payments, refunds, and cancellations
          work for Arthaleads, India's real estate lead management CRM. By subscribing to a paid plan, you
          agree to the terms below. This policy is designed to be fair, transparent, and compliant with
          Indian consumer protection norms.
        </p>
      </Section>

      <Section title="2. 7-Day Money-Back Guarantee">
        <p>
          We offer a <strong style={{ color: "var(--app-text)" }}>7-day money-back guarantee</strong> on
          your first payment for any paid plan. If you are not satisfied for any reason, request a full
          refund within 7 calendar days of the payment date and we will refund 100% of the amount paid — no
          questions asked.
        </p>
        <div style={{ marginTop: "1rem" }}>
          <RefundChecker />
        </div>
      </Section>

      <Section title="3. After the 7-Day Window">
        <p>
          Once the 7-day window has passed, payments already made are non-refundable. However, you can
          cancel your subscription at any time to stop future billing. When you cancel, your plan remains
          active until the end of the current billing period — you keep full access to all features and your
          data until then.
        </p>
      </Section>

      <Section title="4. How to Request a Refund">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Email us at <strong style={{ color: "var(--app-text)" }}>contact@arthaleads.com</strong> from your registered account email.</li>
          <li>Include your organisation name and the date of payment.</li>
          <li>Our team confirms eligibility and processes approved refunds within 5–7 business days.</li>
          <li>Refunds are credited back to the original payment method.</li>
        </ul>
      </Section>

      <Section title="5. How to Cancel Your Subscription">
        <p>
          You can cancel anytime by emailing <strong style={{ color: "var(--app-text)" }}>contact@arthaleads.com</strong>{" "}
          or messaging us on WhatsApp. There are no cancellation fees and no lock-in contracts. After
          cancellation:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Your account stays active until the end of your paid billing cycle.</li>
          <li>You can export all your leads and data (CSV / Excel) before the cycle ends.</li>
          <li>We retain your data for 30 days after cancellation in case you wish to reactivate, then it is permanently deleted.</li>
        </ul>
      </Section>

      <Section title="6. Non-Refundable Items">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Payments older than 7 days (outside the money-back window).</li>
          <li>Custom onboarding, training, or white-label setup services that have already been delivered.</li>
          <li>Add-on services explicitly marked as non-refundable at the time of purchase.</li>
        </ul>
      </Section>

      <Section title="7. Failed Payments & Downgrades">
        <p>
          If a renewal payment fails, we will notify you and retry. If payment is not completed, your plan
          may be downgraded to a limited tier — your data is never deleted for a failed payment. You can
          downgrade to a lower plan at any time; the change takes effect from the next billing cycle.
        </p>
      </Section>

      <Section title="8. Changes to This Policy">
        <p>
          We may update this policy from time to time. The "Last updated" date at the top reflects the most
          recent revision. Material changes will be communicated to active subscribers by email.
        </p>
      </Section>

      <Section title="9. Contact Us">
        <p>For any billing, refund, or cancellation request, reach us at:</p>
        <ContactBox>
          <p className="font-bold mb-1" style={{ color: "var(--app-text)" }}>Arthaleads — Billing Support</p>
          <p style={{ color: "var(--app-text-soft)" }}>
            Email:{" "}
            <a href="mailto:contact@arthaleads.com" style={{ color: "var(--app-primary)" }} className="hover:underline">
              contact@arthaleads.com
            </a>
          </p>
          <p style={{ color: "var(--app-text-soft)" }}>
            WhatsApp:{" "}
            <a href="https://wa.me/918080197945" target="_blank" rel="noopener noreferrer" style={{ color: "var(--app-primary)" }} className="hover:underline">
              +91 80801 97945
            </a>
          </p>
        </ContactBox>
      </Section>

    </LegalLayout>
  );
}
