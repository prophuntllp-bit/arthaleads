import { useEffect } from "react";
import LegalLayout, { Section, ContactBox } from "../components/LegalLayout";

export default function Privacy() {
  useEffect(() => { document.title = "Privacy Policy — Arthaleads"; }, []);

  return (
    <LegalLayout title="Privacy Policy" badge="Privacy" updated="3 April 2026">

      <Section title="1. Introduction">
        <p>
          Arthaleads ("we", "us", or "our") is a real estate customer relationship management (CRM) platform
          operated by Arthaleads (Prophunt LLP). This Privacy Policy explains how we collect, use, store,
          and protect information when you use our platform, including when our application connects to Meta
          (Facebook) services to retrieve lead data.
        </p>
      </Section>

      <Section title="2. Information We Collect">
        <p>We collect the following types of information:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong style={{ color: "var(--app-text)" }}>Account information:</strong>{" "}
            Name, work email address, phone number, and password when you create a CRM account.
          </li>
          <li>
            <strong style={{ color: "var(--app-text)" }}>Lead data:</strong>{" "}
            Names, phone numbers, email addresses, and property preferences of prospective real estate
            customers — collected via Facebook Lead Ads, Google Ads landing pages, WhatsApp enquiries,
            or manual entry.
          </li>
          <li>
            <strong style={{ color: "var(--app-text)" }}>Facebook page and form data:</strong>{" "}
            When you connect your Facebook account, we access your Facebook Pages and Lead Ad Forms to
            retrieve lead submissions. We store the Page ID, Form ID, and Page Access Token required
            to receive leads.
          </li>
          <li>
            <strong style={{ color: "var(--app-text)" }}>Usage data:</strong>{" "}
            Login timestamps, actions performed inside the CRM, and activity logs for audit purposes.
          </li>
        </ul>
      </Section>

      <Section title="3. How We Use Your Information">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>To create and manage your CRM account.</li>
          <li>To receive and store leads from connected advertising platforms (Facebook, Google, WhatsApp).</li>
          <li>To assign leads to sales agents and track pipeline status.</li>
          <li>To send follow-up reminders and activity notifications within the platform.</li>
          <li>To generate analytics and performance reports for your sales team.</li>
          <li>To maintain security and prevent unauthorised access.</li>
        </ul>
      </Section>

      <Section title="4. Facebook Data Usage">
        <p>
          Our platform integrates with the Meta (Facebook) Graph API to retrieve leads submitted through
          Facebook Lead Ads. Specifically:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>We request access to your Facebook Pages, Lead Ad Forms, and lead submissions.</li>
          <li>We store Page Access Tokens securely on our servers to enable ongoing lead retrieval via webhooks.</li>
          <li>Lead data received from Facebook (name, phone, email) is stored in your CRM account and used solely for sales follow-up purposes.</li>
          <li>We do not sell, share, or use Facebook lead data for advertising or any purpose beyond operating the CRM for you.</li>
          <li>You can disconnect your Facebook account at any time from the Connections page inside the CRM. Disconnecting removes your stored access token.</li>
        </ul>
      </Section>

      <Section title="5. Data Storage and Security">
        <p>
          All data is stored on MongoDB Atlas (cloud database) hosted on AWS infrastructure. We use
          industry-standard security practices including encrypted connections (HTTPS/TLS), hashed passwords
          (bcrypt), JWT-based authentication, and role-based access control. Only authorised team members
          can access your organisation's data.
        </p>
      </Section>

      <Section title="6. Data Sharing">
        <p>
          We do not sell, rent, or share your personal data or your lead data with any third parties,
          except as necessary to operate the platform (e.g. database hosting providers). We do not use
          lead data for any purpose other than providing the CRM service to you.
        </p>
      </Section>

      <Section title="7. Data Retention">
        <p>
          We retain your account data and lead data for as long as your account is active. You may request
          deletion of your data at any time by contacting us. Lead data imported from Facebook is retained
          only within your CRM account and is deleted when you delete it or close your account.
        </p>
      </Section>

      <Section title="8. Your Rights">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Access the personal data we hold about you.</li>
          <li>Request correction or deletion of your data.</li>
          <li>Disconnect your Facebook account from the CRM at any time.</li>
          <li>Request a copy of your lead data in CSV or Excel format (available inside the CRM).</li>
        </ul>
      </Section>

      <Section title="9. Children's Privacy">
        <p>
          Arthaleads is a business tool intended for use by adults. We do not knowingly collect personal
          information from anyone under 18 years of age.
        </p>
      </Section>

      <Section title="10. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. When we do, we will update the "Last updated"
          date at the top of this page. Continued use of the platform after changes constitutes acceptance
          of the updated policy.
        </p>
      </Section>

      <Section title="11. Contact Us">
        <p>
          If you have any questions or requests regarding this Privacy Policy or your data, please contact:
        </p>
        <ContactBox>
          <p className="font-bold mb-1" style={{ color: "var(--app-text)" }}>Arthaleads (Prophunt LLP)</p>
          <p style={{ color: "var(--app-text-soft)" }}>
            Email:{" "}
            <a href="mailto:hello@arthaleads.com" style={{ color: "var(--app-primary)" }} className="hover:underline">
              hello@arthaleads.com
            </a>
          </p>
          <p style={{ color: "var(--app-text-soft)" }}>
            Platform:{" "}
            <a href="https://arthaleads.com" style={{ color: "var(--app-primary)" }} className="hover:underline">
              https://arthaleads.com
            </a>
          </p>
        </ContactBox>
      </Section>

    </LegalLayout>
  );
}
