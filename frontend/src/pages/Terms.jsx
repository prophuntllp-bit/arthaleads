import LegalLayout, { Section, ContactBox } from "../components/LegalLayout";
import { useSEO } from "../utils/useSEO";

export default function Terms() {
  useSEO({
    title:       "Terms of Service | Arthaleads Real Estate CRM",
    description: "Read the Arthaleads terms of service. Understand the usage terms for India's leading real estate CRM and lead management platform.",
    canonical:   "https://www.arthaleads.com/terms",
  });

  return (
    <LegalLayout title="Terms of Service" badge="Legal" updated="25 June 2026">

      <Section title="1. Acceptance of Terms">
        <p>
          By accessing or using Arthaleads CRM ("the Service"), you agree to be bound by these Terms of
          Service ("Terms"). If you do not agree to these Terms, you must not use the Service. These Terms
          apply to all users — including organisation administrators, managers, and agents. Arthaleads is
          operated by Prophunt LLP ("Arthaleads", "we", "us", or "our").
        </p>
        <p>
          We may update these Terms from time to time. Continued use of the Service after any change
          constitutes your acceptance of the updated Terms. We will update the "Last updated" date above
          whenever changes are made.
        </p>
      </Section>

      <Section title="2. Description of Service">
        <p>
          Arthaleads is a real estate customer relationship management (CRM) platform that helps organisations
          manage leads, track sales pipelines, coordinate sales team activity, and automate follow-ups. The
          platform includes features such as lead management, follow-up scheduling, project tracking, WhatsApp
          Business messaging, telephony integration, booking management, and AI-powered assistance (Artha AI).
        </p>
      </Section>

      <Section title="3. Accounts and Access">
        <p>To use Arthaleads, you must create an account with valid credentials. You are responsible for:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Maintaining the confidentiality of your account credentials (email and password).</li>
          <li>All activity that occurs under your account, whether or not authorised by you.</li>
          <li>Notifying Arthaleads immediately if you suspect any unauthorised use of your account.</li>
          <li>Ensuring that your account information remains accurate and up to date.</li>
          <li>Ensuring that admin credentials are not shared with unauthorised team members, as admin accounts carry elevated privileges over your organisation's data.</li>
        </ul>
        <p>
          Arthaleads is not liable for any loss or damage arising from your failure to keep your credentials
          secure.
        </p>
      </Section>

      <Section title="4. Acceptable Use">
        <p>
          You agree to use the Service only for lawful purposes and in a manner consistent with all applicable
          local, state, national, and international laws and regulations, including India's Digital Personal
          Data Protection (DPDP) Act, 2023. You must not:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Use the Service for any unlawful, fraudulent, or harmful purpose.</li>
          <li>Misrepresent your identity or affiliation when using the platform.</li>
          <li>Interfere with or disrupt the integrity or performance of the Service.</li>
          <li>Attempt to gain unauthorised access to any part of the platform or its infrastructure.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Scraping:</strong> Automated extraction of data using bots, crawlers, or similar tools.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Reverse engineering:</strong> Attempting to decompile, disassemble, or otherwise derive the source code or underlying logic of the platform.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Spam:</strong> Using lead data or platform features to send unsolicited bulk communications in violation of applicable telecommunications or data protection laws.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Malicious activity:</strong> Uploading malware, viruses, or any code intended to damage or disrupt the Service or its users.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Reselling:</strong> Sublicensing, reselling, or commercially exploiting the Service without Arthaleads' prior written consent.</li>
        </ul>
        <p>Violations of this section may result in immediate account suspension or termination.</p>
      </Section>

      <Section title="5. Lead Data and Data Ownership">
        <p>
          All lead data that you import into, create within, or generate through Arthaleads belongs to your
          organisation. Arthaleads does not claim ownership over your lead data. We act as a <strong style={{ color: "var(--app-text)" }}>Data Processor</strong> on
          your behalf — storing and presenting your lead data solely to provide the CRM service to you.
        </p>
        <p>
          You, as the organisation using Arthaleads, are the <strong style={{ color: "var(--app-text)" }}>Data Fiduciary</strong> for the personal
          data of your leads and customers under India's DPDP Act, 2023. You are responsible for:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Ensuring you have the necessary rights, consents, and legal basis to store and process the personal data you upload to the platform.</li>
          <li>Providing an appropriate privacy notice to your leads explaining how their data will be used.</li>
          <li>Responding to data principal requests (access, correction, erasure) directed to your organisation.</li>
          <li>Ensuring that WhatsApp messages, calls, and automated communications sent through Arthaleads comply with applicable telecom and data protection regulations.</li>
        </ul>
      </Section>

      <Section title="6. AI Features (Artha AI)">
        <p>
          Arthaleads includes AI-powered features ("Artha AI") that help with lead scoring, follow-up
          suggestions, and sales assistance. When you use these features:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Relevant lead and context data is sent to our AI provider (OpenAI) to generate responses. This data is processed under OpenAI's data processing agreement and is not used to train their general models.</li>
          <li>You must not submit sensitive personal data (e.g. financial account details, government ID numbers, health information) to AI features.</li>
          <li>AI-generated content is advisory only. Arthaleads makes no warranty regarding the accuracy, completeness, or suitability of AI suggestions. You remain solely responsible for all decisions made using the platform.</li>
          <li>AI usage is tracked per organisation for billing and abuse-prevention purposes.</li>
        </ul>
      </Section>

      <Section title="7. WhatsApp and Telephony Integrations">
        <p>
          When you connect WhatsApp Business or telephony (call) integrations through Arthaleads:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>You are responsible for ensuring all WhatsApp communications comply with Meta's WhatsApp Business Policy and India's Telecom Commercial Communications Customer Preference Regulations (TCCCPR).</li>
          <li>You must obtain appropriate consent from recipients before sending WhatsApp messages or initiating calls.</li>
          <li>Call recordings (where enabled) are stored within your organisation's account for your agents' reference. You are responsible for informing call participants that they are being recorded, as required by applicable law.</li>
          <li>Arthaleads is not responsible for messages or calls made through the platform that violate applicable law or platform policies.</li>
        </ul>
      </Section>

      <Section title="8. Platform Support Access">
        <p>
          In order to provide technical support, debug issues, or assist with onboarding, authorised
          Arthaleads platform administrators may access your organisation's CRM account ("Support Access").
          The following conditions apply to all Support Access:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong style={{ color: "var(--app-text)" }}>Reason required:</strong> A stated reason (e.g. Customer Support, Bug Investigation, Onboarding) is mandatory before any support session begins.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Audit logging:</strong> All support access is recorded in a tamper-resistant audit trail, including who accessed the account, when, and for what stated reason.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Organisation notification:</strong> Your organisation's administrator will receive a push notification when a support access request is made or when a session is active. A visible banner is displayed inside the CRM for the duration of any active support session.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Approval option:</strong> Your administrator may be asked to approve support access before it begins. You can also end any active support session at any time from Settings → Security.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Access log:</strong> A complete history of all support access is available to your organisation administrator in Settings → Security.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Purpose limitation:</strong> Support access is used exclusively to diagnose technical issues, provide onboarding assistance, or perform authorised data operations. Your data is never read, copied, shared, or monetised for any other purpose.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Session duration:</strong> Support sessions are time-limited (maximum 2 hours per session) and are automatically terminated when the platform administrator logs out.</li>
        </ul>
        <p>
          By agreeing to these Terms, you acknowledge and consent to this support access mechanism as
          described above.
        </p>
      </Section>

      <Section title="9. Data & Privacy">
        <p>
          By using Arthaleads, you acknowledge that we collect and process certain data as described in our{" "}
          <a href="/privacy" style={{ color: "var(--app-primary)" }} className="hover:underline">Privacy Policy</a>.
          {" "}This includes account data, lead data, and integration data from connected platforms (Meta, Google,
          WhatsApp, telephony providers). Your continued use of the Service constitutes acceptance of our data
          practices as outlined in the Privacy Policy.
        </p>
        <p>
          Arthaleads is committed to compliance with the <strong style={{ color: "var(--app-text)" }}>Digital Personal Data Protection (DPDP) Act, 2023</strong> and
          other applicable Indian data protection laws.
        </p>
      </Section>

      <Section title="10. Service Availability">
        <p>
          Arthaleads aims to maintain high availability for the platform. However, we do not guarantee
          uninterrupted or error-free access to the Service. The platform may be temporarily unavailable
          due to scheduled maintenance, infrastructure issues, or events beyond our control. Arthaleads
          will make reasonable efforts to notify users of planned downtime in advance. We are not liable
          for any losses or inconvenience caused by service interruptions.
        </p>
      </Section>

      <Section title="11. Billing, Subscriptions & Refunds">
        <p>
          Paid plans are billed in advance for the chosen billing period. You can cancel at any time, with
          no lock-in; your plan stays active until the end of the current billing cycle. We offer a 7-day
          money-back guarantee on your first payment. Full details on refunds and cancellations are in our{" "}
          <a href="/refund" style={{ color: "var(--app-primary)" }} className="hover:underline">Refund &amp; Cancellation Policy</a>.
          {" "}Our use of cookies is described in our{" "}
          <a href="/cookie-policy" style={{ color: "var(--app-primary)" }} className="hover:underline">Cookie Policy</a>.
        </p>
      </Section>

      <Section title="12. Intellectual Property">
        <p>
          All intellectual property in the Arthaleads platform — including software, design, trademarks,
          and documentation — belongs to Prophunt LLP. You are granted a limited, non-exclusive,
          non-transferable licence to use the Service for your internal business purposes only. Nothing in
          these Terms transfers any intellectual property rights to you.
        </p>
      </Section>

      <Section title="13. Termination">
        <p>
          Arthaleads reserves the right to suspend or terminate your account at any time, with or without
          notice, if we determine that you have violated these Terms or engaged in conduct harmful to the
          platform, other users, or third parties. You may also terminate your account at any time by
          contacting us. Upon termination, your access to the platform will be revoked and your data will
          be handled in accordance with our{" "}
          <a href="/privacy" style={{ color: "var(--app-primary)" }} className="hover:underline">Privacy Policy</a>.
        </p>
      </Section>

      <Section title="14. Limitation of Liability">
        <p>
          To the fullest extent permitted by applicable law, Arthaleads (Prophunt LLP) shall not be liable
          for any indirect, incidental, special, consequential, or punitive damages — including but not
          limited to loss of revenue, loss of data, loss of business opportunities, or reputational harm —
          arising from your use of or inability to use the Service, even if Arthaleads has been advised of
          the possibility of such damages. Our total liability to you for any claim arising out of or
          relating to these Terms or the Service shall not exceed the amount paid by you to Arthaleads in
          the three months preceding the event giving rise to the claim.
        </p>
      </Section>

      <Section title="15. Governing Law">
        <p>
          These Terms are governed by and construed in accordance with the laws of India. Any disputes
          arising under or in connection with these Terms shall be subject to the exclusive jurisdiction of
          the courts of India.
        </p>
      </Section>

      <Section title="16. Contact">
        <p>
          If you have any questions about these Terms of Service or wish to report a violation, please
          contact us:
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
