# Get Roasted. Get Better. -- Phase 1

A mobile-responsive web app: auth, Gym Mode, and a live roast feed. Built
with React + Vite + Tailwind on the frontend, Supabase for auth/database/
storage/real-time on the backend.

**Phase 1 scope:** Login/Create Account/Profile (Screens 1-3), Gym Mode
(Screen 6), and a basic Live Feed with comments (Screens 10-11). Golf,
Bowling, Drinking modes and the full Groups UI (Screens 5, 7-9, 12-14)
are Phase 2.

## One-time setup (you'll need to do this part)

I can't create cloud accounts or run a live backend myself, so these
steps need to happen on your end before the app will actually run:

1. **Create a Supabase project** at [supabase.com](https://supabase.com)
   (free tier is plenty for testing). Note your project URL and anon key
   from Settings -> API.

2. **Run the database schema**: open your project's SQL Editor, paste in
   the contents of `supabase/schema.sql`, and run it. This creates all
   the tables, security policies, and seeds one shared "Beta Testers"
   group that every new signup auto-joins.

3. **Create a storage bucket for avatars**: Dashboard -> Storage -> New
   bucket -> name it exactly `avatars` -> toggle it **Public**. This is
   needed for the Profile photo upload to work.

4. **Set your environment variables**: copy `.env.example` to `.env.local`
   and fill in your project URL and anon key from step 1.

## Running it locally

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. On a phone, visiting the deployed URL
and using "Add to Home Screen" makes it behave like an installed app,
without any app-store submission.

## What's real vs. placeholder in this phase

- **Real and working**: email/password auth, profile editing with photo
  upload, Gym Mode set logging with automatic PR detection, the live
  feed (genuinely real-time via Supabase subscriptions -- a teammate's
  new post appears on your screen without refreshing), and text comments.
- **Visual placeholder, not wired**: the Google/Apple/Facebook/Amazon
  sign-in buttons on Create Account. Real OAuth needs each provider
  configured separately in Supabase's Auth settings -- happy to do that
  as a follow-up once you've confirmed you want those specific providers.
- **Not in this phase**: Golf, Bowling, Drinking modes, the Groups UI
  (currently everyone's just in one shared test group automatically),
  and image attachments on comments.

## About the Drinking Mode redesign

Per our discussion, the BAC-estimate-vs-legal-limit display from the
original mockup won't be built as shown -- a self-estimated BAC number
next to "legal limit" risks implying it's a reliable signal for whether
someone's okay to drive, which it isn't. When we get to Drinking Mode in
a later phase, the plan is a qualitative "parched to drenched" pace
scale instead, with no numeric percentage or legal-limit framing.

## Deploying for real testers

Once you've verified it locally, deploying to **Vercel** (free, connects
directly to a GitHub repo, auto-deploys on push) is the fastest path to
a real URL your testers can visit. Happy to walk through that whenever
you're ready -- same GitHub-based workflow you're already comfortable
with from the other projects.
