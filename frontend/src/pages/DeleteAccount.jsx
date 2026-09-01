import { useState } from "react";
import LegalLayout, { Section } from "../components/LegalLayout";
import { useSEO } from "../utils/useSEO";
import { Spinner } from "../components/UI";
import api from "../services/api";

// The public deletion page.
//
// Google Play's User Data policy asks for account deletion to be reachable from
// outside the app as well as inside it, and the in-app route needs a session.
// This page is for the people that leaves out: someone who left the company,
// or who has lost access to the address they signed up with.
//
// It leads with the self-service route, because that one is instant and this
// one is not, and anybody who can still sign in should use it.
export default function DeleteAccount() {
  useSEO({
    title: "Delete Your Account | Arthaleads",
    description: "How to delete your Arthaleads account and the data attached to it, from inside the app or by request.",
    canonical: "https://www.arthaleads.com/delete-account",
  });

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.post("/auth/account/deletion-request", { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || "Could not send the request. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <LegalLayout title="Delete Your Account" badge="Your data" updated="1 September 2026">

      <Section title="If you can still sign in">
        <p>
          This is the fastest route and it needs nothing from us. In the Arthaleads app, open{" "}
          <strong style={{ color: "var(--app-text)" }}>Settings › My Profile › Delete my account</strong>.
        </p>
        <p>What happens next depends on your role:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong style={{ color: "var(--app-text)" }}>If your organisation has another admin</strong>, your
            account and personal data are deleted immediately. Your organisation's leads, projects and bookings
            stay with your colleagues, and your name is removed from them.
          </li>
          <li>
            <strong style={{ color: "var(--app-text)" }}>If you are the only admin</strong>, deleting your
            account closes the whole workspace. That is scheduled 30 days ahead so it can be undone: signing in
            during those 30 days cancels it. After that the organisation and every record in it are deleted
            permanently.
          </li>
        </ul>
      </Section>

      <Section title="What gets deleted">
        <p>
          Your name, email address, phone number, password, profile photo, attendance records including any
          check-in photos and locations, notification tokens, and support tickets. Your name is also removed
          from anything you touched that your organisation keeps &mdash; leads, notes, activity entries and
          tasks are unlinked and show as &ldquo;Deleted user&rdquo;.
        </p>
        <p>
          We keep a security audit trail of significant account actions, with you unlinked from it and your IP
          address removed. It records that something happened, not who you are. When a whole organisation is
          deleted, its audit trail goes with it.
        </p>
        <p>
          Deletion is permanent. There is no recovery once it has run, and this is not a deactivation.
        </p>
      </Section>

      <Section title="If you cannot sign in">
        <p>
          Enter the address you signed up with and we will confirm the request by email, then action it within
          30 days.
        </p>

        {sent ? (
          <div className="rounded-2xl border px-4 py-4 text-sm"
            style={{ borderColor: "rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.08)", color: "var(--app-text)" }}>
            If that address has an Arthaleads account, we&rsquo;ve emailed you to confirm the request. Check
            your spam folder if it hasn&rsquo;t arrived in a few minutes.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label" htmlFor="deletion-email">Email address</label>
              <input id="deletion-email" className="input" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>

            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={busy}>
              {busy ? <><Spinner size="sm" /> Sending…</> : "Request deletion"}
            </button>
          </form>
        )}

        <p className="text-sm" style={{ color: "var(--app-text-soft)" }}>
          Prefer to email us? Write to{" "}
          <a href="mailto:contact@arthaleads.com" style={{ color: "var(--app-primary)" }}>contact@arthaleads.com</a>{" "}
          from the address on the account.
        </p>
      </Section>

      <Section title="A note for team members">
        <p>
          If your organisation's admin added you to their workspace, the leads and projects you worked on
          belong to that organisation, not to you. Deleting your account removes you and your personal data;
          it does not delete your employer's records. To have those removed, the organisation's admin needs to
          delete the workspace.
        </p>
      </Section>

    </LegalLayout>
  );
}
