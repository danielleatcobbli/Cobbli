# Repair lifecycle emails (draft integration)

This adds a durable database outbox and a secret-protected FastAPI worker for the approved Brevo templates 25–38. Sending defaults OFF. This is not a deployed or end-to-end verified integration. Do not enable it until the launch dependencies below are complete.

## Event mapping

| Template | Event |
| --- | --- |
| 25 Request received | New pending assessment |
| 26 More information | Assessment changes to needs_more_info |
| 27 Recommendations ready | Assessment changes to quote_ready, except waitlist release |
| 28 Pickup confirmed | Complete pickup booking on a placed/confirmed/pickup-scheduled order |
| 29 Pickup reminder | Day before pickup, at or after 9 AM America/New_York |
| 30 Bag collected | Order changes to picked-up |
| 31 Schedule return | Order changes to ready-for-return |
| 32 Return confirmed | Complete return booking on ready-for-return/return-scheduled order |
| 33 Return reminder | Day before return, at or after 9 AM America/New_York |
| 34 Waitlisted | Assessment changes to waitlisted |
| 35 Capacity available | waitlisted changes directly to quote_ready |
| 36 Request declined | Assessment changes to declined/service_unavailable |
| 37 Request closed | Assessment changes to closed |
| 38 Repair canceled | Order changes to canceled/cancelled |

The transaction that changes status also queues the email. Rollback removes both changes. No historical records are backfilled. No-op updates don't enqueue. Booking confirmations/reminders deduplicate by booking UID + date + time label. State is rechecked before sending to suppress obsolete notifications. This is not an exactly-once delivery guarantee: a state change can race the provider call. Unknown provider outcomes are held for review, not automatically retried.

## Implemented customer and staff flows

Staff can ask a question, read customer replies and photos, decline with an explanation, and close a request at the customer's request. Context and status changes are saved together. Customer replies require the signed-in owner or the request's secret token. Reply photos are private; staff receives short-lived links. Retried submissions do not create duplicate replies.

Guest email links open the full confirmed repair and permit initial pickup/return scheduling using the existing request token. Existing appointments cannot be rescheduled through this flow. Staff must cancel calendar appointments manually before confirming a repair cancellation, and must enter accurate next steps and payment status. This action does not issue refunds.

The four booking template sources in `backend/email_templates` omit self-service rescheduling and the two-hour cutoff. Confirm the live Brevo versions match before enabling delivery. Live template updates are not fully verified yet.

## Staging rollout and remaining access

No complete staging deployment or live delivery test has been verified. The staging database connector failed during setup, and the available AWS account did not list the Cobbli hosting app. Obtain the correct staging frontend/backend URL and deployment access; do not deploy to the production project.

1. Verify/apply prerequisite `20261002182652_complimentary_repair_integrity.sql`, then `20261019120000_repair_email_outbox.sql` and `20261020185138_repair_customer_messages.sql` on staging. Inspect current schema first. The outbox migration retires three obsolete repair-email triggers; authentication emails are unaffected.
2. Deploy frontend and backend from this branch together. Configure staging Supabase credentials, `SITE_URL` to the staging frontend HTTPS origin, and the frontend API origin. Configure server-only `BREVO_API_KEY` and a strong `REPAIR_EMAIL_WORKER_SECRET`.
3. Keep `REPAIR_EMAILS_ENABLED=false` until the templates and data are checked. Keep `REPAIR_EMAIL_DELIVERY_MODE=test` (default). Set `REPAIR_EMAIL_TEST_RECIPIENTS` to a comma-separated list of explicitly approved internal addresses. An empty list blocks all sends; recipients are never silently redirected. No approved live test address has been supplied yet.
4. Configure the hosting scheduler to POST `/internal/repair-emails/run` once per minute with the worker bearer secret. This scheduler is not yet deployed. The worker claims up to 20 messages per call; allow enough runtime for provider latency.
5. Enable only staging sending, exercise the review cases below, and verify Brevo delivery logs and actual inbox rendering. Reconcile blocked/uncertain events individually. Production sending requires a separate rollout and explicit `REPAIR_EMAIL_DELIVERY_MODE=production` configuration.

Sender currently remains Danielle from Cobbli <noreply@cobbli.com>, reply-to support@cobbli.com. Verify this sender and reconcile with the live templates' sender before delivery testing.

## Shivangi's staging review

Use disposable staging requests and approved internal recipients only:

- Submit a request; verify one receipt email. Ask a staff question, reply with text/photos from the email link, and confirm staff can read it. Retry the same submission and confirm no duplicate reply.
- Publish recommendations; select repairs and book a pickup. Verify the confirmation's date, window, address/unit, reference, and website link for one and multiple bags.
- Open the guest link in a fresh browser session. Confirm it shows the saved repair and supports initial return booking after staff marks it ready. A wrong token must fail.
- Mark picked up, then ready for return. Verify the collected email explains the next step and the return-ready email opens scheduling. Confirm return booking generates one confirmation.
- Test pickup and return reminders with controlled staging dates. Canceled, obsolete, or incomplete bookings must not send reminders. No customer reschedule link should appear.
- Exercise waitlist/release, decline with explanation, customer-requested closure, and cancellation after manual calendar cancellation. Verify accurate customer context and no automatic refund claim.
- Repeat status saves and worker calls; verify no duplicate notifications. Verify an address outside the test list is blocked. Simulate provider failure and confirm it is held for review, not automatically resent.

## Operations

Monitor outbox `blocked`, `uncertain`, and `sending` rows older than the worker's maximum execution duration. No automatic retries are implemented. `blocked` means required data is missing or a lookup failed; fix the owning workflow, then explicitly reset that event to pending. `uncertain` or stranded `sending` requires checking Brevo logs before any requeue, because the provider may have accepted it. A crash before sending may therefore delay delivery until operator intervention. A successful API response is recorded as sent, not proof of inbox delivery. Brevo delivery/bounce webhook tracking is not included.

```sql
select id, entity_type, entity_id, kind, status, created_at, claimed_at,
       message_id, error_code
from public.repair_email_outbox
where status in ('blocked', 'uncertain', 'sending')
order by created_at;
```

Do not bulk reset sent/uncertain rows. Disabling the worker does not stop queue creation. Re-enabling later requires reviewing accumulated events.

## Verification

- 62 focused Python tests pass across lifecycle delivery, initial scheduling, customer replies and public proposals, including test-recipient enforcement.
- 71 frontend tests and TypeScript checking pass.
- SQL fixture tests pass for outbox behavior and the customer-message migration.
- PGlite runs the actual migration on minimal Postgres fixtures and checks transitions, deduplication, transaction rollback, claims and access restrictions. This does not replace testing all migrations on Supabase.
- Full backend suite comparison against unchanged main `2eb8f05`: same 30 failures, in legacy checkout and disabled old email tests; no additional failures from this change. These existing failures remain unresolved.
- No live provider calls or customer emails were sent.

Run Python tests from backend with the repository's dev requirements installed:

```sh
pytest tests/test_repair_emails.py tests/test_initial_schedule.py tests/test_repair_messages.py tests/test_public_proposal.py
```

Run SQL checks from backend/tests/sql:

```sh
npm install
npm test
```
