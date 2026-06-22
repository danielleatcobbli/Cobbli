# Cobbli FastAPI Backend

Replaces the Supabase Edge Functions with a single FastAPI service deployable to Vercel.

## Why a separate backend?

- Supabase Developer-tier access can't reconfigure auth providers; we now own the project (`ajoyprzrzoyxftfkrxgn`).
- Server-side logic is easier to test, observe, and version with a real Python service.
- One deploy target (Vercel) — same project as the frontend, but a separate function set.

## Layout

```
backend/
├── api/index.py              # Vercel entry point (Python serverless function)
├── app/
│   ├── main.py               # FastAPI factory + CORS + router wiring
│   ├── settings.py           # pydantic-settings config (all env-driven)
│   ├── auth.py               # Supabase JWT bearer auth dependency
│   ├── supabase_client.py    # Service-role + per-user clients
│   ├── routes/               # One module per endpoint
│   └── services/             # brevo, stripe, ai helpers
├── tests/                    # pytest suite (TDD-first)
├── requirements.txt          # Runtime deps
├── requirements-dev.txt      # + pytest, ruff
├── pyproject.toml            # ruff + pytest config
├── vercel.json               # Vercel build config (python3.12)
└── .env.example              # All required env vars
```

## Local dev

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env             # fill in secrets
uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/health to verify.

## Tests

```bash
cd backend
pytest                # all tests
pytest --cov=app      # with coverage
ruff check .          # lint
```

## Deploy to Vercel (transferable across accounts)

This deploy is intentionally **not** pinned to a specific Vercel team — `vercel.json`
holds only the build/runtime config. Account ownership is controlled by `vercel link`,
which writes a local `.vercel/` directory that is NOT committed. To hand the project
off to Danielle later:

1. She runs `vercel link` from `backend/` and selects her team.
2. She copies the env vars from our project to hers (or via `vercel env pull` then
   `vercel env add`).
3. Update DNS / Vercel domain settings in her dashboard.

### First-time deploy (current account)

```bash
cd backend
npm i -g vercel        # if not installed
vercel login
vercel link            # pick a Cobbli team / personal account
vercel env add SUPABASE_URL                 # paste value, choose preview+prod
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add STRIPE_SECRET_KEY
vercel env add STRIPE_WEBHOOK_SECRET
vercel env add BREVO_API_KEY
vercel env add AI_API_KEY
vercel env add CORS_ALLOW_ORIGINS           # e.g. https://your-frontend.vercel.app
vercel deploy                               # preview deploy
vercel deploy --prod                        # production
```

## Env vars

See `.env.example`. Required for runtime:

- `SUPABASE_URL` — new project URL.
- `SUPABASE_SERVICE_ROLE_KEY` — service-role secret. **Server-only.**
- `STRIPE_SECRET_KEY` — `sk_test_*` for previews, `sk_live_*` for prod.
- `STRIPE_WEBHOOK_SECRET` — from Stripe dashboard webhook page (per env).
- `BREVO_API_KEY` — Brevo transactional API key.
- `AI_API_KEY` — replaces `LOVABLE_API_KEY` for `analyze-shoe-photos`.
- `CORS_ALLOW_ORIGINS` — comma-separated, defaults to `*`.

## Auth model — Supabase remains the source of truth

The backend does **not** issue or own user identity. Supabase is still the auth
provider for sign-in, sign-up, sessions, and password reset. The flow is:

```
Frontend ── supabase.auth.signInWith{Password,OAuth}() ──▶ Supabase
Frontend ◀── access_token (JWT) ──────────────────────── Supabase
Frontend ── apiFetch(...) attaches `Authorization: Bearer <jwt>` ─▶ Backend
Backend  ── supabase.auth.get_user(jwt) ──────────────────▶ Supabase (verifies)
Backend  ◀── user (id, email) ────────────────────────── Supabase
```

`backend/app/auth.py` exposes a single `CurrentUser` dependency. Routes that need
an authenticated caller declare it as a parameter and FastAPI rejects the request
with 401 if the JWT is missing/invalid.

| Endpoint | JWT required? | Why |
|---|---|---|
| `GET /health` | no | smoke check |
| `POST /checkout/` | **yes** | charges the calling user; ownership of the assessment/order is verified against `user.id` |
| `POST /stripe/webhook` | no | Stripe HMAC signature is verified instead (`STRIPE_WEBHOOK_SECRET`) |
| `POST /analyze-shoe-photos/` | **yes** | calls a paid AI gateway — must be authed |
| `POST /email/password-updated` | **yes** | sends to the calling user's own email |
| `POST /email/order-confirmation` | no | called from a Postgres trigger after order placement; identifies user via row payload |
| `POST /email/account-locked` | no | called from a Postgres trigger on lockout; identifies user via row payload |
| `POST /email/walkup-welcome` | no | called from admin-create flow; identifies user via payload + service-role lookup |
| `POST /email/service-unavailable` | no | called from internal admin tooling; identifies user via assessment row |

The four "no JWT" email endpoints mirror the original Edge Function behavior
(`verify_jwt = false` in `supabase/config.toml`). They are reachable only by
internal callers (DB triggers + admin tools) — exposing them publicly is a
deliberate trade-off matching the existing Lovable Cloud setup. Lock down later
by requiring a shared secret header if needed.

Frontend wiring: `src/integrations/api/client.ts` reads
`supabase.auth.getSession()` and adds `Authorization: Bearer <access_token>`
automatically on every `apiFetch` / `apiFetchJson` call. The frontend never
calls the email endpoints directly — those are server-to-server.

## Endpoints (1:1 with the Supabase Edge Functions)

| Method | Path                      | Replaces edge function     |
|--------|---------------------------|----------------------------|
| GET    | `/health`                 | —                          |
| POST   | `/checkout`               | `create-checkout`          |
| POST   | `/stripe/webhook`         | `stripe-webhook`           |
| POST   | `/analyze-shoe-photos`    | `analyze-shoe-photos`      |
| POST   | `/email/order-confirmation` | `send-order-confirmation` |
| POST   | `/email/account-locked`   | `send-account-locked`      |
| POST   | `/email/password-updated` | `send-password-updated`    |
| POST   | `/email/walkup-welcome`   | `send-walkup-welcome`      |
| POST   | `/email/service-unavailable` | `send-service-unavailable` |

## Frontend wiring (later)

Add `VITE_API_URL` to the frontend `.env` and replace `supabase.functions.invoke(...)`
calls with `fetch(\`${VITE_API_URL}/<endpoint>\`, ...)`. Until that switch is made,
both surfaces can coexist — Edge Functions stay live for fallback.
