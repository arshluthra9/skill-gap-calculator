# SKILL GAP CALCULATOR

A Next.js + Tailwind + Supabase starter for a student career assessment platform.

## Run locally
1. Install Node.js 20+.
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and anon/publishable key.
4. Run `supabase/schema.sql` in the Supabase SQL Editor.
5. `npm run dev` and open http://localhost:3000.

## Important setup notes
- Never expose the Supabase `service_role` key in browser code. Only the anon/publishable key belongs in `NEXT_PUBLIC_...`.
- This starter includes a functional UI, browser-local assessment draft save, Supabase email/password auth, Supabase assessment/contact writes, scoring utility, page routes and a relational schema with RLS policies.
- Before public launch, implement server-side admin authorization, profile creation trigger/flow, production save/resume loading, tested-skill evidence workflow, server-side result persistence, validation/rate limits, email confirmation settings, backups and privacy/consent pages.
- The admin page is a protected-feature placeholder, not a production admin console yet. Do not expose student analytics until server-side authorization and policies are completed.
- Course and career entries shown in the UI are starter catalogue examples, not verified endorsements. Confirm course availability, cost and certificate conditions before publication.
- Scores are guidance based on configured skill weights and student inputs; they are not scientifically validated psychometric assessments.

## Deploy free (typical route)
1. Push this project to a private or public GitHub repository.
2. Create a free Supabase project and run `supabase/schema.sql`.
3. Import the repository into a Next.js-compatible host such as Vercel's free Hobby tier (review its current terms and limits).
4. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the hosting environment variables.
5. Deploy, test signup/login, assessment save, RLS and contact form using two separate student accounts.
6. Use the generated free subdomain initially. A custom domain normally costs money.

Free tiers and terms can change. 300–500 visitors total is a modest load, but simultaneous traffic, server functions, database storage and email quotas still need monitoring.
