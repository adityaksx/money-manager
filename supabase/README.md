# Supabase schema

Run this script in the Supabase SQL Editor after creating your project. RLS is enabled on every user-owned table. For strongest isolation, use the included policies and verify transactions reference only accounts owned by the signed-in user. The browser app uses only the public anon/publishable key; never expose service-role credentials.
