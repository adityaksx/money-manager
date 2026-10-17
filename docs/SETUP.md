# Setup and deployment

## Supabase project
1. Create a Supabase project and open SQL Editor. Run all of `supabase/schema.sql`.
2. Copy the project URL and public anon/publishable key from Project Settings → API into `.env.local` using `.env.example`. Never use the service-role key in the browser.

## Google OAuth
1. In Google Cloud Console, configure the OAuth consent screen and create a Web application OAuth client.
2. Add the Supabase Auth callback URL shown in Supabase → Authentication → Providers → Google as an Authorized redirect URI in Google.
3. Enter the Google client ID and secret in Supabase → Authentication → Sign In / Providers → Google, then enable Google.
4. In Supabase → Authentication → URL Configuration, set Site URL to `http://localhost:3000` and add your Vercel production URL to Additional Redirect URLs.

## Local run
```bash
cp .env.example .env.local
npm install
npm run dev
```

## Vercel
The Vercel project `money-manager` has been linked to this GitHub repository. In Vercel → Project → Settings → Environment Variables, add these values for Production, Preview, and Development:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Trigger a deployment after setting the values.

## Security and accounting model
- Direct browser access to Supabase is guarded by RLS; all private rows must match `auth.uid()`.
- The app is a personal tracker, not a bank connector. Do not store bank or brokerage login credentials.
- Cash balance = opening balance + recorded income − recorded expense + manual balance adjustments. Investment holdings stay separate and do not automatically change account balances; record a transfer/expense separately when appropriate.
