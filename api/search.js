// Research assistant: answers a question using wol.jw.org (via Claude's
// server-executed web_search tool, restricted to that domain) plus the
// user's own personal notes (study_notes + bear_notes), so the answer can
// draw on both and say clearly which is which.
import { createClient } from '@supabase/supabase-js';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'is', 'are',
  'was', 'were', 'what', 'why', 'how', 'when', 'where', 'who', 'does', 'do',
  'did', 'can', 'should', 'would', 'could', 'about', 'with', 'that', 'this',
  'it', 'be', 'been', 'have', 'has', 'had', 'i', 'we', 'you', 'my', 'our',
  'me', 'us', 'all', 'any', 'not',
]);

function extractKeywords(text) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9:\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return [...new Set(words)].slice(0, 8);
}

async function findRelevantNotes(supabase, question) {
  const keywords = extractKeywords(question);
  if (keywords.length === 0) return [];

  const studyOr = keywords
    .map((k) => `title.ilike.%${k}%,content.ilike.%${k}%,scripture_ref.ilike.%${k}%,publication_ref.ilike.%${k}%`)
    .join(',');
  const bearOr = keywords.map((k) => `title.ilike.%${k}%,content.ilike.%${k}%`).join(',');

  const [studyRes, bearRes] = await Promise.all([
    supabase.from('study_notes').select('*').or(studyOr).limit(10),
    supabase.from('bear_notes').select('*').or(bearOr).limit(10),
  ]);

  const study = (studyRes.data || []).map((n) => ({
    source: 'JW Library note',
    title: n.title,
    ref: n.scripture_ref || n.publication_ref || '',
    content: n.content || '',
  }));
  const bear = (bearRes.data || []).map((n) => ({
    source: 'Bear note',
    title: n.title,
    ref: (n.scripture_refs || []).map((r) => r.ref).join(', '),
    content: n.content || '',
  }));
  return [...study, ...bear];
}

function buildNotesContext(notes) {
  if (notes.length === 0) return '';
  return notes
    .map((n, i) => {
      const heading = `[Note ${i + 1} — ${n.source}${n.title ? `: "${n.title}"` : ''}${n.ref ? ` (${n.ref})` : ''}]`;
      return `${heading}\n${n.content.slice(0, 1500)}`;
    })
    .join('\n\n');
}

// Verifies the caller sent a real Supabase session (not just the public anon
// key) — required both so this doesn't run up API costs for randoms who find
// the URL, and because RLS on study_notes/bear_notes means an unauthenticated
// request would see no notes anyway.
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
  if (req.method !== 'POST') return res.status(405).end();

  const { question, thread = [] } = req.body || {};
  if (!question) return res.status(400).json({ error: 'No question provided' });

  const userToken = await requireUser(req);
  if (!userToken) return res.status(401).json({ error: 'Unauthorized' });

  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
  // Forward the caller's own session so Postgrest/RLS sees this as an
  // authenticated request, rather than reaching for a service-role key for
  // what's just a read on the logged-in user's own notes.
  const supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: `Bearer ${userToken}` } } })
    : null;

  let notesContext = '';
  try {
    if (supabase) notesContext = buildNotesContext(await findRelevantNotes(supabase, question));
  } catch (err) {
    console.error('Notes lookup failed (continuing with wol.jw.org only):', err);
  }

  const SYSTEM_PROMPT = `You are a research assistant for a Jehovah's Witness doing ministry and
personal Bible study. Answer questions using up to two sources:

1. wol.jw.org (the Watchtower Online Library) — use the web_search tool, and ONLY search
   wol.jw.org content.
2. The user's own personal notes (imported from JW Library and Bear), given below when any
   are relevant to this question.

RULES:
1. Prefer wol.jw.org for doctrinal or factual claims — include direct links.
2. When a personal note is relevant, weave it in and say clearly it's from "your notes"
   (mentioning its title if it has one) — never present your own notes as wol.jw.org content
   or vice versa.
3. If personal notes were provided but none are actually relevant to this question, ignore
   them silently — don't mention their absence.
4. If the topic isn't found on wol.jw.org, say so clearly.
5. Write in clear paragraphs. No markdown headers or bullet symbols.
${notesContext ? `\nPERSONAL NOTES that may be relevant to this question:\n\n${notesContext}` : ''}`;

  const messages = [];
  for (const turn of thread) {
    messages.push({ role: 'user', content: turn.q });
    messages.push({ role: 'assistant', content: [{ type: 'text', text: turn.a }] });
  }
  messages.push({ role: 'user', content: question });

  // Stream newline-delimited output so the connection stays active during
  // long searches — a fully silent multi-second request can get dropped by
  // mobile networks/proxies as "idle" even though the function is still
  // working. Heartbeats keep data flowing until the real payload (the final
  // line) is ready.
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
  const heartbeat = setInterval(() => res.write('\n'), 10000);
  const finish = (payload) => {
    clearInterval(heartbeat);
    res.write(JSON.stringify(payload) + '\n');
    res.end();
  };

  try {
    // Agentic loop — keep going until Claude stops using tools. Capped so a
    // stuck pause_turn/tool_use cycle can't run indefinitely within the
    // function's time budget.
    const MAX_TURNS = 8;
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-5',
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          tools: [{
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 5,
            allowed_domains: ['wol.jw.org'],
          }],
          messages,
        }),
      });

      const data = await response.json();

      if (data.error) throw new Error(data.error.message);

      messages.push({ role: 'assistant', content: data.content });

      if (data.stop_reason === 'end_turn' || data.stop_reason === 'max_tokens') {
        const answer = data.content
          .filter((b) => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim();

        if (answer) return finish({ answer, notesUsed: notesContext ? true : false });
        throw new Error(`No answer text returned (stop_reason: ${data.stop_reason})`);
      }

      // Server-executed tool (web_search) needs another turn to continue —
      // the assistant content is already appended above, just call again.
      if (data.stop_reason === 'pause_turn') continue;

      if (data.stop_reason === 'tool_use') {
        const toolResults = data.content
          .filter((b) => b.type === 'tool_use')
          .map((b) => ({
            type: 'tool_result',
            tool_use_id: b.id,
            content: b.input?.query
              ? `Search performed for: ${b.input.query}`
              : 'Search completed',
          }));

        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      throw new Error(`Unexpected stop_reason: ${data.stop_reason}`);
    }

    throw new Error(`Search took too many turns (limit: ${MAX_TURNS})`);
  } catch (err) {
    console.error('Research assistant error:', err);
    finish({ error: err.message });
  }
}
