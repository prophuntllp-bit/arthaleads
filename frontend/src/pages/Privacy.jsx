import LegalLayout, { Section, ContactBox } from "../components/LegalLayout";
import { useSEO } from "../utils/useSEO";

export default function Privacy() {
  useSEO({
    title:       "Privacy Policy | Arthaleads Real Estate CRM",
    description: "Read the Arthaleads privacy policy. Learn how we collect, use, and protect your data on India's leading real estate lead management CRM platform.",
    canonical:   "https://www.arthaleads.com/privacy",
  });

  return (
    <LegalLayout title="Privacy Policy" badge="Privacy" updated="25 June 2026">

      <Section title="1. Introduction">
        <p>
          Arthaleads ("we", "us", or "our") is a real estate customer relationship management (CRM) platform
          operated by Prophunt LLP. This Privacy Policy explains how we collect, use, store, and protect
          information when you use our platform ("the Service").
        </p>
        <p>
          Arthaleads is committed to compliance with India's <strong style={{ color: "var(--app-text)" }}>Digital Personal Data Protection (DPDP) Act, 2023</strong>.
          This policy describes our obligations as a Data Processor (and in some contexts, a Data Fiduciary)
          and your rights as a Data Principal.
        </p>
      </Section>

      <Section title="2. Roles Under the DPDP Act">
        <p>Understanding our data roles helps clarify our responsibilities:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong style={{ color: "var(--app-text)" }}>Arthaleads as Data Processor:</strong>{" "}
            When you (the organisation) use Arthaleads to store and manage your leads' personal data,
            Arthaleads acts as a Data Processor on your behalf. We process that data solely to operate the
            CRM service for you, under your instructions.
          </li>
          <li>
            <strong style={{ color: "var(--app-text)" }}>Your organisation as Data Fiduciary:</strong>{" "}
            You, as the organisation using Arthaleads, are the Data Fiduciary for the personal data of your
            leads and customers. You are responsible for obtaining appropriate consent and providing privacy
            notices to your leads.
          </li>
          <li>
            <strong style={{ color: "var(--app-text)" }}>Arthaleads as Data Fiduciary:</strong>{" "}
            Arthaleads is the Data Fiduciary for the personal data of our own customers (the organisation
            admins and users who create accounts with us).
          </li>
        </ul>
      </Section>

      <Section title="3. Information We Collect">
        <p>We collect the following types of information:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong style={{ color: "var(--app-text)" }}>Account information:</strong>{" "}
            Name, work email address, phone number, and hashed password when you create a CRM account.
          </li>
          <li>
            <strong style={{ color: "var(--app-text)" }}>Lead data:</strong>{" "}
            Names, phone numbers, email addresses, and property preferences of prospective real estate
            customers — collected via Facebook Lead Ads, Google Ads, WhatsApp enquiries, or manual entry.
            This data belongs to your organisation.
          </li>
          <li>
            <strong style={{ color: "var(--app-text)" }}>Facebook page and form data:</strong>{" "}
            When you connect your Facebook account, we access your Pages and Lead Ad Forms to retrieve lead
            submissions. We store the Page ID, Form ID, and Page Access Token to receive leads via webhook.
          </li>
          <li>
            <strong style={{ color: "var(--app-text)" }}>WhatsApp data:</strong>{" "}
            When WhatsApp Business is connected, we store message delivery metadata and conversation
            thread IDs to display message history in the CRM. We do not read or store the content of
            personal WhatsApp conversations beyond what is required to display your CRM interaction log.
          </li>
          <li>
            <strong style={{ color: "var(--app-text)" }}>Telephony data:</strong>{" "}
            When telephony (EnableX) is connected, we store call logs (caller, receiver, duration,
            timestamp) and, where enabled by your organisation, call recordings. Call recordings are
            accessible only to authorised users within your organisation.
          </li>
          <li>
            <strong style={{ color: "var(--app-text)" }}>Usage and activity data:</strong>{" "}
            Login timestamps, actions performed inside the CRM, and activity logs maintained for security,
            audit, and support purposes.
          </li>
          <li>
            <strong style={{ color: "var(--app-text)" }}>Push notification tokens:</strong>{" "}
            Device push tokens to deliver in-app notifications (follow-up reminders, lead alerts). These
            are stored per-user and deleted when you revoke notification permission.
          </li>
          <li>
            <strong style={{ color: "var(--app-text)" }}>Support access records:</strong>{" "}
            When Arthaleads support staff access your organisation's account, we record the access event,
            the stated reason, and the duration of the session. See Section 9 for full details.
          </li>
        </ul>
      </Section>

      <Section title="4. How We Use Your Information">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>To create and manage your CRM account and organisation.</li>
          <li>To receive and store leads from connected advertising platforms.</li>
          <li>To assign leads to sales agents and track pipeline status.</li>
          <li>To send follow-up reminders and activity notifications within the platform.</li>
          <li>To generate analytics and performance reports for your sales team.</li>
          <li>To power AI features (Artha AI) — see Section 7 for details.</li>
          <li>To maintain security, investigate misuse, and prevent unauthorised access.</li>
          <li>To provide customer support and resolve technical issues.</li>
          <li>To comply with our legal obligations under applicable Indian law.</li>
        </ul>
        <p>
          We do not use your lead data, usage data, or any personal data for advertising, profiling, or
          selling to third parties.
        </p>
      </Section>

      <Section title="5. Facebook and Google Data Usage">
        <p>
          Our platform integrates with the Meta (Facebook) Graph API and Google Ads to retrieve leads
          submitted through advertising forms. Specifically:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>We request access to your Facebook Pages, Lead Ad Forms, and lead submissions.</li>
          <li>We store Page Access Tokens securely to enable ongoing lead retrieval via webhooks.</li>
          <li>Lead data received from Facebook or Google (name, phone, email) is stored in your CRM account and used solely for sales follow-up purposes.</li>
          <li>We do not sell, share, or use this data for advertising or any purpose beyond operating the CRM for you.</li>
          <li>You can disconnect your Facebook or Google account at any time from the Connections page inside the CRM. Disconnecting removes your stored access tokens.</li>
        </ul>
      </Section>

      <Section title="6. WhatsApp Business Integration">
        <p>
          When you connect WhatsApp Business to Arthaleads through a supported WhatsApp Business Solution
          Provider:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>We store your WhatsApp Business Account (WABA) ID and phone number ID to route messages.</li>
          <li>Inbound and outbound message content is stored within your organisation's CRM account to display conversation history to your agents.</li>
          <li>Message delivery status and timestamps are stored for operational purposes.</li>
          <li>We do not access WhatsApp messages for any purpose other than displaying them within your CRM and, where applicable, triggering automation workflows you have configured.</li>
          <li>You remain responsible for obtaining consent from contacts before initiating WhatsApp conversations and complying with Meta's WhatsApp Business Policy.</li>
        </ul>
      </Section>

      <Section title="7. AI Features (Artha AI)">
        <p>
          Arthaleads includes AI-powered features ("Artha AI") for lead scoring, follow-up suggestions,
          and sales assistance powered by OpenAI's API. When you use AI features:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Relevant lead context (such as name, status, follow-up notes, and your query) is sent to OpenAI's API to generate a response. This data is processed under OpenAI's data processing agreement.</li>
          <li>OpenAI does not use API data to train their general models (per their API data usage policy).</li>
          <li>We track the number of AI API calls per organisation for billing and abuse-prevention purposes.</li>
          <li>You must not submit sensitive personal data (government ID numbers, financial account details, medical data) to AI features.</li>
          <li>AI-generated suggestions are advisory only. Arthaleads does not warrant the accuracy or suitability of AI responses.</li>
        </ul>
      </Section>

      <Section title="8. Data Storage and Security">
        <p>
          All data is stored on MongoDB Atlas (cloud database) hosted on AWS infrastructure in a region
          appropriate for Indian data. We use industry-standard security practices including:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Encrypted connections (HTTPS/TLS) for all data in transit.</li>
          <li>Bcrypt password hashing — plaintext passwords are never stored.</li>
          <li>JWT-based authentication with httpOnly secure cookies to prevent XSS token theft.</li>
          <li>Role-based access control — agents can only access leads within their organisation.</li>
          <li>CSRF protection on all authenticated API endpoints.</li>
          <li>Images and documents uploaded to the platform are stored on Cloudinary (a third-party CDN) using secure, access-controlled URLs.</li>
        </ul>
      </Section>

      <Section title="9. Platform Support Access">
        <p>
          To provide technical support and resolve issues, authorised Arthaleads platform administrators
          may access your organisation's CRM account. We operate a strict support access policy to protect
          your privacy:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong style={{ color: "var(--app-text)" }}>Reason logged:</strong> A stated reason is mandatory before any support session begins (e.g. Bug Investigation, Onboarding, Customer Support).</li>
          <li><strong style={{ color: "var(--app-text)" }}>Audit trail:</strong> Every support access event is recorded — who accessed, when, why, and for how long — in a tamper-resistant audit log.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Notification:</strong> Your organisation's administrator receives a push notification when a support request is made or a session is active.</li>
          <li><strong style={{ color: "var(--app-text)" }}>In-app banner:</strong> A visible "Support session active" banner is displayed at the bottom of the CRM screen for the entire duration of any active support session, so any logged-in user can see it in real time.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Approval option:</strong> Your administrator can be asked to approve access before the session begins, and can revoke access at any time by clicking "End Session".</li>
          <li><strong style={{ color: "var(--app-text)" }}>Access log:</strong> A complete history of all support access is available to your organisation administrator at Settings → Security at any time.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Purpose limitation:</strong> Support access is used exclusively to diagnose technical issues or provide assistance. Support staff never copy, export, or share your data for any other purpose.</li>
        </ul>
      </Section>

      <Section title="10. Data Sharing">
        <p>
          We do not sell, rent, or share your personal data or your lead data with any third parties for
          commercial purposes. We share data only with the following categories of sub-processors, strictly
          as necessary to operate the platform:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong style={{ color: "var(--app-text)" }}>MongoDB Atlas (AWS):</strong> Database hosting.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Cloudinary:</strong> Image and file hosting (org logos, blog images, attendance selfies).</li>
          <li><strong style={{ color: "var(--app-text)" }}>OpenAI:</strong> AI feature processing (Artha AI), under their API data processing agreement.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Resend / email provider:</strong> Transactional emails (support replies, notifications).</li>
          <li><strong style={{ color: "var(--app-text)" }}>EnableX:</strong> Telephony services (calls, recordings) when connected by your organisation.</li>
          <li><strong style={{ color: "var(--app-text)" }}>WhatsApp BSP:</strong> WhatsApp Business message routing when connected by your organisation.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Firebase (Google):</strong> Push notification delivery for Android app users.</li>
        </ul>
        <p>All sub-processors are required to handle data in accordance with applicable data protection law.</p>
      </Section>

      <Section title="11. Data Retention">
        <p>
          We retain your account data and lead data for as long as your account is active or as necessary
          to provide the Service. Specifically:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong style={{ color: "var(--app-text)" }}>Lead data:</strong> Retained until you delete it or close your account.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Call recordings:</strong> Retained for up to 90 days by default, or as configured by your organisation administrator.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Audit logs and support access records:</strong> Retained for up to 12 months for security and compliance purposes.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Account data:</strong> Deleted within 30 days of account closure upon written request.</li>
        </ul>
        <p>
          You may request deletion of your data at any time by contacting us at{" "}
          <a href="mailto:contact@arthaleads.com" style={{ color: "var(--app-primary)" }} className="hover:underline">contact@arthaleads.com</a>.
        </p>
      </Section>

      <Section title="12. Your Rights (Data Principals)">
        <p>
          Under the DPDP Act, 2023, and other applicable laws, you have the right to:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong style={{ color: "var(--app-text)" }}>Access:</strong> Request a summary of the personal data we hold about you.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Correction:</strong> Request correction of inaccurate or incomplete personal data.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Erasure:</strong> Request deletion of your personal data, subject to our legal obligations.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Grievance redressal:</strong> Lodge a complaint with our Grievance Officer (see Section 15).</li>
          <li><strong style={{ color: "var(--app-text)" }}>Data portability:</strong> Request a copy of your lead data in CSV format (available from inside the CRM for organisation admins).</li>
          <li><strong style={{ color: "var(--app-text)" }}>Withdraw consent:</strong> Disconnect integrations (Facebook, WhatsApp, Google) at any time from the Connections page.</li>
        </ul>
        <p>
          To exercise any of these rights, contact us at{" "}
          <a href="mailto:contact@arthaleads.com" style={{ color: "var(--app-primary)" }} className="hover:underline">contact@arthaleads.com</a>.
          We will respond within 30 days.
        </p>
      </Section>

      <Section title="13. Children's Privacy">
        <p>
          Arthaleads is a business tool intended for use by adults (18 years and above). We do not
          knowingly collect personal information from anyone under 18 years of age.
        </p>
      </Section>

      <Section title="14. Cookies">
        <p>
          We use cookies and similar technologies as described in our{" "}
          <a href="/cookie-policy" style={{ color: "var(--app-primary)" }} className="hover:underline">Cookie Policy</a>.
          You can manage your cookie preferences at any time on that page.
        </p>
      </Section>

      <Section title="15. Grievance Officer">
        <p>
          In accordance with the DPDP Act, 2023 and IT Act, 2000, we have designated a Grievance Officer
          to address data-related complaints. If you have any concerns about how your data is handled,
          you may contact our Grievance Officer:
        </p>
        <ContactBox>
          <p className="font-bold mb-1" style={{ color: "var(--app-text)" }}>Grievance Officer — Arthaleads (Prophunt LLP)</p>
          <p style={{ color: "var(--app-text-soft)" }}>
            Email:{" "}
            <a href="mailto:contact@arthaleads.com" style={{ color: "var(--app-primary)" }} className="hover:underline">
              contact@arthaleads.com
            </a>
          </p>
          <p style={{ color: "var(--app-text-soft)" }}>Response time: within 30 days of receipt.</p>
        </ContactBox>
      </Section>

      <Section title="16. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time to reflect changes in our practices, features,
          or legal requirements. When we do, we will update the "Last updated" date at the top of this page.
          For material changes, we will notify active users through an in-app notification. Continued use
          of the platform after changes constitutes acceptance of the updated policy.
        </p>
      </Section>

      <Section title="17. Contact Us">
        <p>
          If you have any questions, requests, or concerns regarding this Privacy Policy or your data,
          please contact:
        </p>
        <ContactBox>
          <p className="font-bold mb-1" style={{ color: "var(--app-text)" }}>Arthaleads (Prophunt LLP)</p>
          <p style={{ color: "var(--app-text-soft)" }}>
            Email:{" "}
            <a href="mailto:contact@arthaleads.com" style={{ color: "var(--app-primary)" }} className="hover:underline">
              contact@arthaleads.com
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
