// Supabase Edge Function: delete-account
//
// Deletes the calling user's auth account (and, via ON DELETE CASCADE on the
// semesters table's user FK, all of their semesters). A client with the anon key
// CANNOT delete its own auth user — that requires the service_role key, which must
// NEVER ship in the app or be committed to the repo. This function runs server-side
// where the Supabase runtime injects SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY into
// the environment; the key lives only here, never in the React Native bundle.
//
// Deploy with:  supabase functions deploy delete-account
//
// The client calls it with the user's JWT (supabase.functions.invoke forwards the
// Authorization header automatically); we verify that token to identify the caller,
// then delete that exact user with the admin API.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Missing access token.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service-role client — env injected by the Supabase runtime, not the app.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the JWT and resolve the caller's user id.
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete that user. Their semesters cascade away via the FK.
    const { error: delErr } = await admin.auth.admin.deleteUser(userData.user.id);
    if (delErr) {
      return new Response(JSON.stringify({ error: delErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error)?.message ?? 'Unexpected error.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
