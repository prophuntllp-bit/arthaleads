import { useEffect } from "react";
import LegalLayout, { Section, ContactBox } from "../components/LegalLayout";

export default function Terms() {
  useEffect(() => {
    document.title = "Terms of Service - Arthaleads";
    // Tell search engines not to index this page
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) { meta = document.createElement("meta"); meta.name = "robots"; document.head.appendChild(meta); }
    meta.content = "noindex, nofollow";
    return () => { meta.content = "index, follow"; };
  }, []);

  return (
    <LegalLayout title="Terms of Service" badge="Legal" updated="11 April 2026">

      <Section title="1. Acceptance of Terms">
        <p>
          By accessing or using Arthaleads CRM ("the Service"), you agree to be bound by these Terms of
          Service. If you do not agree to these terms, you must not use the Service. These terms apply to
          all users of the platform, including administrators, managers, and agents. Arthaleads is operated
          by Arthaleads.
        </p>
      </Section>

      <Section title="2. Use of Service">
        <p>
          Arthaleads is a real estate customer relationship management (CRM) platform designed to help
          organisations manage leads, track sales pipelines, and coordinate sales team activity. You agree
          to use the Service only for lawful purposes and in a manner consistent with all applicable local,
          state, national, and international laws and regulations. You must not:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Use the Service for any unlawful, fraudulent, or harmful purpose.</li>
          <li>Misrepresent your identity or affiliation when using the platform.</li>
          <li>Interfere with or disrupt the integrity or performance of the Service.</li>
          <li>Attempt to gain unauthorised access to any part of the platform or its infrastructure.</li>
        </ul>
      </Section>

      <Section title="3. User Accounts">
        <p>To use Arthaleads, you must create an account with valid credentials. You are responsible for:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Maintaining the confidentiality of your account credentials (email and password).</li>
          <li>All activity that occurs under your account, whether or not authorised by you.</li>
          <li>Notifying Arthaleads immediately if you suspect any unauthorised use of your account.</li>
          <li>Ensuring that your account information remains accurate and up to date.</li>
        </ul>
        <p>
          Arthaleads is not liable for any loss or damage arising from your failure to keep your credentials
          secure. Admin accounts carry elevated privileges - these must not be shared with unauthorised team
          members.
        </p>
      </Section>

      <Section title="4. Data & Privacy">
        <p>
          By using Arthaleads, you acknowledge that we collect and process certain data, including account
          information and lead data, as described in our{" "}
          <a href="/privacy" style={{ color: "var(--app-primary)" }} className="hover:underline">Privacy Policy</a>.
          {" "}This includes data imported from or connected to advertising platforms such as Meta (Facebook)
          and Google. Your continued use of the Service constitutes acceptance of our data practices as
          outlined in the Privacy Policy.
        </p>
      </Section>

      <Section title="5. Lead Data Ownership">
        <p>
          All lead data that you import into, create within, or generate through Arthaleads belongs to your
          organisation. Arthaleads does not claim ownership over your lead data. We act as a data processor
          on your behalf - storing and presenting your lead data solely to provide the CRM service to you.
          You are responsible for ensuring that you have the necessary rights and consents to store and
          process the lead data you upload to the platform.
        </p>
      </Section>

      <Section title="6. Prohibited Use">
        <p>You must not engage in any of the following activities when using Arthaleads:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong style={{ color: "var(--app-text)" }}>Scraping:</strong> Automated extraction of data from the platform using bots, crawlers, or similar tools.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Reverse engineering:</strong> Attempting to decompile, disassemble, or otherwise derive the source code or underlying logic of the platform.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Unauthorised access:</strong> Accessing accounts, systems, or data belonging to other users or organisations without permission.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Spam:</strong> Using lead data or platform features to send unsolicited bulk communications.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Malicious activity:</strong> Uploading malware, viruses, or any code intended to damage or disrupt the Service or its users.</li>
          <li><strong style={{ color: "var(--app-text)" }}>Reselling:</strong> Sublicensing, reselling, or commercially exploiting the Service without Arthaleads' prior written consent.</li>
        </ul>
        <p>Violations of this section may result in immediate account suspension or termination.</p>
      </Section>

      <Section title="7. Service Availability">
        <p>
          Arthaleads aims to maintain 99.9% uptime for the platform. However, we do not guarantee
          uninterrupted or error-free access to the Service. The platform may be temporarily unavailable
          due to scheduled maintenance, infrastructure issues, or events beyond our control. Arthaleads
          will make reasonable efforts to notify users of planned downtime in advance. We are not liable
          for any losses or inconvenience caused by service interruptions.
        </p>
      </Section>

      <Section title="8. Termination">
        <p>
          Arthaleads reserves the right to suspend or terminate your account at any time, with or without
          notice, if we determine that you have violated these Terms of Service or engaged in conduct that
          is harmful to the platform, other users, or third parties. You may also terminate your account
          at any time by contacting us. Upon termination, your access to the platform will be revoked and
          your data will be handled in accordance with our Privacy Policy.
        </p>
      </Section>

      <Section title="9. Limitation of Liability">
        <p>
          To the fullest extent permitted by applicable law, Arthaleads shall not be liable
          for any indirect, incidental, special, consequential, or punitive damages - including but not
          limited to loss of revenue, loss of data, loss of business opportunities, or reputational harm -
          arising from your use of or inability to use the Service, even if Arthaleads has been advised of
          the possibility of such damages. Our total liability to you for any claim arising out of or
          relating to these terms or the Service shall not exceed the amount paid by you to Arthaleads in
          the three months preceding the event giving rise to the claim.
        </p>
      </Section>

      <Section title="10. Contact">
        <p>
          If you have any questions about these Terms of Service or wish to report a violation, please
          contact us:
        </p>
        <ContactBox>
          <p className="font-bold mb-1" style={{ color: "var(--app-text)" }}>Arthaleads</p>
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
