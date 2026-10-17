# Setup and deployment

## Production Supabase project
Money Manager uses its own Supabase project, separate from FlowLedger.

- Project dashboard: https://supabase.com/dashboard/project/kchvzgocrsheqekanxoe
- Project URL: https://kchvzgocrsheqekanxoe.supabase.co
- Database schema: `supabase/schema.sql`
- Tables are user-scoped using PostgreSQL Row Level Security (RLS). The browser uses only the publishable/anon key; never use a service-role key in client code.

The production Vercel project is `money-manager`. Its public URLs include:
- https://money-manager-nu-dusky.vercel.app
- https://money-manager-aditya-kumars-projects-a61d8bf4.vercel.app

## Supabase setup
The schema has already been applied to the production project. For a fresh environment:
1. Open Supabase SQL Editor.
2. Run all of `supabase/schema.sql`.
3. Copy the project URL and publishable/anon key into `.env.local` using `.env.example`.

## Google OAuth (one-time dashboard configuration)
Google sign-in needs a Google OAuth web client. The credentials are not stored in this repository.

1. In Google Cloud Console, configure the OAuth consent screen and create a Web application OAuth client.
2. Add this Authorized redirect URI in Google Cloud Console:
   `https://kchvzgocrsheqekanxoe.supabase.co/auth/v1/callback`
3. In Supabase → Authentication → Sign In / Providers → Google, enable Google and enter the Google client ID and client secret.
4. In Supabase → Authentication → URL Configuration, set the Site URL to:
   `https://money-manager-nu-dusky.vercel.app`
5. Add these Additional Redirect URLs:
   - `https://money-manager-nu-dusky.vercel.app/**`
   - `https://money-manager-aditya-kumars-projects-a61d8bf4.vercel.app/**`
   - `http://localhost:3000/**`

Until the Google OAuth client ID and secret are configured in Supabase, Google sign-in will not complete.

## Local run
```bash
cp .env.example .env.local
npm install
npm run dev
```

## Vercel environment
The Vercel `money-manager` project is connected to this GitHub repository. These values are configured for Production, Preview, and Development:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Trigger a fresh deployment after changing environment values.

## Security and accounting model
- Direct browser access to Supabase is guarded by RLS; private rows must match `auth.uid()`.
- The app is a personal tracker, not a bank connector. Do not store bank or brokerage login credentials.
- Cash balance = opening balance + recorded income − recorded expense + manual balance adjustments. Investment holdings stay separate and do not automatically change account balances; record a transfer/expense separately when appropriate.
