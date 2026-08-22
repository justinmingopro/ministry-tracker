// Creates/updates/deletes events on the "JW/Ministry" Google Calendar for study_log entries.
// Reuses the OAuth refresh-token pattern from the project-manager repo's calendar-availability.js.
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const clientId     = process.env.GCAL_CLIENT_ID;
  const clientSecret = process.env.GCAL_CLIENT_SECRET;
  const refreshToken = process.env.GCAL_REFRESH_TOKEN;
  const calendarId   = process.env.GCAL_STUDY_CALENDAR_ID;

  if (!clientId || !clientSecret || !refreshToken || !calendarId) {
    return res.status(500).json({
      error: "Google Calendar not configured — add GCAL_CLIENT_ID, GCAL_CLIENT_SECRET, GCAL_REFRESH_TOKEN, GCAL_STUDY_CALENDAR_ID to Vercel env vars.",
    });
  }

  const { action, eventId, event } = req.body || {};
  if (!action || !["create", "update", "delete"].includes(action)) {
    return res.status(400).json({ error: "action must be 'create', 'update', or 'delete'" });
  }
  if (action !== "create" && !eventId) {
    return res.status(400).json({ error: "eventId is required for update/delete" });
  }

  try {
    // ── 1. Exchange refresh token for access token ──────────────────────────
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type:    "refresh_token",
      }),
    });
    const tokenData = await tokenResp.json();
    if (!tokenData.access_token) {
      const reason = tokenData.error_description || tokenData.error || JSON.stringify(tokenData);
      return res.status(500).json({ error: `Token refresh failed: ${reason}` });
    }

    const authHeader = { Authorization: `Bearer ${tokenData.access_token}` };
    const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

    // ── 2. Create / update / delete the event ───────────────────────────────
    if (action === "delete") {
      const delResp = await fetch(`${base}/${encodeURIComponent(eventId)}`, {
        method: "DELETE",
        headers: authHeader,
      });
      // Google returns 410 if the event was already deleted on the calendar side — treat as success.
      if (!delResp.ok && delResp.status !== 410 && delResp.status !== 404) {
        const detail = await delResp.json().catch(() => ({}));
        return res.status(500).json({ error: "Calendar API error", detail });
      }
      return res.status(200).json({ ok: true });
    }

    if (!event || !event.summary || !event.date) {
      return res.status(400).json({ error: "event.summary and event.date are required" });
    }

    const body = {
      summary: event.summary,
      description: event.description || undefined,
      start: { date: event.date },
      end: { date: event.date },
    };

    const url = action === "create" ? base : `${base}/${encodeURIComponent(eventId)}`;
    const method = action === "create" ? "POST" : "PATCH";

    const evResp = await fetch(url, {
      method,
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const evData = await evResp.json();
    if (!evResp.ok) {
      return res.status(500).json({ error: "Calendar API error", detail: evData });
    }

    return res.status(200).json({ eventId: evData.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
