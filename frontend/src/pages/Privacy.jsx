export default function Privacy() {
  const updated = "3 April 2026";

  return (
    <div className="min-h-screen bg-white text-gray-800">
      {/* Header */}
      <div style={{ background: "#1a1a2e" }} className="px-6 py-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#a04100] to-[#ff6b00]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
          </svg>
        </div>
        <span className="text-white font-bold text-lg">Arthaleads</span>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-4xl font-black text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: {updated}</p>

        <Section title="1. Introduction">
          <p>
            Arthaleads ("we", "us", or "our") is a real estate customer relationship management (CRM) platform
            operated by Arthaleads. This Privacy Policy explains how we collect, use, store, and protect
            information when you use our platform, including when our application connects to Meta (Facebook)
            services to retrieve lead data.
          </p>
        </Section>

        <Section title="2. Information We Collect">
          <p className="mb-3">We collect the following types of information:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Account information:</strong> Name, work email address, phone number, and password when you create a CRM account.</li>
            <li><strong>Lead data:</strong> Names, phone numbers, email addresses, and property preferences of prospective real estate customers — collected via Facebook Lead Ads, Google Ads landing pages, WhatsApp enquiries, or manual entry.</li>
            <li><strong>Facebook page and form data:</strong> When you connect your Facebook account, we access your Facebook Pages and Lead Ad Forms to retrieve lead submissions. We store the Page ID, Form ID, and Page Access Token required to receive leads.</li>
            <li><strong>Usage data:</strong> Login timestamps, actions performed inside the CRM, and activity logs for audit purposes.</li>
          </ul>
        </Section>

        <Section title="3. How We Use Your Information">
          <ul className="list-disc pl-5 space-y-2">
            <li>To create and manage your CRM account.</li>
            <li>To receive and store leads from connected advertising platforms (Facebook, Google, WhatsApp).</li>
            <li>To assign leads to sales agents and track pipeline status.</li>
            <li>To send follow-up reminders and activity notifications within the platform.</li>
            <li>To generate analytics and performance reports for your sales team.</li>
            <li>To maintain security and prevent unauthorised access.</li>
          </ul>
        </Section>

        <Section title="4. Facebook Data Usage">
          <p className="mb-3">
            Our platform integrates with the Meta (Facebook) Graph API to retrieve leads submitted through
            Facebook Lead Ads. Specifically:
          </p>
          <ul className="list-disc pl-5 space-y-2">
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
          <ul className="list-disc pl-5 space-y-2">
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
          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
            <p className="font-semibold">Arthaleads</p>
            <p className="text-gray-600 mt-1">Email: <a href="mailto:info@arthaleads.com" className="text-orange-600 hover:underline">info@arthaleads.com</a></p>
            <p className="text-gray-600">Platform: <a href="https://arthaleads.com" className="text-orange-600 hover:underline">https://arthaleads.com</a></p>
          </div>
        </Section>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} Arthaleads · All rights reserved
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">{title}</h2>
      <div className="text-sm leading-7 text-gray-600 space-y-2">{children}</div>
    </div>
  );
}
