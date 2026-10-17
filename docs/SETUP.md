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
- Stocks/ETFs currently use an unofficial Yahoo Finance chart endpoint through a server-side adapter. It can change, fail, or rate-limit. Yahoo terms restrict automated data collection without prior permission, so this integration is a personal-use prototype, not a licensed or guaranteed market-data service. Check the current Yahoo terms before use; do not rely on this adapter for a public/commercial product without permission or a properly licensed provider. Quotes may be delayed.
- Indian mutual funds use AMFI's daily NAV feed for the latest NAV. Date-specific historical NAV is looked up through MFAPI.in by scheme code; an ISIN is resolved to its current AMFI code first. These public data sources can be stale, unavailable, or change format, so a missing historical price must be entered manually.
- Automatic price lookups require an Indian rupee quote for now. Foreign-currency stocks are not converted into INR automatically, to avoid misleading portfolio totals.
- Gold, other assets, and unsupported tickers can use a manual per-unit price. If a historical quote is unavailable, enter the buy price manually.
- No broker account is connected. User-entered transaction history remains the source of units and cost basis.

## Transaction imports, refunds, categories, and personal debts
- Transactions can be imported from CSV, XLSX, or XLS files in the Transactions page. The first worksheet is read, with a preview before import. A template is available in the import dialog. Required fields are date and amount; a type column (income/expense) is strongly recommended. Optional columns are category, description, and account. Imports are limited to 1,000 rows at a time.
- Refunds attach to an expense transaction with a received date, amount, and note. Multiple partial refunds are supported, but the database rejects total refunds above the original expense. Refunds reduce net spending and are added back to cash for the original account.
- Default categories are added for each signed-in user. Custom income and expense categories are stored in the mm_categories table and can be managed from Transactions. The free-text category saved on each historical transaction is retained when a custom category is removed.
- The People page tracks amounts lent to friends and amounts borrowed, with dated, partial repayments. Loan and repayment actions create linked income/expense transactions so account cash balances update. Linked loan transactions cannot be deleted from the Transactions page while the People record depends on them.
- New tables use RLS: mm_transaction_refunds, mm_categories, mm_debts, and mm_debt_repayments. Refund and repayment totals are also validated in database triggers, not just in the form UI.

### Recommended import columns
~~~csv
date,type,amount,category,description,account
2026-10-17,expense,1200,Shopping,Flipkart order,Canara Savings
2026-10-17,income,45000,Salary,October salary,Canara Savings
~~~
Use positive amounts with type set to income or expense. The import wizard recognizes common date, narration/description, category, debit/credit, and account-column variants. It does not import refunds or personal debts as transaction types; record those using the dedicated features after importing.

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
