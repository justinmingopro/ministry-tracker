// Receives Bear notes (pushed from an iOS Shortcut, not scraped from a database —
// Bear's local DB isn't reachable from anywhere but the device itself) and upserts
// them into Supabase, parsing scripture references out of ==highlighted== spans.
import { createClient } from '@supabase/supabase-js';

const BOOK_NUMBERS = {
  genesis: 1, gen: 1, ge: 1,
  exodus: 2, exo: 2, ex: 2,
  leviticus: 3, lev: 3,
  numbers: 4, num: 4, nu: 4,
  deuteronomy: 5, deut: 5, dt: 5,
  joshua: 6, josh: 6,
  judges: 7, judg: 7, jdg: 7,
  ruth: 8,
  '1 samuel': 9, '1samuel': 9, '1 sam': 9, '1sam': 9, '1sa': 9,
  '2 samuel': 10, '2samuel': 10, '2 sam': 10, '2sam': 10, '2sa': 10,
  '1 kings': 11, '1kings': 11, '1 ki': 11, '1kgs': 11,
  '2 kings': 12, '2kings': 12, '2 ki': 12, '2kgs': 12,
  '1 chronicles': 13, '1chronicles': 13, '1 chron': 13, '1chr': 13, '1 ch': 13,
  '2 chronicles': 14, '2chronicles': 14, '2 chron': 14, '2chr': 14, '2 ch': 14,
  ezra: 15,
  nehemiah: 16, neh: 16,
  esther: 17, esth: 17, est: 17,
  job: 18,
  psalms: 19, psalm: 19, psa: 19, ps: 19,
  proverbs: 20, prov: 20, pr: 20,
  ecclesiastes: 21, eccl: 21, ecc: 21,
  'song of solomon': 22, 'song of songs': 22, song: 22, sos: 22,
  isaiah: 23, isa: 23,
  jeremiah: 24, jer: 24,
  lamentations: 25, lam: 25,
  ezekiel: 26, ezek: 26, eze: 26,
  daniel: 27, dan: 27,
  hosea: 28, hos: 28,
  joel: 29,
  amos: 30,
  obadiah: 31, obad: 31,
  jonah: 32,
  micah: 33, mic: 33,
  nahum: 34, nah: 34,
  habakkuk: 35, hab: 35,
  zephaniah: 36, zeph: 36,
  haggai: 37, hag: 37,
  zechariah: 38, zech: 38,
  malachi: 39, mal: 39,
  matthew: 40, matt: 40, mt: 40,
  mark: 41, mk: 41,
  luke: 42, lk: 42,
  john: 43, jn: 43,
  acts: 44,
  romans: 45, rom: 45,
  '1 corinthians': 46, '1corinthians': 46, '1 cor': 46, '1cor': 46,
  '2 corinthians': 47, '2corinthians': 47, '2 cor': 47, '2cor': 47,
  galatians: 48, gal: 48,
  ephesians: 49, eph: 49,
  philippians: 50, phil: 50,
  colossians: 51, col: 51,
  '1 thessalonians': 52, '1thessalonians': 52, '1 thess': 52, '1thess': 52,
  '2 thessalonians': 53, '2thessalonians': 53, '2 thess': 53, '2thess': 53,
  '1 timothy': 54, '1timothy': 54, '1 tim': 54, '1tim': 54,
  '2 timothy': 55, '2timothy': 55, '2 tim': 55, '2tim': 55,
  titus: 56,
  philemon: 57, philem: 57, phm: 57,
  hebrews: 58, heb: 58,
  james: 59, jas: 59,
  '1 peter': 60, '1peter': 60, '1 pet': 60, '1pet': 60, '1pe': 60,
  '2 peter': 61, '2peter': 61, '2 pet': 61, '2pet': 61, '2pe': 61,
  '1 john': 62, '1john': 62, '1jn': 62,
  '2 john': 63, '2john': 63, '2jn': 63,
  '3 john': 64, '3john': 64, '3jn': 64,
  jude: 65,
  revelation: 66, rev: 66,
};

const BOOK_NAMES = {
  1: 'Genesis', 2: 'Exodus', 3: 'Leviticus', 4: 'Numbers', 5: 'Deuteronomy',
  6: 'Joshua', 7: 'Judges', 8: 'Ruth', 9: '1 Samuel', 10: '2 Samuel',
  11: '1 Kings', 12: '2 Kings', 13: '1 Chronicles', 14: '2 Chronicles',
  15: 'Ezra', 16: 'Nehemiah', 17: 'Esther', 18: 'Job', 19: 'Psalms',
  20: 'Proverbs', 21: 'Ecclesiastes', 22: 'Song of Solomon', 23: 'Isaiah',
  24: 'Jeremiah', 25: 'Lamentations', 26: 'Ezekiel', 27: 'Daniel',
  28: 'Hosea', 29: 'Joel', 30: 'Amos', 31: 'Obadiah', 32: 'Jonah',
  33: 'Micah', 34: 'Nahum', 35: 'Habakkuk', 36: 'Zephaniah', 37: 'Haggai',
  38: 'Zechariah', 39: 'Malachi', 40: 'Matthew', 41: 'Mark', 42: 'Luke',
  43: 'John', 44: 'Acts', 45: 'Romans', 46: '1 Corinthians',
  47: '2 Corinthians', 48: 'Galatians', 49: 'Ephesians', 50: 'Philippians',
  51: 'Colossians', 52: '1 Thessalonians', 53: '2 Thessalonians',
  54: '1 Timothy', 55: '2 Timothy', 56: 'Titus', 57: 'Philemon',
  58: 'Hebrews', 59: 'James', 60: '1 Peter', 61: '2 Peter', 62: '1 John',
  63: '2 John', 64: '3 John', 65: 'Jude', 66: 'Revelation',
};

// Matches "Book Chapter:Verse", optionally followed by more verses/ranges in the
// same chapter separated by commas or dashes (e.g. "Acts 17:26, 27" or "Jer 29:11-13").
// Deliberately stops at ";" rather than trying to follow semicolon-separated
// multi-chapter citations (e.g. "Jer 48:1, 7; 49:1, 4") — under-matching there is
// safer than misparsing "49" as a verse of chapter 48.
const REF_PATTERN = /(\d?\s?[A-Za-z][A-Za-z .]*?)\s+(\d{1,3}):(\d{1,3})((?:[-–,]\s*\d{1,3})*)/g;

function parseScriptureRefs(text) {
  if (!text) return [];
  const refs = [];
  const seen = new Set();

  // Only look inside ==highlighted== spans.
  const highlights = text.match(/==([^=]+)==/g) || [];
  for (const h of highlights) {
    const inner = h.slice(2, -2);
    REF_PATTERN.lastIndex = 0;
    let m;
    while ((m = REF_PATTERN.exec(inner))) {
      const bookKey = m[1].trim().toLowerCase().replace(/\s+/g, ' ');
      const bookNum = BOOK_NUMBERS[bookKey];
      if (!bookNum) continue;
      const chapter = parseInt(m[2], 10);
      const verseStart = parseInt(m[3], 10);
      const restVerses = (m[4].match(/\d+/g) || []).map(Number);
      const verseEnd = restVerses.length > 0 ? Math.max(verseStart, ...restVerses) : verseStart;
      const key = `${bookNum}-${chapter}-${verseStart}-${verseEnd}`;
      if (seen.has(key)) continue;
      seen.add(key);
      refs.push({
        ref: `${BOOK_NAMES[bookNum]} ${chapter}:${verseStart}${verseEnd !== verseStart ? '-' + verseEnd : ''}`,
        book: BOOK_NAMES[bookNum],
        chapter,
        verse_start: verseStart,
        verse_end: verseEnd,
      });
    }
  }
  return refs;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const importToken = process.env.BEAR_IMPORT_TOKEN;
  if (importToken) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${importToken}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  // Uses the service-role key, not the anon key: this endpoint is hit by a
  // non-interactive iOS Shortcut with no Supabase user session to present,
  // so once RLS requires an authenticated session the anon key alone can no
  // longer write here. BEAR_IMPORT_TOKEN above is what actually gates access.
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured (missing SUPABASE_SERVICE_ROLE_KEY)' });
  }

  const { notes } = req.body || {};
  if (!Array.isArray(notes) || notes.length === 0) {
    return res.status(400).json({ error: 'Body must be { notes: [...] }' });
  }

  const rows = notes.map((n) => ({
    bear_note_id: n.id,
    title: n.title || null,
    content: n.content || '',
    scripture_refs: parseScriptureRefs(n.content || ''),
    tags: n.tags || [],
    note_created_at: n.created || null,
    note_modified_at: n.modified || null,
  }));

  const invalid = rows.filter((r) => !r.bear_note_id);
  if (invalid.length > 0) {
    return res.status(400).json({ error: `${invalid.length} note(s) missing an id` });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { error } = await supabase.from('bear_notes').upsert(rows, { onConflict: 'bear_note_id' });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const totalRefs = rows.reduce((sum, r) => sum + r.scripture_refs.length, 0);
  return res.status(200).json({ imported: rows.length, scriptureRefsFound: totalRefs });
}
