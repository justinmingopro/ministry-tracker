#!/usr/bin/env python3
"""One-time import of two Trello board exports into Supabase:

  1. A "Return Visits" board, where each LIST is one contact (the list name
     is the person's name/description) and each CARD in that list is either
     metadata (an "Address" or "Phone" card) or an individual visit.
  2. A "Personal Study - <year>" board, where each LIST is a month and each
     CARD is one day's study entry, named like "12: Isa 24:1,2" or
     "8: Meeting prep". Bare chapter:verse entries with no book name (e.g.
     "26:1-6") are assumed to continue the most recently named book, since
     that's how a running Bible-reading log is normally kept.

Usage:
    python scripts/import_trello.py <return-visits.json> <personal-study.json> [--commit]

Without --commit this only prints a preview of what would be imported —
nothing is written. Re-run with --commit once the preview looks right.

This is a one-time migration, not an ongoing sync like import_jwlibrary.py.
Re-running with --commit is still safe: contacts/visits/study_log rows
carry the source Trello id in trello_list_id/trello_card_id (see
supabase-schema-trello.sql — run that migration before using --commit) and
are upserted on it, so re-importing the same export just updates rows
instead of duplicating them.

Requires SUPABASE_URL and SUPABASE_ANON_KEY, either as environment
variables or in a .env.local / .env file in the repo root (same convention
as import_jwlibrary.py). Not needed at all for a dry run.
"""
import json
import re
import sys
from datetime import date, datetime, timezone
from pathlib import Path

BOOK_NUMBERS = {
    "genesis": 1, "gen": 1, "ge": 1,
    "exodus": 2, "exo": 2, "ex": 2,
    "leviticus": 3, "lev": 3,
    "numbers": 4, "num": 4, "nu": 4,
    "deuteronomy": 5, "deut": 5, "dt": 5,
    "joshua": 6, "josh": 6,
    "judges": 7, "judg": 7, "jdg": 7,
    "ruth": 8,
    "1 samuel": 9, "1samuel": 9, "1 sam": 9, "1sam": 9, "1sa": 9,
    "2 samuel": 10, "2samuel": 10, "2 sam": 10, "2sam": 10, "2sa": 10,
    "1 kings": 11, "1kings": 11, "1 ki": 11, "1kgs": 11,
    "2 kings": 12, "2kings": 12, "2 ki": 12, "2kgs": 12,
    "1 chronicles": 13, "1chronicles": 13, "1 chron": 13, "1chr": 13, "1 ch": 13,
    "2 chronicles": 14, "2chronicles": 14, "2 chron": 14, "2chr": 14, "2 ch": 14,
    "ezra": 15,
    "nehemiah": 16, "neh": 16,
    "esther": 17, "esth": 17, "est": 17,
    "job": 18,
    "psalms": 19, "psalm": 19, "psa": 19, "ps": 19,
    "proverbs": 20, "prov": 20, "pr": 20,
    "ecclesiastes": 21, "eccl": 21, "ecc": 21,
    "song of solomon": 22, "song of songs": 22, "song": 22, "sos": 22,
    "isaiah": 23, "isa": 23, "is": 23,
    "jeremiah": 24, "jer": 24,
    "lamentations": 25, "lam": 25,
    "ezekiel": 26, "ezek": 26, "eze": 26,
    "daniel": 27, "dan": 27,
    "hosea": 28, "hos": 28,
    "joel": 29,
    "amos": 30,
    "obadiah": 31, "obad": 31,
    "jonah": 32,
    "micah": 33, "mic": 33,
    "nahum": 34, "nah": 34,
    "habakkuk": 35, "hab": 35,
    "zephaniah": 36, "zeph": 36,
    "haggai": 37, "hag": 37,
    "zechariah": 38, "zech": 38,
    "malachi": 39, "mal": 39,
    "matthew": 40, "matt": 40, "mt": 40,
    "mark": 41, "mk": 41,
    "luke": 42, "lk": 42,
    "john": 43, "jn": 43,
    "acts": 44,
    "romans": 45, "rom": 45,
    "1 corinthians": 46, "1corinthians": 46, "1 cor": 46, "1cor": 46,
    "2 corinthians": 47, "2corinthians": 47, "2 cor": 47, "2cor": 47,
    "galatians": 48, "gal": 48,
    "ephesians": 49, "eph": 49,
    "philippians": 50, "phil": 50,
    "colossians": 51, "col": 51,
    "1 thessalonians": 52, "1thessalonians": 52, "1 thess": 52, "1thess": 52,
    "2 thessalonians": 53, "2thessalonians": 53, "2 thess": 53, "2thess": 53,
    "1 timothy": 54, "1timothy": 54, "1 tim": 54, "1tim": 54,
    "2 timothy": 55, "2timothy": 55, "2 tim": 55, "2tim": 55,
    "titus": 56,
    "philemon": 57, "philem": 57, "phm": 57,
    "hebrews": 58, "heb": 58,
    "james": 59, "jas": 59,
    "1 peter": 60, "1peter": 60, "1 pet": 60, "1pet": 60, "1pe": 60,
    "2 peter": 61, "2peter": 61, "2 pet": 61, "2pet": 61, "2pe": 61,
    "1 john": 62, "1john": 62, "1jn": 62,
    "2 john": 63, "2john": 63, "2jn": 63,
    "3 john": 64, "3john": 64, "3jn": 64,
    "jude": 65,
    "revelation": 66, "rev": 66,
}
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
# Longest keys first, so "1 corinthians" is tried before "corinthians"-ish partials.
BOOK_KEYS_BY_LENGTH = sorted(BOOK_NUMBERS, key=len, reverse=True)

MONTH_NUMBERS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11,
    "december": 12,
}

# Book name (optional) + chapter:verse(,verse|-verse)*, e.g. "Rev 21:3,4" or "24:1,2".
REF_WITH_VERSE = re.compile(
    r'(?P<book>\d?\s?[A-Za-z][A-Za-z .]*?)?\s*(?P<chapter>\d{1,3}):(?P<verse>\d{1,3}(?:[-–,]\s*\d{1,3})*)'
)
# Book name + bare chapter, e.g. "Isa 46" — anchored to the whole string so it
# doesn't fire on things like "Meeting prep 5".
REF_CHAPTER_ONLY = re.compile(r'^\s*([A-Za-z][A-Za-z .]*?)\s+(\d{1,3})\s*$')


def trello_card_date(card_id):
    """Trello ids are Mongo ObjectIds: the first 8 hex chars are a unix
    timestamp (seconds) of when the card was created."""
    return datetime.fromtimestamp(int(card_id[:8], 16), tz=timezone.utc).date()


def find_all_refs(text):
    """Scan free text for scripture references with an explicit book name
    (used for return-visit notes, which always spell the book out)."""
    if not text:
        return []
    refs = []
    for m in REF_WITH_VERSE.finditer(text):
        book_raw = (m.group('book') or '').strip().lower()
        book_num = BOOK_NUMBERS.get(re.sub(r'\s+', ' ', book_raw))
        if not book_num:
            continue
        book = BOOK_NAMES[book_num]
        chapter = m.group('chapter')
        verse = m.group('verse').replace(' ', '')
        refs.append(f"{book} {chapter}:{verse}")
    return refs


def load_env():
    env_vars = {}
    for fname in (".env.local", ".env"):
        path = Path(__file__).resolve().parent.parent / fname
        if path.exists():
            for line in path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                env_vars.setdefault(k.strip(), v.strip())
    import os
    url = os.environ.get("SUPABASE_URL") or os.environ.get("REACT_APP_SUPABASE_URL") or env_vars.get("SUPABASE_URL") or env_vars.get("REACT_APP_SUPABASE_URL")
    key = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("REACT_APP_SUPABASE_ANON_KEY") or env_vars.get("SUPABASE_ANON_KEY") or env_vars.get("REACT_APP_SUPABASE_ANON_KEY")
    if not url or not key:
        sys.exit("Missing SUPABASE_URL/SUPABASE_ANON_KEY (checked env vars and .env.local/.env in the repo root)")
    return url.rstrip("/"), key


def upsert(url, key, table, on_conflict, rows):
    import urllib.error
    import urllib.request
    if not rows:
        return
    req = urllib.request.Request(
        f"{url}/rest/v1/{table}?on_conflict={on_conflict}",
        data=json.dumps(rows).encode("utf-8"),
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
        sys.exit(f"Supabase rejected the {table} batch (HTTP {e.code}): {detail}")


# ---------------------------------------------------------------- Return Visits

def parse_return_visits(board):
    lists_by_id = {l["id"]: l for l in board["lists"]}
    cards_by_list = {}
    for c in board["cards"]:
        cards_by_list.setdefault(c["idList"], []).append(c)

    contacts = []
    for list_id, cards in cards_by_list.items():
        trello_list = lists_by_id.get(list_id)
        if not trello_list:
            continue
        cards = sorted(cards, key=lambda c: c.get("pos", 0))

        address = None
        phone = None
        visits = []
        for card in cards:
            name = (card.get("name") or "").strip()
            desc = (card.get("desc") or "").strip()
            name_lower = name.lower()

            if name_lower == "address":
                address = desc or None
                continue
            if name_lower == "phone":
                phone = desc or None
                continue

            if name_lower.startswith("address") and "/" in name:
                # e.g. "Address/ 1st Visit" — first line is the address, the
                # rest (after a blank line) is the actual visit note.
                parts = desc.split("\n\n", 1)
                if parts[0].strip() and re.match(r'^\d', parts[0].strip()):
                    address = address or parts[0].strip()
                    desc = parts[1].strip() if len(parts) > 1 else ""
                    name = "1st Visit"

            combined = name if not desc else f"{name}\n\n{desc}"
            refs = find_all_refs(combined)
            visits.append({
                "trello_card_id": card["id"],
                "visit_date": trello_card_date(card["id"]).isoformat(),
                "scripture": ", ".join(refs) if refs else None,
                "topic": None,
                "notes": combined,
            })

        if not visits and not address and not phone:
            continue  # empty list (e.g. Trello's leftover "New List" placeholders)

        contacts.append({
            "trello_list_id": list_id,
            "name": trello_list["name"],
            "address": address,
            "phone": phone,
            "status": "moved" if trello_list.get("closed") else "interested",
            "visits": visits,
        })
    return contacts


# ---------------------------------------------------------------- Personal Study

def parse_study_log(board):
    year_match = re.search(r'(20\d{2})', board.get("name", ""))
    year = int(year_match.group(1)) if year_match else date.today().year

    lists_by_id = {l["id"]: l for l in board["lists"]}
    cards_by_list = {}
    for c in board["cards"]:
        cards_by_list.setdefault(c["idList"], []).append(c)

    # Walk lists in month order so "current book" carries forward correctly.
    ordered_lists = sorted(
        (l for l in board["lists"] if l["name"].lower() in MONTH_NUMBERS),
        key=lambda l: MONTH_NUMBERS[l["name"].lower()],
    )

    entries = []
    current_book = None
    for trello_list in ordered_lists:
        month_num = MONTH_NUMBERS[trello_list["name"].lower()]
        cards = sorted(cards_by_list.get(trello_list["id"], []), key=lambda c: c.get("pos", 0))

        for card in cards:
            name = (card.get("name") or "").strip()
            m = re.match(r'^\s*(\d{1,2})\s*[:.\-]?\s*(.*)$', name)
            if not m:
                continue
            day = int(m.group(1))
            rest = m.group(2).strip()
            try:
                log_date = date(year, month_num, day)
            except ValueError:
                continue

            scripture_ref = scripture_book = None
            scripture_chapter = None
            topic = notes = None

            ref_match = REF_WITH_VERSE.match(rest)
            chapter_only_match = REF_CHAPTER_ONLY.match(rest)
            if ref_match and (ref_match.group('book') or '').strip():
                book_raw = re.sub(r'\s+', ' ', ref_match.group('book').strip().lower())
                book_num = BOOK_NUMBERS.get(book_raw)
                if book_num:
                    current_book = book_num
                    chapter = ref_match.group('chapter')
                    verse = ref_match.group('verse').replace(' ', '')
                    scripture_book = BOOK_NAMES[book_num]
                    scripture_chapter = int(chapter)
                    scripture_ref = f"{scripture_book} {chapter}:{verse}"
                    notes = rest[ref_match.end():].strip(" /") or None
                else:
                    # Unrecognized book abbreviation — keep the raw text
                    # rather than silently dropping it.
                    topic = rest or None
            elif ref_match and not (ref_match.group('book') or '').strip() and current_book:
                chapter = ref_match.group('chapter')
                verse = ref_match.group('verse').replace(' ', '')
                scripture_book = BOOK_NAMES[current_book]
                scripture_chapter = int(chapter)
                scripture_ref = f"{scripture_book} {chapter}:{verse}"
                notes = rest[ref_match.end():].strip(" /") or None
            elif chapter_only_match:
                book_raw = chapter_only_match.group(1).strip().lower()
                book_num = BOOK_NUMBERS.get(book_raw)
                if book_num:
                    current_book = book_num
                    scripture_book = BOOK_NAMES[book_num]
                    scripture_chapter = int(chapter_only_match.group(2))
                    scripture_ref = f"{scripture_book} {scripture_chapter}"
                else:
                    topic = rest or None
            else:
                topic = rest or None

            entries.append({
                "trello_card_id": card["id"],
                "log_date": log_date.isoformat(),
                "scripture_ref": scripture_ref,
                "scripture_book": scripture_book,
                "scripture_chapter": scripture_chapter,
                "topic": topic,
                "notes": notes,
            })
    return entries


# ---------------------------------------------------------------- main

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    commit = "--commit" in sys.argv[1:]
    if len(args) != 2:
        sys.exit(__doc__)

    with open(args[0], encoding="utf-8") as f:
        visits_board = json.load(f)
    with open(args[1], encoding="utf-8") as f:
        study_board = json.load(f)

    contacts = parse_return_visits(visits_board)
    study_entries = parse_study_log(study_board)

    total_visits = sum(len(c["visits"]) for c in contacts)
    closed_count = sum(1 for c in contacts if c["status"] == "moved")
    print(f"Return Visits board: {len(contacts)} contacts, {total_visits} visits")
    print(f"  ({closed_count} contacts came from archived Trello lists — imported with "
          f"status 'moved' by default, since Trello doesn't record why a list was archived. "
          f"Review and correct these in the Contacts tab after import.)")
    for c in contacts:
        print(f"  - {c['name']!r} [{c['status']}] addr={c['address']!r} phone={c['phone']!r} — {len(c['visits'])} visit(s)")

    with_scripture = sum(1 for e in study_entries if e["scripture_ref"])
    with_topic = sum(1 for e in study_entries if e["topic"] and not e["scripture_ref"])
    unrecognized = sum(1 for e in study_entries if not e["scripture_ref"] and not e["topic"])
    print()
    print(f"Personal Study board: {len(study_entries)} entries "
          f"({with_scripture} scripture, {with_topic} topic-only, {unrecognized} blank)")
    if study_entries:
        print(f"  date range: {study_entries[0]['log_date']} to {study_entries[-1]['log_date']}")

    if not commit:
        print()
        print("Dry run only — nothing written. Re-run with --commit to import for real.")
        return

    print()
    print("Committing to Supabase...")
    url, key = load_env()

    contact_rows = [
        {k: v for k, v in c.items() if k != "visits"} for c in contacts
    ]
    upsert(url, key, "contacts", "trello_list_id", contact_rows)
    print(f"  upserted {len(contact_rows)} contacts")

    # Visits reference contacts by contact_id, not trello_list_id, so fetch
    # the ids Supabase just assigned/matched before inserting visit rows.
    import urllib.parse
    import urllib.request
    list_ids = [c["trello_list_id"] for c in contacts]
    resp_req = urllib.request.Request(
        f"{url}/rest/v1/contacts?trello_list_id=in.({','.join(list_ids)})&select=id,trello_list_id",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(resp_req) as resp:
        id_map = {row["trello_list_id"]: row["id"] for row in json.loads(resp.read())}

    visit_rows = []
    for c in contacts:
        contact_id = id_map.get(c["trello_list_id"])
        if not contact_id:
            continue
        for v in c["visits"]:
            visit_rows.append({**{k: val for k, val in v.items()}, "contact_id": contact_id})
    upsert(url, key, "visits", "trello_card_id", visit_rows)
    print(f"  upserted {len(visit_rows)} visits")

    upsert(url, key, "study_log", "trello_card_id", study_entries)
    print(f"  upserted {len(study_entries)} study log entries")

    print("Done.")


if __name__ == "__main__":
    main()
