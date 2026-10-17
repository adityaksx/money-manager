# Setup and deployment

## Production Supabase project
Money Manager uses its own Supabase project, separate from FlowLedger.

- Project dashboard: https://supabase.com/dashboard/project/kchvzgocrsheqekanxoe
- Project URL: https://kchvzgocrsheqekanxoe.supabase.co
- Database schema: `supabase/schema.sql`
- All personal rows are protected by PostgreSQL Row Level Security (RLS). The browser uses only the publishable/anon key; never use a service-role key in client code.

## Investment tracking and market prices
- Investments are assets with a dated buy/sell activity ledger in `mm_investment_transactions`.
- Cost basis and realized profit/loss use weighted-average cost. Open-position market value is units multiplied by the latest saved price.
- Stocks/ETFs use a Yahoo Finance chart endpoint through a server-side adapter. Yahoo's public chart access is unofficial, can change or rate-limit, and is not a supported commercial market-data API. Quotes may be delayed; check current Yahoo terms before relying on the source beyond personal use.
- Indian mutual funds use AMFI NAV feeds. The symbol should be an AMFI scheme code or ISIN.
- Automatic price lookups require an Indian rupee quote for now. Foreign-currency stocks are not converted into INR automatically, to avoid misleading portfolio totals.
- Gold, other assets, and unsupported tickers can use a manual per-unit price. If a historical quote is unavailable, enter the buy price manually.
- No broker account is connected. User-entered transaction history remains the source of units and cost basis.

## Google OAuth setup
1. In Google Cloud Console, create a Web application OAuth client.
2. Add this Authorized redirect URI in Google Cloud Console:
   `https://kchvzgocrsheqekanxoe.supabase.co/auth/v1/callback`
3. In Supabase → Authentication → Sign In / Providers → Google, enable Google and enter the Google client ID and client secret.
4. In Supabase → Authentication → URL Configuration, set the Site URL to `https://money-manager-nu-dusky.vercel.app`.
5. Add these Additional Redirect URLs:
   - `https://money-manager-nu-dusky.vercel.app/**`
   - `https://money-manager-aditya-kumars-projects-a61d8bf4.vercel.app/**`
   - `http://localhost:3000/**`

## Local run
```bash
cp .env.example .env.local
npm install
npm run dev
```

## Vercel environment
The Vercel `money-manager` project is connected to this GitHub repository. These public environment variables are configured for Production, Preview, and Development:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Accounting model
- Cash balance = opening balance + recorded income − recorded expense + manual balance adjustments.
- Investment holdings remain separate from bank account balances.
- Investment buy/sell records affect units and cost basis but do not automatically change a linked bank account's cash balance. Record the cash-side transaction separately if you need a complete cash-flow ledger.
