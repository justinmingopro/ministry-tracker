// Cloud-based JW Library import: a Vercel Cron Job hits this endpoint daily.
// It pulls the most recently modified .jwlibrary backup from a Google Drive
// folder (shared with a service account), reads the SQLite database inside
// it, and upserts the notes into Supabase's study_notes table — the same
// job scripts/import_jwlibrary.py does, just running entirely in the cloud
// instead of needing a computer on at home to read a locally-synced
// iCloud Drive file. See the README's "Importing JW Library notes" section
// for the one-time Google Cloud + Drive setup this depends on.
import { createClient } from '@supabase/supabase-js';
import { DatabaseSync } from 'node:sqlite';
import AdmZip from 'adm-zip';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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

function buildScriptureRef(bookNumber, chapter, verse) {
  const book = BOOK_NAMES[bookNumber];
  if (!book || !chapter) return { ref: null, book: null };
  let ref = `${book} ${chapter}`;
  if (verse) ref += `:${verse}`;
  return { ref, book };
}

// Mirrors scripts/import_jwlibrary.py's extract_notes() exactly, reading
// from the same JW Library schema (Note/Location/Tag/TagMap).
export function extractNotes(dbBuffer) {
  const tmpPath = path.join(os.tmpdir(), `jwlibrary-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  fs.writeFileSync(tmpPath, dbBuffer);
  try {
    const db = new DatabaseSync(tmpPath, { readOnly: true });
    try {
      const tagsByNote = {};
      const tagRows = db.prepare(`
        select tm.NoteId as noteId, t.Name as name from TagMap tm
        join Tag t on t.TagId = tm.TagId
        where tm.NoteId is not null
        order by tm.NoteId, tm.Position
      `).all();
      for (const row of tagRows) {
        (tagsByNote[row.noteId] ||= []).push(row.name);
      }

      const noteRows = db.prepare(`
        select n.NoteId as noteId, n.Guid as guid, n.Title as title, n.Content as content,
               n.Created as created, n.LastModified as lastModified,
               n.BlockType as blockType, n.BlockIdentifier as blockIdentifier,
               l.BookNumber as bookNumber, l.ChapterNumber as chapterNumber,
               l.DocumentId as documentId, l.KeySymbol as keySymbol, l.Title as locTitle
        from Note n
        left join Location l on n.LocationId = l.LocationId
      `).all();

      const notes = [];
      for (const row of noteRows) {
        if (!row.content && !row.title) continue; // skip empty notes

        const isVerseLevel = Boolean(row.bookNumber) && (row.blockType === 1 || row.blockType === 2);
        const verse = isVerseLevel ? row.blockIdentifier : null;
        const { ref: scriptureRef, book: scriptureBook } = buildScriptureRef(row.bookNumber, row.chapterNumber, verse);

        let publicationRef = null;
        if (row.documentId && !row.bookNumber) {
          publicationRef = row.keySymbol || row.locTitle || null;
          if (row.locTitle && row.locTitle !== publicationRef) {
            publicationRef = `${publicationRef} — ${row.locTitle}`;
          }
          if (row.blockType === 1 && row.blockIdentifier) {
            publicationRef = `${publicationRef}, ¶${row.blockIdentifier}`;
          }
        }

        notes.push({
          jwlibrary_note_id: row.guid,
          title: row.title || null,
          content: row.content || '',
          scripture_ref: scriptureRef,
          scripture_book: scriptureBook,
          scripture_chapter: row.bookNumber ? row.chapterNumber : null,
          scripture_verse_start: verse,
          scripture_verse_end: verse,
          publication_ref: publicationRef,
          tags: tagsByNote[row.noteId] || [],
          note_created_at: row.created,
          note_modified_at: row.lastModified,
        });
      }
      return notes;
    } finally {
      db.close();
    }
  } finally {
    fs.unlinkSync(tmpPath);
  }
}

function base64url(input) {
  return Buffer.from(JSON.stringify(input)).toString('base64url');
}

// Server-to-server OAuth2 (JWT Bearer flow) — no interactive login, no
// refresh token to manage, just the service account's own key signing a
// short-lived assertion. Scoped read-only: this never needs to write to Drive.
async function getGoogleAccessToken(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url({ alg: 'RS256', typ: 'JWT' })}.${base64url({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url');

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`Google auth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function findLatestBackup(accessToken, folderId) {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime desc&pageSize=10&fields=files(id,name,modifiedTime)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`Drive file list failed: ${JSON.stringify(data)}`);
  const file = (data.files || []).find((f) => f.name.toLowerCase().endsWith('.jwlibrary'));
  if (!file) throw new Error('No .jwlibrary file found in the configured Drive folder');
  return file;
}

async function downloadFile(accessToken, fileId) {
  const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) throw new Error(`Drive download failed (HTTP ${resp.status})`);
  return Buffer.from(await resp.arrayBuffer());
}

export default async function handler(req, res) {
  // Vercel sends this automatically on cron-triggered invocations when
  // CRON_SECRET is set; it's what stops anyone else from hitting this URL
  // and triggering an import (or running up Google/Supabase API usage).
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  // Vercel's env var editor can't hold real newlines, so the key is stored
  // with literal "\n" escapes and unescaped here.
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const folderId = process.env.GOOGLE_DRIVE_JWLIBRARY_FOLDER_ID;

  const missing = [
    !supabaseUrl && 'REACT_APP_SUPABASE_URL',
    !supabaseKey && 'SUPABASE_SERVICE_ROLE_KEY',
    !clientEmail && 'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    !privateKey && 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
    !folderId && 'GOOGLE_DRIVE_JWLIBRARY_FOLDER_ID',
  ].filter(Boolean);
  if (missing.length > 0) {
    return res.status(500).json({ error: `Missing env var(s): ${missing.join(', ')}` });
  }

  try {
    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
    const file = await findLatestBackup(accessToken, folderId);
    const zipBuffer = await downloadFile(accessToken, file.id);

    const zip = new AdmZip(zipBuffer);
    const dbEntry = zip.getEntries().find((e) => e.entryName.endsWith('.db'));
    if (!dbEntry) throw new Error('No .db file found inside the .jwlibrary backup');

    const notes = extractNotes(dbEntry.getData());

    const supabase = createClient(supabaseUrl, supabaseKey);
    const BATCH_SIZE = 300;
    for (let i = 0; i < notes.length; i += BATCH_SIZE) {
      const batch = notes.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('study_notes').upsert(batch, { onConflict: 'jwlibrary_note_id' });
      if (error) throw new Error(`Supabase upsert failed at note ${i}: ${error.message}`);
    }

    return res.status(200).json({
      file: file.name,
      modifiedTime: file.modifiedTime,
      notesFound: notes.length,
    });
  } catch (err) {
    console.error('JW Library cloud import failed:', err);
    return res.status(500).json({ error: err.message });
  }
}
