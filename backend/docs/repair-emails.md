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

## Launch dependencies / connection contract

1. **Customer response backend (coordinate with Olivier).** `src/lib/repairResponse.ts` defines question/response endpoints that are absent in main. After implementing and testing them, the staff workflow must write `staff_question` and `response_flow_ready: true` in server-owned context before setting needs_more_info. The worker blocks this email until that flag is present. The flag is an integration assertion, not a runtime health check.
2. **Cal.com booking synchronization.** Current code creates bookings but has no verified reschedule/cancel webhook synchronization. Implement authenticated webhook handling that updates the matching order's booking UID, date and window. Otherwise reminders can use stale details. Persist the actual reschedule URL returned/verified by the scheduling integration; never synthesize it from an assumed URL format. Confirm that the two-hour cutoff in the approved copy is enforced by Cal.com or the server before enabling booking emails.
3. **Guest repair management.** Main now has guest order lookup, but it does not provide the authenticated repair page/return scheduling flow used by these email buttons. Guest order emails deliberately block until a secure management URL and full flow are implemented. Anonymous-auth users also need durable sign-in/access after their browser session ends; test this explicitly.
4. **Staff context and cancellation.** Add server-owned writes for explanations and cancellation outcomes. Do not copy arbitrary customer JSON. `closed` is mapped but still needs a supported customer-request closure workflow. Cancellation should cancel the real booking before reporting it canceled.
5. **Deployment and scheduler.** No production settings, migrations, scheduler, or Brevo sends were changed by this work. Configure and test staging first.

`public.repair_email_context` is service-role-only with primary key `(entity_type, entity_id)` and JSON `data`. The owning backend writes context before the associated transition, ideally in the same transaction. Required fields:

- More information: `staff_question`, `response_flow_ready: true`.
- Declined: `staff_explanation`.
- Pickup/return confirmation or reminder: `pickup_reschedule_url` / `return_reschedule_url`, plus `pickup_version` / `return_version` matching `UID|YYYY-MM-DD|time_label` in the order. Refresh both after rescheduling. Only HTTPS URLs on the configured site hostname or cal.com are accepted.
- Repair cancellation: `next_steps`, `payment_status`; optional `cancellation_reason`.
- Request closure: optional `payment_status`.

Existing sender configuration is reused: Danielle from Cobbli <noreply@cobbli.com>, reply-to support@cobbli.com. Verify the sender in Brevo. Template IDs are account-specific; staging should use an isolated Brevo account/template set or test recipients, never real customer records.

## Staging rollout

1. Complete the dependencies above. Confirm all template IDs and rendered params with one- and multiple-bag cases, logged-in and guest users.
2. Apply `supabase/migrations/20261019120000_repair_email_outbox.sql` to staging. It retires three obsolete repair-email triggers, so treat migration deployment as a sender cutover even while the worker is disabled. It does not affect authentication emails.
3. Set server-only `BREVO_API_KEY`, existing Supabase admin credentials, HTTPS origin `SITE_URL`, and a strong `REPAIR_EMAIL_WORKER_SECRET`. Keep `REPAIR_EMAILS_ENABLED=false` until ready. Never expose these through VITE variables.
4. Use a server scheduler to POST `/internal/repair-emails/run` once per minute with `Authorization: Bearer <REPAIR_EMAIL_WORKER_SECRET>`. The worker claims 20 rows per invocation; use an execution limit that accommodates provider latency, or reduce the batch for short-lived hosts. The repo does not yet configure this scheduler.
5. Before enabling, review/suppress queued test or stale events. Turn on `REPAIR_EMAILS_ENABLED` only for the staging test. Exercise every event and verify actual delivery, buttons, cancellation/rescheduling and the cutoff. Then repeat a controlled production smoke test with approved internal recipients.

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

- 38 focused Python tests cover all 14 payloads, plural bag count, public request tokens, address/unit and DST, stale/canceled notifications, missing context, matching booking links, authorization, feature flag, success, suppression, blocked sends and uncertain provider outcomes.
- PGlite runs the actual migration on minimal Postgres fixtures and checks transitions, deduplication, transaction rollback, claims and access restrictions. This does not replace testing all migrations on Supabase.
- Full backend suite comparison against unchanged main `2eb8f05`: same 30 failures, in legacy checkout and disabled old email tests; no additional failures from this change. These existing failures remain unresolved.
- No live provider calls or customer emails were sent.

Run Python tests from backend with the repository's dev requirements installed:

```sh
pytest tests/test_repair_emails.py
```

Run SQL checks from backend/tests/sql:

```sh
npm install
npm test
```
