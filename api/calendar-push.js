// Creates/updates/deletes events on the "JW/Ministry" iCloud calendar for study_log
// entries, via CalDAV (Apple's calendars don't have a REST API like Google's).
import { DAVClient } from 'tsdav';

async function getClientAndCalendar() {
  const username = process.env.ICLOUD_APPLE_ID;
  const password = process.env.ICLOUD_APP_SPECIFIC_PASSWORD;
  const calendarName = process.env.ICLOUD_STUDY_CALENDAR_NAME || 'JW/Ministry';

  if (!username || !password) {
    throw new Error(
      "iCloud calendar not configured — add ICLOUD_APPLE_ID and ICLOUD_APP_SPECIFIC_PASSWORD to Vercel env vars."
    );
  }

  const client = new DAVClient({
    serverUrl: 'https://caldav.icloud.com',
    credentials: { username, password },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  });
  await client.login();

  const calendars = await client.fetchCalendars();
  const calendar = calendars.find((c) => c.displayName === calendarName);
  if (!calendar) {
    const names = calendars.map((c) => c.displayName).join(', ');
    throw new Error(`Calendar "${calendarName}" not found. Calendars on this account: ${names}`);
  }
  return { client, calendar };
}

function escapeIcsText(s) {
  return (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildIcs({ uid, summary, description, date }) {
  const dtStart = date.replace(/-/g, '');
  const dtEnd = addDays(date, 1).replace(/-/g, '');
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ministry-tracker//study-log//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;VALUE=DATE:${dtStart}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    description ? `DESCRIPTION:${escapeIcsText(description)}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, eventId, event } = req.body || {};
  if (!action || !['create', 'update', 'delete'].includes(action)) {
    return res.status(400).json({ error: "action must be 'create', 'update', or 'delete'" });
  }
  if (action !== 'create' && !eventId) {
    return res.status(400).json({ error: 'eventId is required for update/delete' });
  }

  try {
    const { client, calendar } = await getClientAndCalendar();

    if (action === 'delete') {
      const url = `${calendar.url}${eventId}.ics`;
      const resp = await client.deleteCalendarObject({ calendarObject: { url } });
      // Already gone is fine — treat like the Google version did.
      if (!resp.ok && resp.status !== 404 && resp.status !== 410) {
        return res.status(500).json({ error: `CalDAV delete failed (${resp.status})` });
      }
      return res.status(200).json({ ok: true });
    }

    if (!event || !event.summary || !event.date) {
      return res.status(400).json({ error: 'event.summary and event.date are required' });
    }

    const uid =
      action === 'create' ? `study-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : eventId;
    const iCalString = buildIcs({ uid, summary: event.summary, description: event.description, date: event.date });
    const url = `${calendar.url}${uid}.ics`;

    const resp =
      action === 'create'
        ? await client.createCalendarObject({ calendar, iCalString, filename: `${uid}.ics` })
        : await client.updateCalendarObject({ calendarObject: { url, data: iCalString } });

    if (!resp.ok) {
      return res.status(500).json({ error: `CalDAV ${action} failed (${resp.status})` });
    }

    return res.status(200).json({ eventId: uid });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
