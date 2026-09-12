// ONE-TIME bootstrap: creates the app's first (and only) login user directly
// via Supabase's admin API, bypassing the dashboard's Add User / Invite flows
// entirely. Self-limiting by design — it refuses to run once any user
// already exists, so it can only ever create the first account. Delete this
// file once it's done its job; it has no reason to stay in the app.
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Body must be { email, password }' });
  }

  // .trim() guards against a stray trailing newline/space from copy-pasting
  // the key into Vercel's env var field — a common cause of "Invalid API key".
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Supabase not configured (missing SUPABASE_SERVICE_ROLE_KEY)' });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: existing, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) {
    console.error('listUsers error:', listErr);
    return res.status(500).json({ error: listErr.message, details: JSON.stringify(listErr, Object.getOwnPropertyNames(listErr)) });
  }
  if (existing.users.length > 0) {
    return res.status(403).json({ error: 'A user already exists — this bootstrap endpoint only ever creates the first one.' });
  }

  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    console.error('createUser error:', error);
    return res.status(500).json({
      error: error.message || 'Unknown error',
      status: error.status,
      code: error.code,
      details: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    });
  }

  return res.status(200).json({ ok: true, userId: data.user.id });
}
