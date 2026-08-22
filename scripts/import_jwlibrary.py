#!/usr/bin/env python3
"""Import JW Library notes from a .jwlibrary backup into Supabase's study_notes table.

Usage:
    python import_jwlibrary.py [path-to-backup.jwlibrary]

If no path is given, uses the most recently modified *.jwlibrary file in
JWLIBRARY_BACKUP_DIR (defaults to ~/iCloudDrive).

Safe to run repeatedly (e.g. daily via Task Scheduler, right after the backup
lands): notes are upserted on their JW Library Guid, so re-imports update
existing rows instead of duplicating them. Notes deleted in JW Library are
NOT deleted here — this is a one-way archive, not a mirror.

Requires SUPABASE_URL and SUPABASE_ANON_KEY, either as environment variables
or in a .env.local / .env file in this script's directory (REACT_APP_-prefixed
names are also recognized, since that's what the React app uses).

No third-party dependencies — stdlib only, so no pip install is needed before
running this from a scheduled task.
"""
import glob
import json
import os
import sqlite3
import sys
import tempfile
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

BOOK_NAMES = {
    1: "Genesis", 2: "Exodus", 3: "Leviticus", 4: "Numbers", 5: "Deuteronomy",
    6: "Joshua", 7: "Judges", 8: "Ruth", 9: "1 Samuel", 10: "2 Samuel",
    11: "1 Kings", 12: "2 Kings", 13: "1 Chronicles", 14: "2 Chronicles",
    15: "Ezra", 16: "Nehemiah", 17: "Esther", 18: "Job", 19: "Psalms",
    20: "Proverbs", 21: "Ecclesiastes", 22: "Song of Solomon", 23: "Isaiah",
    24: "Jeremiah", 25: "Lamentations", 26: "Ezekiel", 27: "Daniel",
    28: "Hosea", 29: "Joel", 30: "Amos", 31: "Obadiah", 32: "Jonah",
    33: "Micah", 34: "Nahum", 35: "Habakkuk", 36: "Zephaniah", 37: "Haggai",
    38: "Zechariah", 39: "Malachi", 40: "Matthew", 41: "Mark", 42: "Luke",
    43: "John", 44: "Acts", 45: "Romans", 46: "1 Corinthians",
    47: "2 Corinthians", 48: "Galatians", 49: "Ephesians", 50: "Philippians",
    51: "Colossians", 52: "1 Thessalonians", 53: "2 Thessalonians",
    54: "1 Timothy", 55: "2 Timothy", 56: "Titus", 57: "Philemon",
    58: "Hebrews", 59: "James", 60: "1 Peter", 61: "2 Peter", 62: "1 John",
    63: "2 John", 64: "3 John", 65: "Jude", 66: "Revelation",
}

DEFAULT_BACKUP_DIR = os.path.expanduser("~/iCloudDrive")
BATCH_SIZE = 300


def load_env():
    env = dict(os.environ)
    for fname in (".env.local", ".env"):
        path = Path(__file__).resolve().parent.parent / fname
        if path.exists():
            for line in path.read_text().splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                env.setdefault(k.strip(), v.strip())
    url = env.get("SUPABASE_URL") or env.get("REACT_APP_SUPABASE_URL")
    key = env.get("SUPABASE_ANON_KEY") or env.get("REACT_APP_SUPABASE_ANON_KEY")
    if not url or not key:
        sys.exit("Missing SUPABASE_URL/SUPABASE_ANON_KEY (checked env vars and .env.local/.env in the repo root)")
    return url.rstrip("/"), key


def find_latest_backup(directory):
    files = sorted(glob.glob(os.path.join(directory, "*.jwlibrary")), key=os.path.getmtime)
    if not files:
        sys.exit(f"No .jwlibrary backups found in {directory}")
    return files[-1]


def extract_db(backup_path, tmpdir):
    with zipfile.ZipFile(backup_path) as z:
        db_name = next(n for n in z.namelist() if n.endswith(".db"))
        z.extract(db_name, tmpdir)
        return os.path.join(tmpdir, db_name)


def build_scripture_ref(book_number, chapter, verse):
    book = BOOK_NAMES.get(book_number)
    if not book or not chapter:
        return None, None
    ref = f"{book} {chapter}"
    if verse:
        ref += f":{verse}"
    return ref, book


def extract_notes(db_path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    tags_by_note = {}
    for row in cur.execute("""
        select tm.NoteId, t.Name from TagMap tm
        join Tag t on t.TagId = tm.TagId
        where tm.NoteId is not null
        order by tm.NoteId, tm.Position
    """):
        tags_by_note.setdefault(row["NoteId"], []).append(row["Name"])

    notes = []
    for row in cur.execute("""
        select n.NoteId, n.Guid, n.Title, n.Content, n.Created, n.LastModified,
               n.BlockType, n.BlockIdentifier,
               l.BookNumber, l.ChapterNumber, l.DocumentId, l.KeySymbol, l.Title as LocTitle
        from Note n
        left join Location l on n.LocationId = l.LocationId
    """):
        if not row["Content"] and not row["Title"]:
            continue  # skip empty notes

        is_verse_level = bool(row["BookNumber"]) and row["BlockType"] in (1, 2)
        verse = row["BlockIdentifier"] if is_verse_level else None
        scripture_ref, scripture_book = build_scripture_ref(row["BookNumber"], row["ChapterNumber"], verse)

        publication_ref = None
        if row["DocumentId"] and not row["BookNumber"]:
            publication_ref = row["KeySymbol"] or row["LocTitle"] or None
            if row["LocTitle"] and row["LocTitle"] != publication_ref:
                publication_ref = f"{publication_ref} — {row['LocTitle']}"
            if row["BlockType"] == 1 and row["BlockIdentifier"]:
                publication_ref = f"{publication_ref}, ¶{row['BlockIdentifier']}"

        notes.append({
            "jwlibrary_note_id": row["Guid"],
            "title": row["Title"] or None,
            "content": row["Content"] or "",
            "scripture_ref": scripture_ref,
            "scripture_book": scripture_book,
            "scripture_chapter": row["ChapterNumber"] if row["BookNumber"] else None,
            "scripture_verse_start": verse,
            "scripture_verse_end": verse,
            "publication_ref": publication_ref,
            "tags": tags_by_note.get(row["NoteId"], []),
            "note_created_at": row["Created"],
            "note_modified_at": row["LastModified"],
        })
    conn.close()
    return notes


def upsert_batch(url, key, batch):
    req = urllib.request.Request(
        f"{url}/rest/v1/study_notes?on_conflict=jwlibrary_note_id",
        data=json.dumps(batch).encode("utf-8"),
        method="POST",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        sys.exit(f"Supabase rejected the batch (HTTP {e.code}): {detail}")


def main():
    url, key = load_env()
    backup_path = sys.argv[1] if len(sys.argv) > 1 else find_latest_backup(
        os.environ.get("JWLIBRARY_BACKUP_DIR", DEFAULT_BACKUP_DIR)
    )
    print(f"Reading {backup_path}")

    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = extract_db(backup_path, tmpdir)
        notes = extract_notes(db_path)

    print(f"Found {len(notes)} notes with content")

    for i in range(0, len(notes), BATCH_SIZE):
        batch = notes[i:i + BATCH_SIZE]
        status = upsert_batch(url, key, batch)
        print(f"  upserted {i + len(batch)}/{len(notes)} (status {status})")

    print("Done.")


if __name__ == "__main__":
    main()
