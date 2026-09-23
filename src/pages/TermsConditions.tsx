import { usePageMeta } from "@/hooks/usePageMeta";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";

const TermsConditions = () => {
  usePageMeta({
    title: "Terms & conditions — Cobbli",
    description:
"The terms and conditions that govern your use of Cobbli's repair service for bags, shoes, and leather goods, including pickup, return, payment, and order guarantees.",
  });

  // Full rewrite 2026-09-23 (Danielle's call) — new item-value cap ($600 ->
  // $1,500), fair-market-value-based liability (replacing the old "verified
  // original purchase price" standard), a new "In plain English" summary at
  // the top of Section 2 (styled as a cream callout box, same #fff5cc/
  // #3d1700 treatment used for helper callouts elsewhere on the site, since
  // it's meant to visually break from the surrounding legal text), and
  // mandatory JAMS arbitration + class action waiver (new Section 11) among
  // other additions. Same h1/h2/h3 amber-on-white structure and styling as
  // before — only the content changed, not the page's visual pattern.
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-6 md:px-12 py-12 text-left">
          <h1
            className="text-3xl md:text-4xl uppercase font-bold"
            style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
          >
            Terms & Conditions
          </h1>
          <p
            className="mt-2"
            style={{
              fontFamily: "'Instrument Sans', sans-serif",
              fontWeight: 400,
              fontSize: "13px",
              color: "#fdb600",
              opacity: 0.7,
            }}
          >
            Effective Date: [Insert date] | Last Updated: [Insert date]
          </p>
          <div className="mt-8 leading-relaxed" style={{ color: "#fdb600", opacity: 0.9, fontFamily: "'Instrument Sans', sans-serif" }}>
            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              1. Acceptance of Terms
            </h2>
            <p className="mt-4">
              These Terms and Conditions of Service (&quot;Terms&quot;) constitute a legally binding agreement between you (&quot;Customer,&quot; &quot;you,&quot; or &quot;your&quot;) and Cobbli (&quot;Cobbli,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), governing your access to and use of the Cobbli website at{" "}
              <a
                href="https://www.cobbli.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                www.cobbli.com
              </a>{" "}
              and all associated services, including the repair of bags, shoes, and leather goods, and related pickup and return delivery (collectively, the &quot;Services&quot;).
            </p>
            <p className="mt-4">
              By creating an account, placing an order, or otherwise using our Services, you agree to be bound by these Terms and our Privacy Policy, which is incorporated herein by reference. If you do not agree to these Terms, do not use our Services.
            </p>
            <p className="mt-4">
              We reserve the right to update or modify these Terms at any time. We will notify you of material changes by updating the &quot;Last Updated&quot; date above and, where appropriate, by email. Your continued use of the Services after any such changes constitutes your acceptance of the revised Terms.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              2. Item Care, Item Value & Liability
            </h2>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              2.1 Item Value Limit
            </h3>
            <p className="mt-4">
              We accept items with a fair-market value of up to $1,500 per item. When you book, you confirm that each item you submit is worth $1,500 or less. We do not ask you to state a specific value at booking. If you are unsure whether an item exceeds this limit, please contact us at{" "}
              <a href="mailto:support@cobbli.com" className="underline">
                support@cobbli.com
              </a>{" "}
              before booking.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              2.2 Our Right to Decline Items
            </h3>
            <p className="mt-4">
              We may decline any item, before or after pickup, if:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>we reasonably believe its value exceeds $1,500;</li>
              <li>we consider it too high-risk to repair, for example because it is exceptionally rare, fragile, irreplaceable, or of uncertain authenticity; or</li>
              <li>it falls outside the accepted items described in Section 4.2.</li>
            </ul>
            <p className="mt-4">
              Where possible, we will decline items before pickup based on the photos and description you submit. If we decline an item after pickup, we will return it at no charge and refund any amounts paid for that item.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              2.3 Standard of Care
            </h3>
            <p className="mt-4">
              We will exercise reasonable care in handling, transporting, storing, and repairing your items. An item is &quot;in our care&quot; from the moment it is handed to Cobbli or our courier at pickup until it is handed back to you or left at your designated return location. This includes time spent with any courier or repair specialist acting on Cobbli&apos;s behalf. We maintain bailee&apos;s insurance for items in our care.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              2.4 Maximum Liability
            </h3>
            <p className="mt-4">
              If an item is lost or damaged while in our care due to Cobbli&apos;s negligence or that of anyone acting on our behalf, we will first try to restore the item at our own cost where that can reasonably be done. If the item cannot reasonably be restored, our maximum liability is the lesser of:
            </p>
            <p className="mt-2">
              (a) the item&apos;s fair-market value at the time of intake, determined under Section 2.5; or
            </p>
            <p className="mt-2">
              (b) $1,500 per item.
            </p>
            <p className="mt-4">
              For partial damage, we will pay the reasonable cost of professional restoration or the reduction in the item&apos;s fair-market value, whichever is less, subject to the same cap. In addition to any payment under this Section, we will refund the service fees you paid for the affected item. This limitation applies regardless of the item&apos;s sentimental value, replacement cost, or resale value above the cap.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              2.5 How Fair-Market Value Is Determined
            </h3>
            <p className="mt-4">
              &quot;Fair-market value&quot; means the price a willing buyer would reasonably pay for the item in the condition it was in at intake, as shown in our intake photographs (Section 5.2). We determine fair-market value when a claim is made, based on documentation you provide, which may include:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>a receipt, order confirmation, or credit card statement;</li>
              <li>a professional appraisal or authentication certificate; or</li>
              <li>credible resale evidence, such as recent sold listings on established resale platforms for the same or a substantially similar item in comparable condition.</li>
            </ul>
            <p className="mt-4">
              Original purchase price is relevant evidence but is not conclusive, because fair-market value reflects the item&apos;s age, wear, and condition at intake. If you cannot provide documentation, we will determine fair-market value in good faith using comparable resale data and our intake photographs. We may request additional reasonable documentation to evaluate a claim.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              2.6 Accuracy of Your Value Confirmation
            </h3>
            <p className="mt-4">
              You are responsible for confirming accurately that each item is worth $1,500 or less. If an item&apos;s value exceeded $1,500 when you submitted it, our liability for that item remains limited to $1,500. We may return such an item unrepaired, with a refund of amounts paid for it.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              2.7 Pre-Existing Condition, Vintage, and Aged Materials
            </h3>
            <p className="mt-4">
              Our intake photographs are the agreed record of each item&apos;s condition when it enters our care. Damage, wear, or defects visible in those photographs will not be the basis for a claim.
            </p>
            <p className="mt-4">
              Vintage, aged, and previously repaired items often have weaknesses that are not visible, such as dried or cracked leather, brittle stitching, degraded linings or edge paint, fragile hardware, and prior repairs by others. Even when repair work is done with reasonable care, these materials may tear, crack, discolor, or otherwise deteriorate. Dye and color matching on aged materials may also vary. Where we identify such risks, we will tell you before starting work and, where appropriate, ask for your approval to proceed. We are not liable for damage that results from an item&apos;s inherent condition or materials where we exercised reasonable care.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              2.8 Exclusions
            </h3>
            <p className="mt-4">We are not liable for:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>pre-existing damage, wear, or defects documented at intake;</li>
              <li>damage resulting from an item&apos;s inherent condition or materials, as described in Section 2.7;</li>
              <li>outcomes you were told were uncertain and approved before work began;</li>
              <li>consequential, incidental, or indirect losses, including loss of use;</li>
              <li>contents left inside bags or other items (please empty all pockets and compartments before pickup); or</li>
              <li>losses caused by events beyond our reasonable control, as described in Section 13.5.</li>
            </ul>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              2.9 Claims Process
            </h3>
            <p className="mt-4">
              To make a claim for a lost or damaged item, you must notify us in writing at{" "}
              <a href="mailto:support@cobbli.com" className="underline">
                support@cobbli.com
              </a>{" "}
              within 7 days after your return delivery date. If an item is lost, you must notify us within 7 days after we tell you it is lost. Your claim should include:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>a description of the loss or damage;</li>
              <li>photos of the damage, if the item has been returned; and</li>
              <li>any documentation you have supporting the item&apos;s fair-market value (see Section 2.5).</li>
            </ul>
            <p className="mt-4">
              We will acknowledge your claim within 3 business days and aim to resolve it within 15 business days of receiving the information we need. Claims submitted after the 7-day window may not be honored.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              2.10 Workmanship Issues
            </h3>
            <p className="mt-4">
              If you are unhappy with the quality of a completed repair, our Repair Satisfaction Guarantee (Section 6) applies. If a repair itself damages an item beyond a workmanship shortfall, we will inspect the item and then repair or re-do the work where reasonably possible. Otherwise, we will resolve the matter under Section 2.4.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              2.11 Your Agreement
            </h3>
            <p className="mt-4">
              At booking, you must confirm that each item is worth $1,500 or less and agree to this Section before your order can be placed.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              3. Eligibility and Account Registration
            </h2>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              3.1 Eligibility
            </h3>
            <p className="mt-4">
              You must be at least 18 years of age to use the Services. By creating an account, you represent and warrant that you are 18 years of age or older and have the legal capacity to enter into a binding contract. We reserve the right to terminate accounts found to belong to users under 18.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              3.2 Account Registration
            </h3>
            <p className="mt-4">
              You must create a registered account to place an order. You agree to provide accurate, current, and complete information during registration and to keep your account information up to date. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              3.3 One Account Per Person
            </h3>
            <p className="mt-4">
              Each individual may maintain only one account. Accounts are personal and non-transferable. Commercial use of the Services, including submitting items on behalf of a business, boutique, reseller, or any third party, is prohibited through the consumer platform.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              3.4 Account Termination
            </h3>
            <p className="mt-4">
              We reserve the right to suspend or terminate your account at our sole discretion, with or without notice, for any violation of these Terms, fraudulent activity, or behavior that we determine to be harmful to Cobbli or other users.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              4. Services
            </h2>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              4.1 Scope of Services
            </h3>
            <p className="mt-4">
              Cobbli provides technology-enabled repair of bags, shoes, and leather goods, with door-to-door pickup and return delivery. Services are currently available within designated service areas in New York City. The repair categories we offer may vary over time. We reserve the right to modify, expand, or restrict our service area and service categories at any time.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              4.2 Accepted Items
            </h3>
            <p className="mt-4">
              We accept the following items in repairable condition:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>handbags and other bags, whether leather or other materials;</li>
              <li>shoes; and</li>
              <li>other leather goods, such as belts, wallets, and small leather accessories, in the categories we offer at the time of booking.</li>
            </ul>
            <p className="mt-4">
              We may refuse any item as described in Section 2.2, including items that:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>are structurally unsalvageable or beyond reasonable repair, based on submitted photos or inspection at intake;</li>
              <li>are biohazardous, heavily soiled, contaminated, or otherwise present a health or safety risk; or</li>
              <li>are worth more than $1,500.</li>
            </ul>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              4.3 Pricing and Estimates
            </h3>
            <p className="mt-4">
              All pricing is fixed and confirmed at checkout. By completing your order, you agree to the stated service price. We do not adjust pricing after checkout unless additional services are identified and separately agreed with you in writing before work begins.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              4.4 Service Limitations
            </h3>
            <p className="mt-4">
              Cobbli does not guarantee specific repair outcomes beyond what is reasonably achievable given the item&apos;s condition at intake. Results may vary based on material, age, prior condition, and the nature of the damage. Where feasible, we will communicate known limitations before beginning work.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              5. Pickup, Handling, and Return
            </h2>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              5.1 Scheduling
            </h3>
            <p className="mt-4">
              Pickup and return delivery windows are scheduled through the Cobbli platform. You are responsible for ensuring that someone is available to hand off and receive items within the scheduled window. We will make reasonable efforts to keep to scheduled windows but do not guarantee exact arrival times.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              5.2 Item Condition Documentation
            </h3>
            <p className="mt-4">
              At pickup or intake, we will photograph your items to document their condition. These photographs are the agreed record of each item&apos;s condition at intake and will be shared with you in your intake confirmation. If you believe a photograph does not accurately reflect your item&apos;s condition, please tell us within 48 hours of receiving your intake confirmation.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              5.3 Cancellations
            </h3>
            <p className="mt-4">
              You may cancel your order free of charge up to 3 hours before your scheduled pickup time. Cancellations within 3 hours of the scheduled pickup time incur a $15 late cancellation fee, charged to your payment method on file. To cancel, log into your account or contact{" "}
              <a href="mailto:support@cobbli.com" className="underline">
                support@cobbli.com
              </a>
              .
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              5.4 Rescheduling
            </h3>
            <p className="mt-4">
              You may reschedule your pickup at no charge up to 3 hours before the scheduled pickup time. Reschedule requests within 3 hours of pickup are treated as a late cancellation under Section 5.3.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              5.5 No-Shows
            </h3>
            <p className="mt-4">
              If you are unavailable during your scheduled pickup window and have not cancelled or rescheduled in advance, your order will be treated as a no-show. No-shows incur a $15 fee, charged to your payment method on file. After a no-show, you may reschedule once at no additional charge. A second no-show on the same order will result in cancellation without refund.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              5.6 Return Delivery
            </h3>
            <p className="mt-4">
              When your repair is complete, we will contact you to schedule return delivery. You are responsible for being available during the scheduled window. If you are unavailable, we will make one additional delivery attempt. If that attempt also fails, your items will be held in secure storage under Section 5.7.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              5.7 Unclaimed Items and Abandoned Property
            </h3>
            <p className="mt-4">
              If your items cannot be returned after two delivery attempts, we will store them securely and notify you by email 14 days and 28 days after the first failed attempt. If items remain unclaimed 30 days after the first failed attempt, we may charge a storage fee of $5 per day. After 60 days, we may treat the items as abandoned, and Cobbli will have no further liability for them.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              5.8 Items Held Pending Payment
            </h3>
            <p className="mt-4">
              Cobbli holds a possessory lien over items in our custody and may keep repaired items until full payment is received. In the event of a payment dispute, chargeback, or failed payment, we will hold your items pending resolution. If payment is not resolved within 30 days of notice, items may be treated as abandoned under Section 5.7.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              6. Repair Satisfaction Guarantee
            </h2>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              6.1 Re-Do Policy
            </h3>
            <p className="mt-4">
              If you are not satisfied with the quality of a completed repair, we will re-perform the repair at no additional charge, subject to this Section. We do not offer cash refunds for completed repairs except where a re-do is not feasible due to Cobbli&apos;s error.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              6.2 Reporting Window
            </h3>
            <p className="mt-4">
              To be eligible for a re-do, you must notify us in writing at{" "}
              <a href="mailto:support@cobbli.com" className="underline">
                support@cobbli.com
              </a>{" "}
              within 14 days of your return delivery date.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              6.3 Scope of Re-Do
            </h3>
            <p className="mt-4">
              The re-do guarantee covers the specific repair performed. It does not cover dissatisfaction arising from:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>limitations inherent to the item&apos;s condition, material, or prior damage; or</li>
              <li>outcomes that you were told were uncertain before the repair.</li>
            </ul>
            <p className="mt-4">
              Satisfactory repair outcomes are assessed by our repair specialists against professional repair standards. Damage caused by a repair is handled under Section 2.10.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              7. Payments
            </h2>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              7.1 Payment Processing
            </h3>
            <p className="mt-4">
              All payments are processed by Stripe, our third-party payment processor, for both online transactions and in-person transactions made via Stripe Terminal at any Cobbli pop-up or physical location. By providing payment information, you authorize Cobbli to charge applicable fees to your payment method.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              7.2 Fees
            </h3>
            <p className="mt-4">
              Service fees are displayed and confirmed at checkout. A courier fee of $15 applies per order and is waived for orders of $100 or more. Late cancellation, no-show, and storage fees are described in Sections 5.3, 5.5, and 5.7.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              7.3 Disputes and Chargebacks
            </h3>
            <p className="mt-4">
              If you believe you have been charged incorrectly, please contact{" "}
              <a href="mailto:support@cobbli.com" className="underline">
                support@cobbli.com
              </a>{" "}
              before starting a chargeback with your payment provider. Unauthorized chargebacks on completed services will be disputed. We may suspend or terminate accounts with a history of fraudulent or abusive payment disputes.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              8. Prohibited Items and Prohibited Use
            </h2>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              8.1 Prohibited Items
            </h3>
            <p className="mt-4">You may not submit:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>items worth more than $1,500;</li>
              <li>biohazardous, heavily soiled, or contaminated items that pose a health or safety risk;</li>
              <li>items outside the categories described in Section 4.2; or</li>
              <li>items you do not own or are not authorized to submit for repair.</li>
            </ul>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              8.2 Prohibited Use
            </h3>
            <p className="mt-4">
              You may not use the Services for any commercial purpose, including submitting items on behalf of a business, boutique, or third party. You may not use the Services in any way that violates applicable law, these Terms, or the rights of others. Violating this Section may result in immediate account termination.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              9. Intellectual Property and Photo Consent
            </h2>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              9.1 Cobbli IP
            </h3>
            <p className="mt-4">
              All content on the Cobbli platform, including text, graphics, logos, images, and software, is owned by Cobbli or its licensors and is protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works from Cobbli content without our express written permission.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              9.2 Customer Photo Consent
            </h3>
            <p className="mt-4">
              By submitting photos or videos of your items, and by allowing us to photograph your items at intake, you grant Cobbli a non-exclusive, royalty-free, worldwide license to use, store, reproduce, and process those images for:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>service fulfillment and repair diagnosis;</li>
              <li>development and improvement of AI-assisted diagnostic tools;</li>
              <li>internal service quality improvement and staff training; and</li>
              <li>marketing and promotional materials, including on Cobbli&apos;s website and social media channels.</li>
            </ul>
            <p className="mt-4">
              You may opt out of marketing use at any time by contacting{" "}
              <a href="mailto:support@cobbli.com" className="underline">
                support@cobbli.com
              </a>
              . Opting out does not affect our use of photos for service fulfillment, AI development, or internal improvement. We will not use photos in a way that identifies you personally without your separate consent.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              10. Disclaimers and Limitation of Liability
            </h2>
            <p className="mt-4">
              EXCEPT AS EXPRESSLY STATED IN THESE TERMS, THE SERVICES ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. COBBLI DOES NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.
            </p>
            <p className="mt-4">
              LIABILITY FOR LOSS OF OR DAMAGE TO ITEMS IN OUR CARE IS GOVERNED BY SECTION 2. FOR ALL OTHER CLAIMS, TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, COBBLI&apos;S TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICES SHALL NOT EXCEED THE GREATER OF: (A) THE TOTAL AMOUNTS YOU PAID TO COBBLI IN THE 12 MONTHS BEFORE THE CLAIM, OR (B) $1,500.
            </p>
            <p className="mt-4">
              IN NO EVENT SHALL COBBLI BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              11. Dispute Resolution and Arbitration
            </h2>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              11.1 Mandatory Arbitration
            </h3>
            <p className="mt-4">
              PLEASE READ THIS SECTION CAREFULLY. IT AFFECTS YOUR LEGAL RIGHTS, INCLUDING YOUR RIGHT TO FILE A LAWSUIT IN COURT.
            </p>
            <p className="mt-4">
              Any dispute, claim, or controversy arising out of or relating to these Terms or the Services, including the scope or applicability of this arbitration agreement, shall be resolved exclusively by final and binding arbitration administered by{" "}
              <a
                href="https://www.jamsadr.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                JAMS
              </a>{" "}
              under its Streamlined Arbitration Rules and Procedures. The arbitration shall take place in New York, New York. The arbitrator&apos;s award shall be final and binding and may be entered as a judgment in any court of competent jurisdiction.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              11.2 Class Action Waiver
            </h3>
            <p className="mt-4">
              YOU AND COBBLI EACH AGREE THAT ANY DISPUTE RESOLUTION PROCEEDINGS WILL BE CONDUCTED ONLY ON AN INDIVIDUAL BASIS AND NOT IN A CLASS, CONSOLIDATED, OR REPRESENTATIVE ACTION. IF FOR ANY REASON A CLAIM PROCEEDS IN COURT RATHER THAN IN ARBITRATION, YOU AND COBBLI EACH WAIVE ANY RIGHT TO A JURY TRIAL.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              11.3 Governing Law
            </h3>
            <p className="mt-4">
              These Terms are governed by the laws of the State of New York, without regard to its conflict of law principles. To the extent any matter proceeds in court, you consent to the exclusive jurisdiction of the state and federal courts located in New York County, New York.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              12. Notices
            </h2>
            <p className="mt-4">
              All legal notices to Cobbli must be sent in writing to:
            </p>
            <div className="mt-2 space-y-1">
              <div>Cobbli</div>
              <div>c/o Registered Agent</div>
              <div>131 Continental Dr, Suite 305</div>
              <div>Newark, DE 19713</div>
              <div>
                Email:{" "}
                <a href="mailto:support@cobbli.com" className="underline">
                  support@cobbli.com
                </a>
              </div>
            </div>
            <p className="mt-4">
              We may send notices to you at the email address associated with your account. Notices sent by email are effective upon transmission.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              13. General Provisions
            </h2>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              13.1 Entire Agreement
            </h3>
            <p className="mt-4">
              These Terms and our Privacy Policy are the entire agreement between you and Cobbli regarding the Services. They supersede all prior agreements, representations, and understandings.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              13.2 Severability
            </h3>
            <p className="mt-4">
              If any provision of these Terms is found unenforceable or invalid, it will be limited or eliminated to the minimum extent necessary, and the remaining provisions will stay in full force and effect.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              13.3 No Waiver
            </h3>
            <p className="mt-4">
              Our failure to enforce any right or provision of these Terms is not a waiver of that right or provision.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              13.4 Assignment
            </h3>
            <p className="mt-4">
              You may not assign or transfer your rights or obligations under these Terms without our prior written consent. Cobbli may assign these Terms freely, including in connection with a merger, acquisition, or sale of assets.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              13.5 Force Majeure
            </h3>
            <p className="mt-4">
              Cobbli is not liable for any delay or failure to perform caused by events outside our reasonable control, including acts of God, severe weather, fire, labor disputes, or government actions.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#fdb600", fontFamily: "'Fraunces', serif" }}
            >
              13.6 Contact
            </h3>
            <p className="mt-4">
              Questions about these Terms can be sent to{" "}
              <a href="mailto:support@cobbli.com" className="underline">
                support@cobbli.com
              </a>
              .
            </p>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
};

export default TermsConditions;
