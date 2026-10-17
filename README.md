# Money Manager

A modern, responsive, frontend-first personal finance tracker built with Next.js, Supabase Auth (Google OAuth), PostgreSQL Row Level Security, and Vercel.

## Features

- Income, expenses, monthly budgets, and cash flow overview
- Separate bank accounts with opening/previous balances
- Separate investment portfolio tracking for stocks, mutual funds, ETFs, and gold
- Personal transaction history and categories
- Google sign-in using Supabase Auth
- User-isolated data via PostgreSQL RLS policies
- Responsive desktop, tablet, and mobile interface

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase JS client / Supabase Auth
- PostgreSQL with row-level security
- Vercel deployment from GitHub

## Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in Supabase SQL Editor.
3. In Supabase Authentication > Providers, enable Google and configure OAuth credentials.
4. Add the local development URL and deployed Vercel URL to Supabase Auth URL Configuration and Google OAuth redirect URIs as instructed in `docs/SETUP.md`.
5. Copy `.env.example` to `.env.local` and set the Supabase URL and anon/publishable key.
6. Run `npm install` then `npm run dev`.

Required variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Only the public/anon key is used by the browser client. Never put a Supabase service-role key in frontend code or Vercel public environment variables.

## Deployment

The Vercel project is linked to this GitHub repository. Configure the two public Supabase environment variables in Vercel, then deploy from the Vercel dashboard or push a new commit to `main`.

## Security model

All user-owned rows are scoped to `auth.uid()` with RLS on. A frontend-only app is appropriate for personal tracking, but business logic that must be unforgeable (for example privileged operations, external bank sync, or trusted server-side valuations) belongs in a trusted server/Edge Function. Do not store bank credentials or brokerage credentials in this app.