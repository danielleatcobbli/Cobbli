import { usePageMeta } from "@/hooks/usePageMeta";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";

const PrivacyPolicy = () => {
  usePageMeta({
    title: "Privacy policy — Cobbli",
    description:
      "Read Cobbli's privacy policy: how we collect, use and protect personal information when you book shoe repairs and use our door-to-door service.",
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-6 md:px-12 py-12 text-left">
          <h1
            className="text-3xl md:text-4xl font-semibold"
            style={{ color: "#3d1700" }}
          >
            Privacy Policy
          </h1>
          <p
            className="mt-2"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 400,
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            Effective Date: June 4, 2025 | Last Updated: June 4, 2025
          </p>
          <div className="mt-8 text-foreground/90 leading-relaxed">
            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#3d1700" }}
            >
              1. Introduction
            </h2>
            <p className="mt-4">
              Welcome to Cobbli. Cobbli ("Cobbli," "we," "us," or "our") operates a technology-enabled door-to-door shoe and leather repair service accessible via{" "}
              <a
                href="https://www.cobbli.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                www.cobbli.com
              </a>{" "}
              (the "Site") and any associated mobile applications or platforms (collectively, the "Services").
            </p>
            <p className="mt-4">
              We are committed to protecting your personal information. This Privacy Policy explains what information we collect, how we use it, with whom we share it, and the choices available to you. Please read this Policy carefully before using our Services.
            </p>
            <p className="mt-4">
              By creating an account, placing an order, or otherwise using our Services, you agree to the collection and use of information as described in this Policy.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#3d1700" }}
            >
              2. Information We Collect
            </h2>
            <p className="mt-4">
              We collect information in the following ways:
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              2.1 Information You Provide to Us
            </h3>
            <p className="mt-4">
              <strong>Account Registration:</strong> When you create an account, we collect your name, email address, and password.
            </p>
            <p className="mt-4">
              <strong>Order Information:</strong> When you place an order, we collect your delivery address, pickup and return scheduling preferences, and details about the shoes or leather goods you are submitting for repair.
            </p>
            <p className="mt-4">
              <strong>Shoe Photos and Videos:</strong> You may upload photos or videos of your shoes or leather goods to enable us to assess the condition of your items and recommend appropriate repair services. We may in the future use automated tools, including artificial intelligence, to assist in diagnosing repair needs from these images.
            </p>
            <p className="mt-4">
              <strong>Payment Information:</strong> Payment card and billing information is collected and processed by Stripe, our third-party payment processor. This applies to both online transactions processed through our Site and in-person transactions processed through Stripe Terminal at any pop-up events or physical locations. We do not store your full payment card details on our systems.
            </p>
            <p className="mt-4">
              <strong>Communications:</strong> If you contact us by email, text, or other means, we retain records of those communications.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              2.2 Information Collected Automatically
            </h3>
            <p className="mt-4">
              <strong>Usage Data:</strong> When you visit our Site, we may automatically collect information about your device, browser type, IP address, pages visited, time spent on pages, and referring URLs.
            </p>
            <p className="mt-4">
              <strong>Cookies and Tracking Technologies:</strong> We use cookies and similar technologies to operate our Site and, with your consent, to analyze Site traffic. See Section 7 (Cookies) for more detail.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              2.3 Information from Third Parties
            </h3>
            <p className="mt-4">
              We may receive information about you from third-party services you use to interact with us, such as analytics providers or payment processors, as further described in Section 5.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#3d1700" }}
            >
              3. How We Use Your Information
            </h2>
            <p className="mt-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Create and manage your account</li>
              <li>Process, fulfill, and communicate about your orders</li>
              <li>Schedule and coordinate shoe pickup and return</li>
              <li>Share necessary order and item information with our repair and operations staff to fulfill your service</li>
              <li>Process payments through Stripe</li>
              <li>Send you transactional communications, including order confirmations, scheduling updates, and service notifications via email and SMS/text message</li>
              <li>Analyze aggregate usage of our Site using Google Analytics 4 to improve user experience</li>
              <li>Diagnose repair needs, including through AI-assisted photo and video analysis, now or in the future</li>
              <li>Comply with applicable legal obligations</li>
              <li>Detect, investigate, and prevent fraudulent or unauthorized activity</li>
              <li>Send you promotional communications, where you have opted in to receive them (see Section 8)</li>
            </ul>
            <p className="mt-4">
              We do not use your personal information for automated decision-making that produces legal or similarly significant effects without human review.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#3d1700" }}
            >
              4. Legal Bases for Processing
            </h2>
            <p className="mt-4">
              We process your personal information on the following bases:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong>Performance of a contract:</strong> Processing necessary to fulfill your orders and provide our Services
              </li>
              <li>
                <strong>Consent:</strong> Where you have given us explicit permission, such as for analytics cookies or marketing communications
              </li>
              <li>
                <strong>Legitimate interests:</strong> Such as improving our Services, preventing fraud, and communicating with you about your orders, where these interests are not overridden by your rights
              </li>
              <li>
                <strong>Legal obligation:</strong> Where processing is required to comply with applicable law
              </li>
            </ul>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#3d1700" }}
            >
              5. How We Share Your Information
            </h2>
            <p className="mt-4">
              We do not sell your personal information. We may share your information in the following limited circumstances:
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              5.1 Service Providers
            </h3>
            <p className="mt-4">
              We share information with third-party vendors and service providers that help us operate our business, including:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Stripe — payment processing (online and in-person)</li>
              <li>Google Analytics 4 — website traffic analytics (anonymized/aggregated)</li>
              <li>Supabase — database infrastructure and backend services</li>
              <li>Brevo — transactional email delivery</li>
              <li>Courier and logistics partners — for the purpose of scheduling and executing shoe pickups and returns</li>
            </ul>
            <p className="mt-4">
              These service providers are permitted to use your information only as necessary to provide services to us and are subject to contractual obligations to protect your information.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              5.2 Repair and Operations Staff
            </h3>
            <p className="mt-4">
              Our internal repair staff will have access to order information and item details (including photos and videos) necessary to assess and complete your repair. Staff access to personally identifiable customer data is limited to what is operationally required.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              5.3 Legal and Safety Disclosures
            </h3>
            <p className="mt-4">
              We may disclose your information if required to do so by law or in the good-faith belief that such action is necessary to: (i) comply with a legal obligation; (ii) protect and defend our rights or property; (iii) prevent or investigate possible wrongdoing in connection with the Services; or (iv) protect the safety of our users or the public.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              5.4 Business Transfers
            </h3>
            <p className="mt-4">
              If Cobbli is involved in a merger, acquisition, asset sale, or similar transaction, your information may be transferred as part of that transaction. We will notify you before your information becomes subject to a materially different privacy policy.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#3d1700" }}
            >
              6. Data Retention
            </h2>
            <p className="mt-4">
              We retain your personal information for as long as necessary to fulfill the purposes described in this Policy, unless a longer retention period is required by law. Our default retention periods are:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong>Account and order data:</strong> 7 years from your last account activity, consistent with tax recordkeeping obligations
              </li>
              <li>
                <strong>Shoe photos and videos:</strong> Deleted within 90 days of order completion, unless you provide separate consent for longer retention (e.g., for repeat order history or service improvement)
              </li>
              <li>
                <strong>Payment records:</strong> Retained as required by Stripe and applicable tax and financial recordkeeping laws (typically 7 years)
              </li>
              <li>
                <strong>Marketing preferences and opt-out records:</strong> Until you request deletion, or until we no longer operate the relevant program
              </li>
              <li>
                <strong>Inactive accounts:</strong> We will send a notice to accounts that have been inactive for 3 years and may delete such accounts if no activity resumes
              </li>
            </ul>
            <p className="mt-4">
              You may request deletion of your account and associated data at any time by contacting us as described in Section 11.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#3d1700" }}
            >
              7. Cookies and Tracking Technologies
            </h2>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              7.1 Strictly Necessary Cookies
            </h3>
            <p className="mt-4">
              These cookies are required for the Site to function. They enable core features such as account authentication, session management, and security. These cookies cannot be disabled.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              7.2 Analytics Cookies
            </h3>
            <p className="mt-4">
              With your consent, we use Google Analytics 4 (GA4) to collect anonymized, aggregate data about how visitors use our Site. This helps us understand traffic patterns and improve the user experience. GA4 cookies are only set after you click "Accept" on our cookie consent prompt.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              7.3 Future Advertising Cookies
            </h3>
            <p className="mt-4">
              We do not currently use advertising or retargeting cookies. If we introduce targeted advertising in the future, we will update this Policy and obtain your consent where required.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              7.4 Managing Cookies
            </h3>
            <p className="mt-4">
              You can control cookies through your browser settings. Disabling certain cookies may affect the functionality of our Site. You may also opt out of Google Analytics data collection by installing the Google Analytics Opt-Out Browser Add-on available at{" "}
              <a
                href="https://tools.google.com/dlpage/gaoptout"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                https://tools.google.com/dlpage/gaoptout
              </a>
              .
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#3d1700" }}
            >
              8. Marketing and Promotional Communications
            </h2>
            <p className="mt-4">
              We will send you transactional communications related to your orders (such as order confirmations and scheduling updates) without requiring separate consent, as these are necessary to fulfill your service.
            </p>
            <p className="mt-4">
              We may send you promotional emails or text messages about new services, offers, or updates only where you have opted in to receive them. You may opt out of marketing communications at any time by:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Clicking "Unsubscribe" in any marketing email</li>
              <li>Replying "STOP" to any marketing text message</li>
              <li>
                Contacting us at{" "}
                <a href="mailto:support@cobbli.com" className="underline">
                  support@cobbli.com
                </a>
              </li>
            </ul>
            <p className="mt-4">
              Opting out of marketing communications will not affect delivery of transactional communications related to your existing orders.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#3d1700" }}
            >
              9. Children's Privacy
            </h2>
            <p className="mt-4">
              Our Services are intended for individuals 18 years of age and older. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child under 13 has provided us with personal information, please contact us at{" "}
              <a href="mailto:support@cobbli.com" className="underline">
                support@cobbli.com
              </a>{" "}
              and we will promptly delete such information.
            </p>
            <p className="mt-4">
              Because we do not require age verification at account creation, it is possible that individuals under 18 may create accounts. If we become aware that a user is under 13, we will take steps to delete their account and associated data.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#3d1700" }}
            >
              10. Your Privacy Rights and Choices
            </h2>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              10.1 Account Information
            </h3>
            <p className="mt-4">
              You may access and update certain information through your account settings, including your delivery addresses, payment methods, and password. We plan to offer additional data correction capabilities, including the ability to update your name and email address, in future updates to the platform.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              10.2 Data Deletion
            </h3>
            <p className="mt-4">
              You may request deletion of your account and personal information by contacting us at{" "}
              <a href="mailto:support@cobbli.com" className="underline">
                support@cobbli.com
              </a>
              . We will honor deletion requests subject to our legal obligations to retain certain data (e.g., financial records).
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              10.3 California Residents (CCPA)
            </h3>
            <p className="mt-4">
              Although Cobbli currently operates exclusively in New York City, we anticipate expanding our services in the future. If and when we serve California residents, they will have the following rights under the California Consumer Privacy Act (CCPA):
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>The right to know what personal information we collect, use, disclose, and sell</li>
              <li>The right to delete personal information we hold about you</li>
              <li>The right to correct inaccurate personal information</li>
              <li>The right to opt out of the sale or sharing of personal information (we do not currently sell personal information)</li>
              <li>The right to non-discrimination for exercising your privacy rights</li>
            </ul>
            <p className="mt-4">
              To submit a CCPA request, contact us at{" "}
              <a href="mailto:support@cobbli.com" className="underline">
                support@cobbli.com
              </a>
              . We will verify your identity before processing your request. We will respond within 45 days of receipt.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              10.4 Other Applicable Rights
            </h3>
            <p className="mt-4">
              Depending on your jurisdiction, you may have additional rights under applicable privacy law, including the right to access, correct, or object to the processing of your personal information. To exercise any such rights, please contact us at{" "}
              <a href="mailto:support@cobbli.com" className="underline">
                support@cobbli.com
              </a>
              .
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#3d1700" }}
            >
              11. Data Security
            </h2>
            <p className="mt-4">
              We implement commercially reasonable technical and organizational measures to protect your personal information from unauthorized access, disclosure, alteration, or destruction. These measures include encrypted connections (HTTPS), authentication controls, and access limitations on who within our organization can access your data.
            </p>
            <p className="mt-4">
              No method of transmission over the internet or method of electronic storage is 100% secure. While we strive to protect your personal information, we cannot guarantee its absolute security. If you believe your account has been compromised, please contact us immediately at{" "}
              <a href="mailto:support@cobbli.com" className="underline">
                support@cobbli.com
              </a>
              .
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#3d1700" }}
            >
              12. Third-Party Links and Services
            </h2>
            <p className="mt-4">
              Our Site may contain links to third-party websites or services that are not operated by us. We have no control over, and assume no responsibility for, the content, privacy policies, or practices of any third-party sites. We encourage you to review the privacy policies of any third-party services you visit.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#3d1700" }}
            >
              13. How to Contact Us
            </h2>
            <p className="mt-4">
              If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at:
            </p>
            <p className="mt-4">Cobbli</p>
            <p className="mt-4">
              Email:{" "}
              <a href="mailto:support@cobbli.com" className="underline">
                support@cobbli.com
              </a>
            </p>
            <p className="mt-4">
              Website:{" "}
              <a
                href="https://www.cobbli.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                www.cobbli.com
              </a>
            </p>
            <p className="mt-4">
              We aim to respond to all privacy-related inquiries within 30 days.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#3d1700" }}
            >
              14. Changes to This Privacy Policy
            </h2>
            <p className="mt-4">
              We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or for other operational reasons. When we make material changes, we will update the "Last Updated" date at the top of this Policy and, where appropriate, notify you by email or through a prominent notice on our Site.
            </p>
            <p className="mt-4">
              Your continued use of our Services after the effective date of any update constitutes your acceptance of the revised Policy. We encourage you to review this Policy periodically.
            </p>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
