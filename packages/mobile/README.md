# @lectio/mobile

The Lectio mobile app — [Expo](https://expo.dev/) (SDK 56) / React Native with
Expo Router + TypeScript, for iOS and Android. It runs in
[Expo Go](https://expo.dev/go) (no native/dev-client build) and reuses the
shared planner logic from `@lectio/core`. Semesters sync through Supabase behind
email/password sign-in.

## Setup

1. Install workspace deps from the **repo root**: `npm install`.
2. Create a Supabase project, then copy `.env.example` → `.env` here and fill in:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

   The app needs a `public.semesters` table (JSON `data` column, primary key
   `(user_id, id)`) with Row Level Security restricting rows to their owner.

## Run

From the repo root: `npm run mobile` (or `npm run mobile:ios` /
`npm run mobile:android`). Scan the QR code with Expo Go. Typecheck with
`npm run typecheck --workspace @lectio/mobile`.

## Status

Early preview — browse semesters/courses, view progress, and tap items to cycle
tags. Content editing and the other desktop features are not ported yet; gaps
are tracked in [`../../docs/PENDING_FEATURES.md`](../../docs/PENDING_FEATURES.md).
