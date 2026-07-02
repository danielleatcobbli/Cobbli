import { usePageMeta } from "@/hooks/usePageMeta";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";

const TermsConditions = () => {
  usePageMeta({
    title: "Terms & conditions — Cobbli",
    description:
"The terms and conditions that govern your use of Cobbli's NYC shoe repair service, including pickup, return, payment and order guarantees.",
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
            Terms & Conditions
          </h1>
          <p
            className="mt-2"
            style={{
              fontFamily: "'Albert Sans', sans-serif",
              fontWeight: 400,
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            Effective Date: June 4, 2026 | Last Updated: June 4, 2026
          </p>
          <div className="mt-8 text-foreground/90 leading-relaxed">
            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#3d1700" }}
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
              and all associated services, including shoe and leather goods repair, pickup, and return delivery (collectively, the &quot;Services&quot;).
            </p>
            <p className="mt-4">
              By creating an account, placing an order, or otherwise using our Services, you agree to be bound by these Terms and our Privacy Policy, which is incorporated herein by reference. If you do not agree to these Terms, do not use our Services.
            </p>
            <p className="mt-4">
              We reserve the right to update or modify these Terms at any time. We will notify you of material changes by updating the &quot;Last Updated&quot; date above and, where appropriate, by email. Your continued use of the Services after any such changes constitutes your acceptance of the revised Terms.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#3d1700" }}
            >
              2. Eligibility and Account Registration
            </h2>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              2.1 Eligibility
            </h3>
            <p className="mt-4">
              You must be at least 18 years of age to use the Services. By creating an account, you represent and warrant that you are 18 years of age or older and have the legal capacity to enter into a binding contract. We reserve the right to terminate accounts found to belong to users under 18.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              2.2 Account Registration
            </h3>
            <p className="mt-4">
              You must create a registered account to place an order. You agree to provide accurate, current, and complete information during registration and to keep your account information up to date. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              2.3 One Account Per Person
            </h3>
            <p className="mt-4">
              Each individual may maintain only one account. Accounts are personal and non-transferable. Commercial use of the Services — including submitting items on behalf of a business, boutique, reseller, or any third party — is strictly prohibited through the consumer platform.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              2.4 Account Termination
            </h3>
            <p className="mt-4">
              We reserve the right to suspend or terminate your account at our sole discretion, with or without notice, for any violation of these Terms, fraudulent activity, or behavior that we determine to be harmful to Cobbli or other users.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#3d1700" }}
            >
              3. Services
            </h2>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              3.1 Scope of Services
            </h3>
            <p className="mt-4">
              Cobbli provides technology-enabled door-to-door pickup, repair, and return delivery of shoes and leather goods. Services are currently available within designated service areas in New York City. We reserve the right to modify, expand, or restrict our service area at any time.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              3.2 Accepted Items
            </h3>
            <p className="mt-4">
              We accept shoes and leather goods in repairable condition. We reserve the right to refuse any item at our sole discretion, including but not limited to:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Items assessed as structurally unsalvageable or beyond reasonable repair, whether determined from customer-submitted photos prior to pickup or upon physical inspection by our cobbler at intake</li>
              <li>Items that are biohazardous, heavily soiled, contaminated, or present a health or safety risk to our staff</li>
              <li>Items with an estimated or declared value exceeding $600</li>
              <li>Items not classified as shoes or leather goods</li>
            </ul>
            <p className="mt-4">
              If an item is refused after pickup, we will return it to you at no additional charge and provide a full refund of any amounts paid.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              3.3 Item Value Cap
            </h3>
            <p className="mt-4">
              Cobbli accepts items with a market value of up to $600. By submitting an item for service, you represent that the item&apos;s value does not exceed $600. We do not require formal value declaration at the time of order, but reserve the right to request proof of purchase in connection with any claim.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              3.4 Pricing and Estimates
            </h3>
            <p className="mt-4">
              All pricing is fixed and confirmed at the time of checkout. By completing your order, you agree to the stated service price. We do not provide post-checkout estimates or adjustments unless additional services are identified and separately agreed upon in writing prior to work commencing.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              3.5 Service Limitations
            </h3>
            <p className="mt-4">
              Cobbli does not guarantee specific repair outcomes beyond what is reasonably achievable given the condition of the item at intake. Repair results may vary based on the material, age, prior condition, and nature of the damage. We will communicate known limitations before beginning work where feasible.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#3d1700" }}
            >
              4. Pickup, Handling, and Return
            </h2>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              4.1 Scheduling
            </h3>
            <p className="mt-4">
              Pickup and return delivery windows are scheduled through the Cobbli platform at the time of order. You are responsible for ensuring that someone is available to hand off and receive items within the scheduled window. Cobbli will make reasonable efforts to adhere to scheduled windows but does not guarantee exact arrival times.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              4.2 Item Condition Documentation
            </h3>
            <p className="mt-4">
              At the time of pickup, Cobbli will photograph your items to document their pre-existing condition. These photographs constitute the agreed record of item condition at intake. By tendering your items for pickup, you acknowledge and accept this documentation process. Pre-existing damage identified in pickup photographs will not be the basis for a damage claim.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              4.3 Cancellations
            </h3>
            <p className="mt-4">
              You may cancel your order free of charge up to 3 hours before your scheduled pickup time. Cancellations made within 3 hours of the scheduled pickup time will incur a $15 late cancellation fee, which will be charged to your payment method on file. To cancel, log into your account or contact us at{" "}
              <a href="mailto:support@cobbli.com" className="underline">
                support@cobbli.com
              </a>
              .
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              4.4 Rescheduling
            </h3>
            <p className="mt-4">
              You may reschedule your pickup at no charge if the request is made at least 3 hours before the scheduled pickup time. Reschedule requests made within 3 hours of the scheduled pickup time will be treated as a late cancellation and subject to the $15 fee described in Section 4.3.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              4.5 No-Shows
            </h3>
            <p className="mt-4">
              If you are unavailable during your scheduled pickup window and have not cancelled or rescheduled in advance, your order will be treated as a no-show. No-shows are subject to a $15 fee charged to your payment method on file. You will be offered one opportunity to reschedule at no additional charge following a no-show. A second no-show on the same order will result in order cancellation without refund.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              4.6 Return Delivery
            </h3>
            <p className="mt-4">
              Upon completion of your repair, we will contact you to schedule a return delivery window. You are responsible for ensuring availability during the scheduled return window. If you are unavailable for return delivery, we will make one additional delivery attempt. If the second attempt is also unsuccessful, your items will be held in secure storage and the provisions of Section 4.7 will apply.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              4.7 Unclaimed Items and Abandoned Property
            </h3>
            <p className="mt-4">
              If your repaired items cannot be returned after two delivery attempts, Cobbli will store your items securely and notify you by email at 14 days and again at 28 days following the first failed delivery attempt. If items remain unclaimed after 30 days from the first failed delivery attempt, Cobbli reserves the right to assess a storage fee of $5 per day and, after 60 days total, to treat the items as abandoned. Cobbli shall have no further liability for abandoned items.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              4.8 Items Held Pending Payment
            </h3>
            <p className="mt-4">
              Cobbli reserves a possessory lien over all items in our custody. We are entitled to retain possession of repaired items until full payment has been received and confirmed. In the event of a payment dispute, chargeback, or failed payment, Cobbli will hold your items pending resolution. If payment is not resolved within 30 days of notice, items may be treated as abandoned pursuant to Section 4.7.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#3d1700" }}
            >
              5. Liability for Items in Our Care
            </h2>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              5.1 Standard of Care
            </h3>
            <p className="mt-4">
              Cobbli will exercise reasonable care in the handling, transportation, and repair of your items. We maintain bailee&apos;s insurance coverage for items in our custody. In the event of loss or damage caused directly by Cobbli&apos;s negligence, we will work with you in good faith to resolve the matter.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              5.2 Limitation of Liability for Items
            </h3>
            <p className="mt-4">
              Cobbli&apos;s maximum liability for any item lost or damaged while in our care is limited to the lesser of: (a) the verified original purchase price of the item, as evidenced by a receipt or proof of purchase provided by you, or (b) $600. This limitation applies regardless of the item&apos;s current market value, sentimental value, or resale value.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              5.3 Claims Process
            </h3>
            <p className="mt-4">
              To submit a claim for a lost or damaged item, you must:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                Notify Cobbli in writing at{" "}
                <a href="mailto:support@cobbli.com" className="underline">
                  support@cobbli.com
                </a>{" "}
                within 7 days of your scheduled return delivery date
              </li>
              <li>Provide a description of the loss or damage</li>
              <li>Provide proof of purchase or other documentation establishing the item&apos;s original value</li>
            </ul>
            <p className="mt-4">
              Claims submitted outside this window or without supporting documentation may not be honored. Cobbli reserves the right to investigate all claims and to deny claims where damage is determined to be pre-existing, based on the pickup photographs taken pursuant to Section 4.2.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              5.4 Excluded Losses
            </h3>
            <p className="mt-4">Cobbli is not liable for:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Pre-existing damage, wear, or defects documented at pickup</li>
              <li>Damage resulting from the inherent nature of the item (e.g., fragile embellishments, weakened materials, prior repairs by third parties)</li>
              <li>Consequential, incidental, or indirect losses, including loss of use</li>
              <li>Items with a value exceeding the $600 cap that were submitted in violation of Section 3.3</li>
              <li>Damage caused by circumstances beyond our reasonable control, including weather events or third-party courier failures</li>
            </ul>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#3d1700" }}
            >
              6. Repair Satisfaction Guarantee
            </h2>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              6.1 Re-Do Policy
            </h3>
            <p className="mt-4">
              If you are not satisfied with the quality of a completed repair, Cobbli will re-perform the repair at no additional charge, subject to the conditions in this Section. We do not offer cash refunds for completed repair services except where a re-do is not feasible due to Cobbli&apos;s error.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              6.2 Reporting Window
            </h3>
            <p className="mt-4">
              To be eligible for a re-do, you must report your dissatisfaction to Cobbli in writing at{" "}
              <a href="mailto:support@cobbli.com" className="underline">
                support@cobbli.com
              </a>{" "}
              within 14 days of your return delivery date. Requests submitted after 14 days will not be eligible for a re-do under this guarantee.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              6.3 Scope of Re-Do
            </h3>
            <p className="mt-4">
              The re-do guarantee covers the specific repair service performed. It does not cover dissatisfaction arising from limitations inherent to the item&apos;s condition, material, or prior damage, or from outcomes that were communicated to you as uncertain prior to the repair. Cobbli&apos;s cobbler determination of what constitutes a satisfactory repair outcome is final.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#3d1700" }}
            >
              7. Payments
            </h2>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              7.1 Payment Processing
            </h3>
            <p className="mt-4">
              All payments are processed by Stripe, our third-party payment processor, for both online transactions and in-person transactions conducted via Stripe Terminal at any Cobbli pop-up or physical location. By providing payment information, you authorize Cobbli to charge the applicable fees to your payment method.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              7.2 Fees
            </h3>
            <p className="mt-4">
              Service fees are displayed and confirmed at checkout. A courier fee of $15 applies per order, which is waived for orders totaling $100 or more. Late cancellation, no-show, and storage fees are as described in Sections 4.3, 4.5, and 4.7 respectively.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              7.3 Disputes and Chargebacks
            </h3>
            <p className="mt-4">
              If you believe you have been incorrectly charged, please contact us at{" "}
              <a href="mailto:support@cobbli.com" className="underline">
                support@cobbli.com
              </a>{" "}
              before initiating a chargeback with your payment provider. Unauthorized chargebacks on completed services will be disputed. Cobbli reserves the right to suspend or terminate accounts with a history of fraudulent or abusive payment disputes.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#3d1700" }}
            >
              8. Prohibited Items and Prohibited Use
            </h2>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              8.1 Prohibited Items
            </h3>
            <p className="mt-4">
              You may not submit any of the following items through the Services:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Items valued above $600</li>
              <li>Biohazardous, heavily soiled, or contaminated items posing a health or safety risk</li>
              <li>Items that are not shoes or leather goods</li>
              <li>Items you do not own or do not have authority to submit for repair</li>
            </ul>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              8.2 Prohibited Use
            </h3>
            <p className="mt-4">
              You may not use the Services for any commercial purpose, including submitting items on behalf of a business, boutique, or third party. You may not use the Services in any manner that violates applicable law, these Terms, or the rights of others. Violation of this section may result in immediate account termination and forfeiture of any amounts paid.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#3d1700" }}
            >
              9. Intellectual Property and Photo Consent
            </h2>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              9.1 Cobbli IP
            </h3>
            <p className="mt-4">
              All content on the Cobbli platform, including but not limited to text, graphics, logos, images, and software, is the property of Cobbli or its licensors and is protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works from any Cobbli content without our express written permission.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              9.2 Customer Photo Consent
            </h3>
            <p className="mt-4">
              By submitting photos or videos of your items through the Services, you grant Cobbli a non-exclusive, royalty-free, worldwide license to use, store, reproduce, and process those images for the following purposes:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Service fulfillment and repair diagnosis</li>
              <li>Development and improvement of AI-assisted diagnostic tools</li>
              <li>Internal service quality improvement and staff training</li>
              <li>Marketing and promotional materials, including on Cobbli&apos;s website and social media channels</li>
            </ul>
            <p className="mt-4">
              With respect to marketing use only, you may opt out at any time by notifying us at{" "}
              <a href="mailto:support@cobbli.com" className="underline">
                support@cobbli.com
              </a>
              . Opting out of marketing use does not affect our right to use your photos for service fulfillment, AI development, or internal improvement purposes. We will not use photos in a way that identifies you personally without your separate consent.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#3d1700" }}
            >
              10. Disclaimers
            </h2>
            <p className="mt-4">
              THE SERVICES ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. COBBLI DOES NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.
            </p>
            <p className="mt-4">
              TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, COBBLI&apos;S TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICES SHALL NOT EXCEED THE GREATER OF: (A) THE TOTAL AMOUNTS PAID BY YOU TO COBBLI IN THE 12 MONTHS PRECEDING THE CLAIM, OR (B) $600.
            </p>
            <p className="mt-4">
              IN NO EVENT SHALL COBBLI BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#3d1700" }}
            >
              11. Dispute Resolution and Arbitration
            </h2>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              11.1 Mandatory Arbitration
            </h3>
            <p className="mt-4">
              PLEASE READ THIS SECTION CAREFULLY. IT AFFECTS YOUR LEGAL RIGHTS, INCLUDING YOUR RIGHT TO FILE A LAWSUIT IN COURT.
            </p>
            <p className="mt-4">
              Any dispute, claim, or controversy arising out of or relating to these Terms or the Services, including the determination of the scope or applicability of this arbitration agreement, shall be resolved exclusively by final and binding arbitration administered by{" "}
              <a
                href="https://www.jamsadr.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                JAMS
              </a>{" "}
              pursuant to its Streamlined Arbitration Rules and Procedures. The arbitration shall be conducted in New York, New York. The arbitrator&apos;s award shall be final and binding and may be entered as a judgment in any court of competent jurisdiction.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              11.2 Class Action Waiver
            </h3>
            <p className="mt-4">
              YOU AND COBBLI EACH AGREE THAT ANY DISPUTE RESOLUTION PROCEEDINGS WILL BE CONDUCTED ONLY ON AN INDIVIDUAL BASIS AND NOT IN A CLASS, CONSOLIDATED, OR REPRESENTATIVE ACTION. IF FOR ANY REASON A CLAIM PROCEEDS IN COURT RATHER THAN IN ARBITRATION, YOU AND COBBLI EACH WAIVE ANY RIGHT TO A JURY TRIAL.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              11.3 Governing Law
            </h3>
            <p className="mt-4">
              These Terms shall be governed by and construed in accordance with the laws of the State of New York, without regard to its conflict of law principles. To the extent any matter proceeds in court, you consent to the exclusive jurisdiction of the state and federal courts located in New York County, New York.
            </p>

            <h2
              className="text-xl font-semibold mt-8"
              style={{ color: "#3d1700" }}
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
              style={{ color: "#3d1700" }}
            >
              13. General Provisions
            </h2>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              13.1 Entire Agreement
            </h3>
            <p className="mt-4">
              These Terms, together with our Privacy Policy, constitute the entire agreement between you and Cobbli with respect to the Services and supersede all prior agreements, representations, and understandings.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              13.2 Severability
            </h3>
            <p className="mt-4">
              If any provision of these Terms is found to be unenforceable or invalid, that provision will be limited or eliminated to the minimum extent necessary, and the remaining provisions will continue in full force and effect.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              13.3 No Waiver
            </h3>
            <p className="mt-4">
              Our failure to enforce any right or provision of these Terms shall not constitute a waiver of that right or provision.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              13.4 Assignment
            </h3>
            <p className="mt-4">
              You may not assign or transfer your rights or obligations under these Terms without our prior written consent. Cobbli may assign these Terms freely, including in connection with a merger, acquisition, or sale of assets.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              13.5 Force Majeure
            </h3>
            <p className="mt-4">
              Cobbli shall not be liable for any delay or failure to perform resulting from causes outside our reasonable control, including acts of God, weather events, labor disputes, or government actions.
            </p>

            <h3
              className="text-lg font-semibold mt-6"
              style={{ color: "#3d1700" }}
            >
              13.6 Contact
            </h3>
            <p className="mt-4">
              If you have any questions about these Terms, please contact us at{" "}
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
