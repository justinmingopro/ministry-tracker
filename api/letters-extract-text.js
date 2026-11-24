// Extracts the text content of an already-uploaded Letters PDF and saves it
// to that row's `content` column, so the Letters tab can search what a
// letter actually says, not just whatever title/description was typed in
// when it was uploaded. Called by the browser right after it finishes
// uploading a PDF straight to Supabase Storage — this endpoint only ever
// receives a storage path + row id (a small JSON body), never the PDF
// itself, so it isn't subject to Vercel's request body size limit the way
// uploading the file through a serverless function would be.
import { createClient } from '@supabase/supabase-js';
import { PDFParse } from 'pdf-parse';

// Forwards the caller's own session so Postgrest/Storage see this as an
// authenticated request — same pattern as api/search.js's requireUser,
// since the "letters" bucket and table are both gated by a plain
// "authenticated" RLS policy, not a service-role bypass.
async function requireUser(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const anon = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data.user) return null;
  return token;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userToken = await requireUser(req);
  if (!userToken) return res.status(401).json({ error: 'Unauthorized' });

  const { letterId, storagePath } = req.body || {};
  if (!letterId || !storagePath) {
    return res.status(400).json({ error: 'Body must include letterId and storagePath' });
  }

  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${userToken}` } },
  });

  try {
    const { data: fileBlob, error: downloadError } = await supabase.storage.from('letters').download(storagePath);
    if (downloadError) throw new Error(`Download failed: ${downloadError.message}`);

    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    let text;
    try {
      const result = await parser.getText();
      text = result.text;
    } finally {
      await parser.destroy();
    }

    const { error: updateError } = await supabase.from('letters').update({ content: text }).eq('id', letterId);
    if (updateError) throw new Error(`Saving extracted text failed: ${updateError.message}`);

    return res.status(200).json({ characters: text.length });
  } catch (err) {
    console.error('Letter text extraction failed:', err);
    // Non-fatal from the UI's point of view — the letter itself is already
    // uploaded and viewable; it just won't be full-text searchable yet.
    return res.status(500).json({ error: err.message });
  }
}
