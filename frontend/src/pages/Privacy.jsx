import LegalLayout, { Section, ContactBox } from "../components/LegalLayout";
import { useSEO } from "../utils/useSEO";

const strong = { color: "var(--app-text)" };
const link = { color: "var(--brand-text)" };

export default function Privacy() {
  useSEO({
    title:       "Privacy Policy | Arthaleads Real Estate CRM",
    description: "Read the Arthaleads privacy policy. Learn how we collect, use, and protect your data on India's leading real estate lead management CRM platform.",
    canonical:   "https://www.arthaleads.com/privacy",
  });

  return (
    <LegalLayout title="Privacy Policy" badge="Privacy" updated="28 October 2026">

      <Section title="1. Introduction">
        <p>
          Arthaleads ("we", "us", or "our") is a real estate customer relationship management (CRM) platform
          made and operated by <strong style={strong}>Prophunt LLP</strong>, a limited liability partnership
          registered in India (GSTIN 27ABAFP3487B1ZC) with its principal place of business in Pune.
          Arthaleads was founded in 2025. This Privacy Policy explains how we collect, use, store, share and protect personal data when you use
          the Arthaleads web app, mobile app and website ("the Service").
        </p>
        <p>
          We follow India's <strong style={strong}>Digital Personal Data Protection Act, 2023</strong> (the
          "DPDP Act") and the <strong style={strong}>Digital Personal Data Protection Rules, 2025</strong> (the
          "DPDP Rules"). This policy explains when we act as a Data Fiduciary and when we act as a Data
          Processor, and what rights you have as a Data Principal.
        </p>
      </Section>

      <Section title="2. Who Is Responsible for Your Data">
        <p>Who decides what happens to personal data depends on whose data it is:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong style={strong}>Leads and customers of an organisation using Arthaleads:</strong>{" "}
            the organisation (our customer) is the <strong style={strong}>Data Fiduciary</strong>. It decides
            why and how its leads' data is collected and used. Prophunt LLP is its{" "}
            <strong style={strong}>Data Processor</strong>: we process that data only to run the CRM for the
            organisation and only on its instructions. The organisation is responsible for giving its leads a
            privacy notice and for having a lawful basis, such as consent, for the data it uploads or captures.
          </li>
          <li>
            <strong style={strong}>Arthaleads users and website visitors:</strong>{" "}
            for the people who sign up for or use Arthaleads (organisation admins, managers and agents), and
            for visitors who use our website or fill in our forms, Prophunt LLP is the{" "}
            <strong style={strong}>Data Fiduciary</strong>.
          </li>
        </ul>
        <p>
          If you are a lead or customer of a business that uses Arthaleads, please send requests about your
          data to that business first. We will help it respond (see Section 13).
        </p>
      </Section>

      <Section title="3. Information We Collect">
        <p>We collect the following types of information:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong style={strong}>Account information:</strong>{" "}
            Name, work email address, phone number, and a hashed password when you create an account, or your
            Google account name and email if you sign in with Google.
          </li>
          <li>
            <strong style={strong}>Lead data:</strong>{" "}
            Names, phone numbers, email addresses, property preferences and notes about prospective real estate
            customers, collected through Facebook Lead Ads, Google Ads, WhatsApp enquiries, property portals the
            organisation connects (such as 99acres, Housing.com or MagicBricks), file imports, or manual entry.
            This data belongs to the organisation that collected it.
          </li>
          <li>
            <strong style={strong}>Facebook page and form data:</strong>{" "}
            When you connect your Facebook account, we access your Pages and Lead Ad Forms to retrieve lead
            submissions. We store the Page ID, Form ID, and Page Access Token (encrypted at rest) to receive
            leads via webhook.
          </li>
          <li>
            <strong style={strong}>WhatsApp Business Platform data:</strong>{" "}
            Arthaleads is a Meta Tech Provider for the WhatsApp Business Platform. When you connect WhatsApp,
            whether through Arthaleads' own Meta-hosted onboarding ("Embedded Signup") or by entering your own
            credentials, we store your WhatsApp Business Account (WABA) ID, phone number ID, business profile
            fields (verified business name, display phone number, quality rating), the access token issued for
            your account, and the number's registration PIN (encrypted at rest). We also store message
            content, voice notes, delivery metadata and conversation thread IDs to show your conversation
            history in the CRM. See Section 6 for full details.
          </li>
          <li>
            <strong style={strong}>Telephony data:</strong>{" "}
            When calling (through EnableX or Plivo) is connected, we store call logs (caller, receiver,
            duration, time) and, where enabled by your organisation, call recordings, transcripts and AI call
            summaries. Call recordings are available only to authorised users within your organisation.
          </li>
          <li>
            <strong style={strong}>Attendance data:</strong>{" "}
            Where your organisation uses attendance, the check-in and check-out times, location and photo an
            employee submits.
          </li>
          <li>
            <strong style={strong}>Usage and activity data:</strong>{" "}
            Login times, actions performed inside the CRM, and activity logs kept for security, audit, and
            support purposes.
          </li>
          <li>
            <strong style={strong}>Push notification tokens:</strong>{" "}
            Device push tokens used to deliver notifications (follow-up reminders, lead alerts). These are
            stored per user and deleted when you log out or revoke notification permission.
          </li>
          <li>
            <strong style={strong}>Support access records:</strong>{" "}
            When Arthaleads support staff access your organisation's account, we record the access event,
            the stated reason, and the length of the session. See Section 9 for full details.
          </li>
          <li>
            <strong style={strong}>Website enquiries and visits:</strong>{" "}
            The name, phone number, email and message you send through our contact, demo booking or careers
            forms. If you allow analytics cookies, Google Analytics records how the website is used (see our{" "}
            <a href="/cookie-policy" style={link} className="hover:underline">Cookie Policy</a>).
          </li>
        </ul>
      </Section>

      <Section title="4. How We Use Your Information">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>To create and manage your account and organisation.</li>
          <li>To receive and store leads from connected advertising platforms and property portals.</li>
          <li>To assign leads to sales agents and track pipeline status.</li>
          <li>To send follow-up reminders and activity notifications within the platform.</li>
          <li>To generate analytics and performance reports for your sales team.</li>
          <li>To power AI features (Artha AI). See Section 7 for details.</li>
          <li>To bill for paid plans and process payments.</li>
          <li>To maintain security, investigate misuse, and prevent unauthorised access.</li>
          <li>To provide customer support and resolve technical issues.</li>
          <li>To reply to enquiries sent through our website.</li>
          <li>To comply with our legal obligations under Indian law.</li>
        </ul>
        <p>
          We do not sell personal data, and we do not use lead data for our own advertising or profiling.
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
          <li>If you turn on Conversion tracking in Integrations, we send Meta the stage a lead reaches (for example a site visit or a closed deal), together with a hashed phone number and email address or Meta's own lead or ad-click ID, so Meta can improve your ads. It is off by default, only your organisation's admins can switch it on, and you can switch it off at any time.</li>
          <li>Apart from that optional step, we do not sell, share, or use this data for advertising or any purpose beyond operating the CRM for you.</li>
          <li>You can disconnect your Facebook or Google account at any time from the Connections page inside the CRM. Disconnecting removes your stored access tokens.</li>
        </ul>
      </Section>

      <Section title="6. WhatsApp Business Integration">
        <p>
          Arthaleads is registered with Meta as a <strong style={strong}>Tech Provider</strong> for the
          WhatsApp Business Platform. This means Arthaleads' own Meta app can connect your WhatsApp Business
          Account (WABA) directly: you log in with your own Facebook account and pick or create your own WABA
          and phone number inside Meta's own onboarding flow ("Embedded Signup"). Your business identity,
          verified name and phone number stay yours. You can also connect a WhatsApp Business Solution
          Provider you already use, or enter Meta Cloud API credentials you generated yourself.
        </p>
        <p>Whichever way you connect, once WhatsApp is active on your account:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>We store your WhatsApp Business Account (WABA) ID, phone number ID, and business profile fields (verified name, display phone number, quality rating) to route messages and display your connection status.</li>
          <li>Where you connect via Arthaleads' own Meta Tech Provider integration, we store the access token Meta issues for your WhatsApp Business Account, and the number's registration PIN (encrypted at rest), so Arthaleads can send and receive messages on your behalf.</li>
          <li>Inbound and outbound message content is stored within your organisation's CRM account to display conversation history to your agents.</li>
          <li>Message delivery status and timestamps are stored for operational purposes.</li>
          <li>We do not access WhatsApp messages for any purpose other than displaying them within your CRM and, where applicable, running automation workflows (including AI-assisted replies and voice note transcription) you have set up.</li>
          <li>Disconnecting WhatsApp from the Connections page revokes and deletes the stored access token and registration PIN. Your WhatsApp Business Account itself is not affected. It remains yours, under your own Meta Business Portfolio, and continues to exist independently of Arthaleads.</li>
          <li>You remain responsible for obtaining consent from contacts before starting WhatsApp conversations and for complying with Meta's WhatsApp Business Policy and Platform Terms.</li>
        </ul>
      </Section>

      <Section title="7. AI Features (Artha AI)">
        <p>
          Arthaleads includes AI features ("Artha AI") for lead scoring, follow-up suggestions, WhatsApp reply
          drafts, call and voice note transcription, and sales assistance, powered by OpenAI's API. When you
          use AI features:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Relevant lead context (such as name, status, follow-up notes, messages, call audio and your question) is sent to OpenAI's API to generate a response. This data is processed under OpenAI's data processing terms.</li>
          <li>OpenAI does not use API data to train its general models (per its API data usage policy).</li>
          <li>We track the number of AI requests per organisation for billing and abuse prevention.</li>
          <li>You must not submit sensitive personal data (government ID numbers, financial account details, medical data) to AI features.</li>
          <li>AI suggestions and scores are advisory only. Arthaleads does not warrant the accuracy or suitability of AI responses.</li>
        </ul>
      </Section>

      <Section title="8. Where Data Is Stored and How We Protect It">
        <p>Your data is stored and processed in these places:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong style={strong}>Database:</strong> MongoDB Atlas on AWS in Mumbai, India.</li>
          <li><strong style={strong}>Files:</strong> call recordings, attendance photos, logos, documents and other media are kept in a private Backblaze B2 storage bucket in the US East region (USA). Files are not public: they are served only through our API to signed-in users who are allowed to see them.</li>
          <li><strong style={strong}>Backups:</strong> a daily encrypted backup of the database is stored in the same private Backblaze B2 bucket (USA).</li>
          <li><strong style={strong}>Application servers:</strong> our API runs on Railway (outside India), and the web app and website are served by Vercel's global network.</li>
        </ul>
        <p>
          This means your personal data may be processed outside India by the sub-processors listed in
          Section 10. The DPDP Act allows this unless the Government of India restricts transfers to a
          particular country, and we will follow any such restriction.
        </p>
        <p>We use reasonable security safeguards, including:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Encrypted connections (HTTPS/TLS) for all data in transit.</li>
          <li>Encryption at rest for the database, and extra field-level encryption for stored access tokens and keys.</li>
          <li>Bcrypt password hashing. Plain-text passwords are never stored.</li>
          <li>Login sessions held in httpOnly secure cookies that page scripts cannot read.</li>
          <li>Role-based access control. Every organisation's data is kept separate, and agents see only the leads they are allowed to see.</li>
          <li>Origin checks against cross-site request forgery on authenticated requests.</li>
          <li>Activity and access logs, so that misuse can be detected and investigated.</li>
        </ul>
      </Section>

      <Section title="9. Platform Support Access">
        <p>
          To provide technical support and resolve issues, authorised Arthaleads platform administrators
          may access your organisation's CRM account. We follow a strict support access policy to protect
          your privacy:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong style={strong}>Reason logged:</strong> A stated reason is required before any support session begins (for example Bug Investigation, Onboarding, Customer Support).</li>
          <li><strong style={strong}>Audit trail:</strong> Every support access event is recorded (who accessed, when, why, and for how long) in a tamper-resistant audit log.</li>
          <li><strong style={strong}>Notification:</strong> Your organisation's administrator receives a push notification when a support request is made or a session is active.</li>
          <li><strong style={strong}>In-app banner:</strong> A visible "Support session active" banner is shown at the bottom of the CRM screen for the whole of any active support session, so any logged-in user can see it in real time.</li>
          <li><strong style={strong}>Approval option:</strong> Your administrator can be asked to approve access before the session begins, and can end access at any time by clicking "End Session".</li>
          <li><strong style={strong}>Access log:</strong> A complete history of all support access is available to your organisation administrator at Settings → Security at any time.</li>
          <li><strong style={strong}>Purpose limitation:</strong> Support access is used only to diagnose technical issues or provide assistance. Support staff never copy, export, or share your data for any other purpose.</li>
          <li><strong style={strong}>Confidentiality:</strong> Everyone at Prophunt LLP who can access customer data is bound to keep it confidential.</li>
        </ul>
      </Section>

      <Section title="10. Sub-processors">
        <p>
          We do not sell or rent personal data. We share it only with the service providers below, and only
          as far as needed to run the Service. Each is bound to protect the data it handles.
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong style={strong}>MongoDB Atlas (on AWS):</strong> database hosting. India (Mumbai).</li>
          <li><strong style={strong}>Backblaze B2:</strong> file storage (call recordings, attendance photos, logos, media) and daily database backups. USA (US East).</li>
          <li><strong style={strong}>Railway:</strong> hosting for our API servers. Outside India.</li>
          <li><strong style={strong}>Vercel:</strong> hosting for the web app and website. Global network.</li>
          <li><strong style={strong}>OpenAI:</strong> AI features, lead scoring and transcription of calls and voice notes. USA.</li>
          <li><strong style={strong}>Meta Platforms:</strong> Facebook Lead Ads, the WhatsApp Business Platform (Cloud API), and the optional Conversions API described in Section 5. Global.</li>
          <li><strong style={strong}>Google:</strong> Sign in with Google, Google Ads lead forms (when connected), reCAPTCHA spam protection on sign-up and website forms, Firebase Cloud Messaging for Android app notifications, and Google Analytics on our website (only with your consent). Global.</li>
          <li><strong style={strong}>Resend:</strong> transactional email (sign-up codes, password resets, notifications). Outside India.</li>
          <li><strong style={strong}>Sentry:</strong> error monitoring, set up not to collect personal identifiers by default. Outside India.</li>
          <li><strong style={strong}>Razorpay:</strong> payment processing for paid plans and credits. India.</li>
          <li><strong style={strong}>EnableX and Plivo:</strong> calling and call recording, only when your organisation connects them. May process data outside India.</li>
          <li><strong style={strong}>Browser push services:</strong> the push service of your browser vendor (for example Google, Mozilla or Apple) delivers web notifications you allow.</li>
        </ul>
        <p>
          Some services are used only when your organisation chooses to connect them, and in that case your
          organisation has its own relationship with the provider: a WhatsApp Business Solution Provider
          (such as WATI, AiSensy or Interakt), property portals (99acres, Housing.com, MagicBricks), and
          an AI voice calling provider you connect for automatic calling of new leads.
        </p>
        <p>
          We will update this list before we start using a new sub-processor, and we will tell customers
          about material changes through the app or by email.
        </p>
      </Section>

      <Section title="11. Data Retention">
        <p>
          We keep personal data only as long as it is needed for the purpose it was collected for, or as the
          law requires. Specifically:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong style={strong}>Lead data and message history:</strong> kept until your organisation deletes it or closes its account.</li>
          <li>
            <strong style={strong}>Call recordings:</strong> the audio file is kept for a period set by your
            organisation's plan and then deleted automatically: 30 days on the Trial and Starter plans, 90 days
            on the Growth plan, and 365 days on the Enterprise plan (or a longer period agreed in writing). The
            call log, transcript and AI summary stay on the lead.
          </li>
          <li><strong style={strong}>Audit logs, activity logs and support access records:</strong> kept for at least one year, as the DPDP Rules require.</li>
          <li><strong style={strong}>Database backups:</strong> kept for up to 12 months and then deleted.</li>
          <li>
            <strong style={strong}>Accounts:</strong> you can delete your account from the app or from our{" "}
            <a href="/delete-account" style={link} className="hover:underline">Delete Account</a> page. A user
            is removed straight away. When the last admin of an organisation deletes it, the organisation and
            its data are deleted within 30 days. Copies in backups age out within 12 months.
          </li>
          <li><strong style={strong}>WhatsApp access tokens and registration PINs:</strong> deleted immediately when you disconnect WhatsApp from the Connections page, or when your account is deleted, whichever is sooner.</li>
        </ul>
        <p>
          You may also ask us to delete your data at any time by writing to{" "}
          <a href="mailto:contact@arthaleads.com" style={link} className="hover:underline">contact@arthaleads.com</a>.
        </p>
      </Section>

      <Section title="12. Personal Data Breaches">
        <p>If a personal data breach happens:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong style={strong}>Data we process for customers:</strong> Prophunt LLP will notify the
            affected customers (the Data Fiduciaries) without undue delay after becoming aware of the breach,
            share what we know about it, and help them inform the affected people and the Data Protection
            Board of India.
          </li>
          <li>
            <strong style={strong}>Data we hold as Data Fiduciary:</strong> we will inform the affected people
            and the Data Protection Board of India without delay, explaining what happened, the likely
            consequences, what we are doing about it and what they can do to protect themselves, and we will
            give the Board a detailed report within 72 hours of becoming aware of the breach, as the DPDP Rules
            require.
          </li>
        </ul>
      </Section>

      <Section title="13. Your Rights (Data Principals)">
        <p>Under the DPDP Act, 2023, you have the right to:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong style={strong}>Access:</strong> get a summary of the personal data we process about you and how we process it, and the names of those we have shared it with.</li>
          <li><strong style={strong}>Correction and completion:</strong> have inaccurate or incomplete personal data corrected, completed or updated.</li>
          <li><strong style={strong}>Erasure:</strong> have your personal data deleted, unless we must keep it to meet a legal obligation.</li>
          <li><strong style={strong}>Grievance redressal:</strong> raise a complaint with our Grievance Officer (see Section 16) and get a response.</li>
          <li><strong style={strong}>Nomination:</strong> name another person to exercise these rights for you if you die or become unable to do so.</li>
          <li><strong style={strong}>Withdraw consent:</strong> where we rely on your consent, withdraw it as easily as you gave it. For example, change your choice in the <a href="/cookie-policy" style={link} className="hover:underline">Cookie Policy</a> panel, disconnect integrations (Facebook, WhatsApp, Google) from the Connections page, or delete your account. Withdrawal does not affect processing done before it.</li>
        </ul>
        <p>
          Organisation admins can also export their lead data in CSV or Excel format from inside the CRM at
          any time.
        </p>
        <p>
          <strong style={strong}>If you are a lead of a business that uses Arthaleads:</strong> that business
          is the Data Fiduciary for your data, so please send your request to it. If you contact us instead,
          we will pass your request to the business and help it respond.
        </p>
        <p>
          To exercise any of these rights, write to{" "}
          <a href="mailto:contact@arthaleads.com" style={link} className="hover:underline">contact@arthaleads.com</a>.
          We may ask you to confirm your identity first. We will respond within 30 days. If you are not
          satisfied with our response, you may complain to the Data Protection Board of India.
        </p>
      </Section>

      <Section title="14. Children's Privacy">
        <p>
          Arthaleads is a business tool and is not meant for anyone under 18 years of age. We do not knowingly
          collect or process personal data of children. If you believe a child's data has reached us, write
          to us and we will delete it.
        </p>
      </Section>

      <Section title="15. Cookies">
        <p>
          We use cookies and similar technologies as described in our{" "}
          <a href="/cookie-policy" style={link} className="hover:underline">Cookie Policy</a>.
          You can manage your cookie preferences at any time on that page.
        </p>
      </Section>

      <Section title="16. Grievance Officer">
        <p>
          Under the DPDP Act, 2023, the DPDP Rules, 2025 and the IT Act, 2000, we have a Grievance Officer to
          handle complaints about personal data. If you have any concern about how your data is handled,
          contact:
        </p>
        <ContactBox>
          <p className="font-bold mb-1" style={strong}>Grievance Officer, Prophunt LLP (Arthaleads)</p>
          <p style={{ color: "var(--app-text-soft)" }}>
            Email:{" "}
            <a href="mailto:contact@arthaleads.com" style={link} className="hover:underline">
              contact@arthaleads.com
            </a>
          </p>
          <p style={{ color: "var(--app-text-soft)" }}>
            Address: 1, Utkarsha Bungalow, Late Babanrao Shripati Dhankude Road, Baner, Pune, Maharashtra 411045, India
          </p>
          <p style={{ color: "var(--app-text-soft)" }}>Response time: within 30 days of receipt.</p>
        </ContactBox>
      </Section>

      <Section title="17. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time to reflect changes in our practices, features,
          sub-processors or legal requirements. When we do, we will update the "Last updated" date at the top
          of this page. For material changes, we will notify active users through the app. Continued use of
          the platform after changes means you accept the updated policy.
        </p>
      </Section>

      <Section title="18. Contact Us">
        <p>
          If you have any questions, requests, or concerns about this Privacy Policy or your data, please
          contact:
        </p>
        <ContactBox>
          <p className="font-bold mb-1" style={strong}>Prophunt LLP (Arthaleads)</p>
          <p style={{ color: "var(--app-text-soft)" }}>
            Email:{" "}
            <a href="mailto:contact@arthaleads.com" style={link} className="hover:underline">
              contact@arthaleads.com
            </a>
          </p>
          <p style={{ color: "var(--app-text-soft)" }}>
            Address: 1, Utkarsha Bungalow, Late Babanrao Shripati Dhankude Road, Baner, Pune, Maharashtra 411045, India
          </p>
          <p style={{ color: "var(--app-text-soft)" }}>
            Platform:{" "}
            <a href="https://www.arthaleads.com" style={link} className="hover:underline">
              https://arthaleads.com
            </a>
          </p>
        </ContactBox>
      </Section>

    </LegalLayout>
  );
}
