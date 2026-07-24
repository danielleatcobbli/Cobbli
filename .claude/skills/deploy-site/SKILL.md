---
name: deploy-site
description: Publish Cobbli website changes to the internet (AWS Amplify), switch between the coming-soon page and the real site, or check the deploy status. Use whenever the user says things like "deploy", "publish my changes", "push the site live", "update the website", "put the new version up", "deploy to staging", "take the site live", or "put the site back into coming-soon mode".
---

# Deploy the Cobbli website

This skill publishes the Cobbli website. It is written so a non-technical person can just ask in plain language and the agent does the rest. Explain each step in everyday words and never assume the user knows the jargon.

## The two websites (say this plainly if asked)

- **The real site (staging)** → https://staging.d3b5kvxx3hwujt.amplifyapp.com
  The full, working website. This is where Danielle can **sign in, place test orders, click around, and show people**. It is not password-protected.
- **The public site (production)** → https://production.d3b5kvxx3hwujt.amplifyapp.com (and soon **cobbli.com**)
  What the world sees. Right now it shows a **"coming soon" waitlist page** to every visitor — on purpose, until launch.
  - Danielle can peek at the real site on this URL by adding **`?preview=45f72269b95bcf44f27bac43`** to the address. Keep that code private — it's like a key.

Data (accounts, orders, services, prices) lives in **Supabase**, which is already connected. Publishing the website does **not** change the data.

## How to publish changes

1. **Figure out which site.** If the user just says "deploy" without saying where, **use staging** and confirm before touching production — production is public.
2. Run:
   ```bash
   ./scripts/deploy-amplify.sh staging       # the real test site
   ./scripts/deploy-amplify.sh production     # the public site (keeps coming-soon on)
   ```
   This grabs the latest approved code (the `main` branch), builds the site, and puts it online. It takes 1–2 minutes.
3. When it says `✅ Live`, tell the user in plain words that it's published, give them the link, and remind them to **hard-refresh** (Cmd+Shift+R) if they don't see the change right away.

## "Take the site live" / launch day

When Danielle is ready to open cobbli.com to the public:
1. Turn off the coming-soon page: AWS Amplify console → app **cobbli** → **Hosting → Environment variables → production** → set `VITE_COMING_SOON` to `false`.
2. Re-publish: `./scripts/deploy-amplify.sh production`.
3. Check that https://production.d3b5kvxx3hwujt.amplifyapp.com now shows the real site to everyone.

To put the coming-soon page back, set `VITE_COMING_SOON` to `true` and re-publish.

## If something goes wrong (plain-language triage)

- **Data looks wrong or missing** → that's a Supabase (database) thing, not the website deploy. Don't retry the deploy.
- **The deploy fails while building** → the latest code has a bug; a developer needs to fix it. Report the error, don't guess-fix.
- **Domain / cobbli.com / sign-in redirect / AWS login problems** → these need **Henry** (set up the AWS + DNS). Point the user to him.

## Guardrails (important)

- **Production is public.** Always confirm before publishing to production or before flipping the coming-soon gate.
- **Don't commit or push code changes** as part of publishing unless the user explicitly asks.
- **Never put secret keys** (Stripe secret, Supabase service-role key) into the website settings — those belong only in Supabase Edge Functions. Only `VITE_…` values are safe here.

## Reference (for the agent, not the user)

- Amplify app id: `d3b5kvxx3hwujt` · region `us-east-1`
- Branches: `production` (gate on), `staging` (gate off)
- Ships from git branch: `main`
- Deploy is **manual** (no auto-deploy on git push yet). Connecting GitHub for automatic deploys is a future step Henry can do in the Amplify console.
