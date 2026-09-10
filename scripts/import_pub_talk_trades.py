#!/usr/bin/env python3
"""One-time import of the "Pub Talk Trades" Google Doc into Supabase's
pub_talk_trades table (see supabase-schema-pubtalk.sql — run that migration
first).

The doc was a running list of "Month Year - Congregation, Confirmed <date>
(Coordinator)" lines, formatted inconsistently (some lines had a phone/email
instead of a name, some had no confirmation date at all). The ROWS list
below is a manual transcription as of the import date — anything the doc
didn't clearly state (e.g. June 2026's missing congregation name) is left
blank rather than guessed, with the original wording kept in `notes` so
nothing is lost.

Usage:
    python scripts/import_pub_talk_trades.py [--commit]

Without --commit this only prints a preview of what would be imported —
nothing is written. Re-run with --commit once the preview looks right.

Safe to re-run: rows are upserted on trade_month, so re-running just
updates rows instead of duplicating them.

Requires SUPABASE_URL and SUPABASE_ANON_KEY, either as environment
variables or in a .env.local / .env file in the repo root (same convention
as import_jwlibrary.py / import_trello.py).
"""
import json
import sys

# (trade_month "YYYY-MM-01", congregation, coordinator_name, coordinator_phone,
#  coordinator_email, confirmed_date "YYYY-MM-DD" or None, notes)
ROWS = [
    ("2026-02-01", "American Fork", "Jordan Pollino", None, None, "2025-05-13", None),
    ("2026-03-01", "Bountiful", None, None, None, "2025-05-18", None),
    ("2026-04-01", "JRN", None, None, None, "2025-05-17", None),
    ("2026-05-01", "Preston", None, None, None, None, None),
    ("2026-06-01", None, "Jaron VanSambeek", "801-884-7001", "Jaronpv1991@gmail.com", None,
     "Congregation not recorded in original doc"),
    ("2026-07-01", "Holladay", None, None, None, "2025-05-18", None),
    ("2026-09-01", "Tooele", None, None, None, None, None),
    ("2026-10-01", "Heber", None, None, None, "2025-05-17", None),
    ("2026-11-01", "Sugarhouse", None, None, None, "2025-09-16", None),
    ("2026-12-01", "Logan", None, None, None, "2026-01-13", None),
    ("2027-02-01", "Roy", "Michael Delgado", None, None, "2026-03-11", None),
    ("2027-03-01", "Brigham", None, None, "gfowler.talks@gmail.com", "2026-02-24", None),
    ("2027-04-01", "West Valley", "Laurence Singh", "+1 (347) 583-1949", None, "2026-07-23",
     "English congregation"),
    ("2027-05-01", "Central City", "Daryl Quesada", "801.913.5572", "darylaquesada@yahoo.com",
     "2026-03-03", "Confirmed through email"),
    ("2027-06-01", "Layton", "Will Weston", "+1 (801) 682-6617", None, "2026-07-19", None),
    ("2027-07-01", "Evanston", "Leeland Clark", "+1 (307) 677-1089", None, "2026-07-19", None),
    ("2027-08-01", "Midvale", "Callahan", "+1 (801) 706-3984", None, "2026-07-24", None),
    ("2027-10-01", "Sunset", "Frank Bethea", "+1 (801) 725-9759", None, "2026-07-22", None),
    ("2027-11-01", "North Ogden", "Joe Harpole", "(573) 300-1398", None, "2026-07-26", None),
    ("2027-12-01", "JRN", "Jeff", None, None, "2026-09-10", "Contact via WhatsApp"),
]


def load_env():
    import os
    from pathlib import Path
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
    url = os.environ.get("SUPABASE_URL") or os.environ.get("REACT_APP_SUPABASE_URL") or env_vars.get("SUPABASE_URL") or env_vars.get("REACT_APP_SUPABASE_URL")
    key = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("REACT_APP_SUPABASE_ANON_KEY") or env_vars.get("SUPABASE_ANON_KEY") or env_vars.get("REACT_APP_SUPABASE_ANON_KEY")
    if not url or not key:
        sys.exit("Missing SUPABASE_URL/SUPABASE_ANON_KEY (checked env vars and .env.local/.env in the repo root)")
    return url.rstrip("/"), key


def upsert(url, key, rows):
    import urllib.error
    import urllib.request
    if not rows:
        return
    req = urllib.request.Request(
        f"{url}/rest/v1/pub_talk_trades?on_conflict=trade_month",
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
        sys.exit(f"Supabase rejected the batch (HTTP {e.code}): {detail}")


def main():
    commit = "--commit" in sys.argv[1:]

    rows = [
        {
            "trade_month": trade_month,
            "congregation": congregation,
            "coordinator_name": coordinator_name,
            "coordinator_phone": coordinator_phone,
            "coordinator_email": coordinator_email,
            "confirmed_date": confirmed_date,
            "notes": notes,
        }
        for trade_month, congregation, coordinator_name, coordinator_phone, coordinator_email, confirmed_date, notes in ROWS
    ]

    print(f"{len(rows)} month(s) to import:\n")
    for r in rows:
        bits = [r["trade_month"][:7]]
        bits.append(r["congregation"] or "(no congregation)")
        if r["coordinator_name"]:
            bits.append(r["coordinator_name"])
        if r["confirmed_date"]:
            bits.append(f"confirmed {r['confirmed_date']}")
        else:
            bits.append("NOT CONFIRMED")
        if r["notes"]:
            bits.append(f"[{r['notes']}]")
        print("  " + " — ".join(bits))

    if not commit:
        print("\nDry run only — nothing written. Re-run with --commit to import for real.")
        return

    url, key = load_env()
    upsert(url, key, rows)
    print(f"\nImported {len(rows)} row(s) into pub_talk_trades.")


if __name__ == "__main__":
    main()
