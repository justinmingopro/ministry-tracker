import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  Search, Plus, ChevronLeft, BookOpen, MapPin, Phone,
  User, Calendar, Tag, Edit2, Trash2, X, Sun, Moon,
  Filter, ChevronDown, AlertCircle, Download, Upload, Sparkles, LogOut
} from 'lucide-react';
import './App.css';

// Attaches the current Supabase session's access token so server-side API
// routes can verify the caller is logged in (checked in api/search.js and
// api/calendar-push.js) — the anon key alone won't be enough now that RLS is on.
async function authHeader() {
  let { data } = await supabase.auth.getSession();
  // If the session sat idle long enough (tab backgrounded, laptop asleep)
  // that the token is expired or about to be, force a refresh rather than
  // send a stale one — the background auto-refresh timer isn't reliable
  // across long idle periods.
  if (data.session && data.session.expires_at * 1000 < Date.now() + 60000) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.data.session) data = refreshed.data;
  }
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

const STATUS_CONFIG = {
  'interested': { label: 'Interested', color: '#4ade80', bg: 'rgba(74,222,128,0.15)' },
  'studying':   { label: 'Studying',   color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  'not interested': { label: 'Not Interested', color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
  'moved':      { label: 'Moved',      color: '#facc15', bg: 'rgba(250,204,21,0.15)' },
  'do not call':{ label: 'Do Not Call',color: '#a1a1aa', bg: 'rgba(161,161,170,0.15)' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['interested'];
  return (
    <span style={{ color: cfg.color, background: cfg.bg, padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, letterSpacing: 0.5 }}>
      {cfg.label}
    </span>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ContactForm({ contact, onSave, onClose }) {
  const [form, setForm] = useState({
    name: contact?.name || '',
    address: contact?.address || '',
    phone: contact?.phone || '',
    territory: contact?.territory || '',
    status: contact?.status || 'interested',
    notes: contact?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      let data, err;
      if (contact?.id) {
        ({ data, error: err } = await supabase.from('contacts').update({ ...form, updated_at: new Date() }).eq('id', contact.id).select().single());
      } else {
        ({ data, error: err } = await supabase.from('contacts').insert(form).select().single());
      }
      if (err) throw err;
      onSave(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      {error && <div className="error-msg"><AlertCircle size={14} /> {error}</div>}
      <div className="form-row">
        <label>Full Name *</label>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. John Smith" />
      </div>
      <div className="form-row">
        <label>Address</label>
        <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Main St" />
      </div>
      <div className="form-row">
        <label>Phone</label>
        <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(555) 000-0000" />
      </div>
      <div className="form-row">
        <label>Territory / Area</label>
        <input value={form.territory} onChange={e => setForm(f => ({ ...f, territory: e.target.value }))} placeholder="e.g. North Side, Downtown" />
      </div>
      <div className="form-row">
        <label>Status</label>
        <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
          {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
            <option key={val} value={val}>{cfg.label}</option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label>Notes</label>
        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Any general notes about this person..." />
      </div>
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : contact ? 'Save Changes' : 'Add Contact'}</button>
      </div>
    </form>
  );
}

function VisitForm({ contactId, visit, onSave, onClose }) {
  const [form, setForm] = useState({
    visit_date: visit?.visit_date || new Date().toISOString().split('T')[0],
    scripture: visit?.scripture || '',
    topic: visit?.topic || '',
    notes: visit?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      let data, err;
      if (visit?.id) {
        ({ data, error: err } = await supabase.from('visits').update(form).eq('id', visit.id).select().single());
      } else {
        ({ data, error: err } = await supabase.from('visits').insert({ ...form, contact_id: contactId }).select().single());
      }
      if (err) throw err;
      onSave(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      {error && <div className="error-msg"><AlertCircle size={14} /> {error}</div>}
      <div className="form-row">
        <label>Date of Visit</label>
        <input type="date" value={form.visit_date} onChange={e => setForm(f => ({ ...f, visit_date: e.target.value }))} />
      </div>
      <div className="form-row">
        <label>Scripture Shared</label>
        <input value={form.scripture} onChange={e => setForm(f => ({ ...f, scripture: e.target.value }))} placeholder="e.g. John 3:16, Psalm 83:18" />
      </div>
      <div className="form-row">
        <label>Topic / Subject Discussed</label>
        <input value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} placeholder="e.g. God's Kingdom, Paradise Earth" />
      </div>
      <div className="form-row">
        <label>Notes</label>
        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={4} placeholder="What did you talk about? How did they respond? What to follow up on?" />
      </div>
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : visit ? 'Save Changes' : 'Log Visit'}</button>
      </div>
    </form>
  );
}

function VisitCard({ visit, onEdit, onDelete }) {
  const date = new Date(visit.visit_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  return (
    <div className="visit-card">
      <div className="visit-header">
        <span className="visit-date"><Calendar size={13} /> {date}</span>
        <div className="visit-actions">
          <button className="icon-btn small" onClick={() => onEdit(visit)}><Edit2 size={13} /></button>
          <button className="icon-btn small danger" onClick={() => onDelete(visit.id)}><Trash2 size={13} /></button>
        </div>
      </div>
      {visit.scripture && <div className="visit-field"><BookOpen size={13} /> <span><strong>Scripture:</strong> {visit.scripture}</span></div>}
      {visit.topic && <div className="visit-field"><Tag size={13} /> <span><strong>Topic:</strong> {visit.topic}</span></div>}
      {visit.notes && <div className="visit-notes">{visit.notes}</div>}
    </div>
  );
}

function ContactDetail({ contact, onBack, onUpdate, darkMode }) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [showEditContact, setShowEditContact] = useState(false);
  const [editingVisit, setEditingVisit] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const loadVisits = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('visits').select('*').eq('contact_id', contact.id).order('visit_date', { ascending: false });
    setVisits(data || []);
    setLoading(false);
  }, [contact.id]);

  useEffect(() => { loadVisits(); }, [loadVisits]);

  const handleVisitSave = (visit) => {
    setVisits(prev => {
      const idx = prev.findIndex(v => v.id === visit.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = visit; return next; }
      return [visit, ...prev];
    });
    setShowVisitForm(false);
    setEditingVisit(null);
  };

  const handleDeleteVisit = async (id) => {
    await supabase.from('visits').delete().eq('id', id);
    setVisits(prev => prev.filter(v => v.id !== id));
    setConfirmDelete(null);
  };

  const handleDeleteContact = async () => {
    await supabase.from('contacts').delete().eq('id', contact.id);
    onBack(true);
  };

  return (
    <div className="detail-view">
      <div className="detail-header">
        <button className="back-btn" onClick={() => onBack(false)}><ChevronLeft size={18} /> Back</button>
        <div className="detail-header-actions">
          <button className="btn-secondary small" onClick={() => setShowEditContact(true)}><Edit2 size={14} /> Edit</button>
          <button className="btn-danger small" onClick={() => setConfirmDelete('contact')}><Trash2 size={14} /></button>
        </div>
      </div>

      <div className="contact-profile">
        <div className="contact-avatar">{contact.name.charAt(0).toUpperCase()}</div>
        <div className="contact-info">
          <h1>{contact.name}</h1>
          <StatusBadge status={contact.status} />
          {contact.address && <div className="contact-meta"><MapPin size={14} /> {contact.address}</div>}
          {contact.phone && <div className="contact-meta"><Phone size={14} /> {contact.phone}</div>}
          {contact.territory && <div className="contact-meta"><Filter size={14} /> {contact.territory}</div>}
        </div>
      </div>

      {contact.notes && <div className="contact-notes-box"><p>{contact.notes}</p></div>}

      <div className="visits-section">
        <div className="visits-header">
          <h2>Visit History <span className="count-badge">{visits.length}</span></h2>
          <button className="btn-primary small" onClick={() => setShowVisitForm(true)}><Plus size={14} /> Log Visit</button>
        </div>

        {loading ? <div className="loading">Loading visits...</div> :
          visits.length === 0 ? (
            <div className="empty-visits">
              <BookOpen size={32} />
              <p>No visits logged yet.</p>
              <button className="btn-primary" onClick={() => setShowVisitForm(true)}>Log First Visit</button>
            </div>
          ) : (
            <div className="visits-list">
              {visits.map(v => (
                <VisitCard key={v.id} visit={v}
                  onEdit={v => { setEditingVisit(v); setShowVisitForm(true); }}
                  onDelete={id => setConfirmDelete(id)} />
              ))}
            </div>
          )
        }
      </div>

      {showVisitForm && (
        <Modal title={editingVisit ? 'Edit Visit' : 'Log a Visit'} onClose={() => { setShowVisitForm(false); setEditingVisit(null); }}>
          <VisitForm contactId={contact.id} visit={editingVisit} onSave={handleVisitSave} onClose={() => { setShowVisitForm(false); setEditingVisit(null); }} />
        </Modal>
      )}

      {showEditContact && (
        <Modal title="Edit Contact" onClose={() => setShowEditContact(false)}>
          <ContactForm contact={contact} onSave={updated => { onUpdate(updated); setShowEditContact(false); }} onClose={() => setShowEditContact(false)} />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm Delete" onClose={() => setConfirmDelete(null)}>
          <div className="form">
            <p style={{ marginBottom: 16 }}>
              {confirmDelete === 'contact'
                ? `Are you sure you want to delete ${contact.name} and all their visits? This cannot be undone.`
                : 'Delete this visit? This cannot be undone.'}
            </p>
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn-danger"
                onClick={() => confirmDelete === 'contact' ? handleDeleteContact() : handleDeleteVisit(confirmDelete)}>
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ContactCard({ contact, onClick }) {
  return (
    <div className="contact-card" onClick={() => onClick(contact)}>
      <div className="card-avatar">{contact.name.charAt(0).toUpperCase()}</div>
      <div className="card-body">
        <div className="card-top">
          <h3>{contact.name}</h3>
          <StatusBadge status={contact.status} />
        </div>
        {contact.address && <div className="card-meta"><MapPin size={12} /> {contact.address}</div>}
        {contact.territory && <div className="card-meta"><Filter size={12} /> {contact.territory}</div>}
        {contact.visit_count > 0 && <div className="card-meta"><Calendar size={12} /> {contact.visit_count} visit{contact.visit_count !== 1 ? 's' : ''}</div>}
      </div>
      <ChevronDown size={16} style={{ transform: 'rotate(-90deg)', opacity: 0.4, flexShrink: 0 }} />
    </div>
  );
}

function StudyLogForm({ entry, onSave, onClose, onDelete, onCalendarWarning }) {
  const [form, setForm] = useState({
    log_date: entry?.log_date || new Date().toISOString().split('T')[0],
    scripture_ref: entry?.scripture_ref || '',
    topic: entry?.topic || '',
    notes: entry?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Throws on failure — the caller decides whether that should block the
  // save or just surface a warning. Previously this only checked resp.ok
  // implicitly (via calData.eventId), so an error response like a 401 was
  // silently ignored: no thrown exception, no warning, nothing.
  const pushToCalendar = async (savedEntry) => {
    const resp = await fetch('/api/calendar-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({
        action: savedEntry.calendar_event_id ? 'update' : 'create',
        eventId: savedEntry.calendar_event_id,
        event: {
          summary: savedEntry.topic || savedEntry.scripture_ref || 'Study',
          description: [savedEntry.scripture_ref, savedEntry.notes].filter(Boolean).join('\n\n'),
          date: savedEntry.log_date,
        },
      }),
    });
    const calData = await resp.json();
    if (!resp.ok) throw new Error(calData.error || `Calendar sync failed (${resp.status})`);
    if (calData.eventId && calData.eventId !== savedEntry.calendar_event_id) {
      await supabase.from('study_log').update({ calendar_event_id: calData.eventId }).eq('id', savedEntry.id);
      savedEntry.calendar_event_id = calData.eventId;
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      let data, err;
      if (entry?.id) {
        ({ data, error: err } = await supabase.from('study_log').update(form).eq('id', entry.id).select().single());
      } else {
        ({ data, error: err } = await supabase.from('study_log').insert(form).select().single());
      }
      if (err) throw err;
      // A calendar sync failure shouldn't block the save (the entry is
      // already recorded either way) — but it needs to be visible, not
      // swallowed, so surface it to the parent instead of failing silently.
      try {
        await pushToCalendar(data);
      } catch (calErr) {
        console.warn('Calendar push failed:', calErr);
        onCalendarWarning?.(`Saved, but calendar sync failed: ${calErr.message}`);
      }
      onSave(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      {error && <div className="error-msg"><AlertCircle size={14} /> {error}</div>}
      <div className="form-row">
        <label>Date</label>
        <input type="date" value={form.log_date} onChange={e => setForm(f => ({ ...f, log_date: e.target.value }))} />
      </div>
      <div className="form-row">
        <label>Scripture</label>
        <input value={form.scripture_ref} onChange={e => setForm(f => ({ ...f, scripture_ref: e.target.value }))} placeholder="e.g. Acts 17:26, 27" />
      </div>
      <div className="form-row">
        <label>Topic</label>
        <input value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} placeholder="e.g. Weekly Bible reading" />
      </div>
      <div className="form-row">
        <label>Notes</label>
        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={4} placeholder="What stood out? Any thoughts to follow up on?" />
      </div>
      <div className="form-actions">
        {entry && onDelete && (
          <button type="button" className="btn-danger" style={{ marginRight: 'auto' }} onClick={() => onDelete(entry)}>
            <Trash2 size={14} />
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : entry ? 'Save Changes' : 'Log Study'}</button>
      </div>
    </form>
  );
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function groupStudyEntriesByMonth(entries) {
  const groups = {};
  for (const e of entries) {
    const [year, month] = e.log_date.split('-');
    const key = `${year}-${month}`;
    if (!groups[key]) groups[key] = { key, year: Number(year), month: Number(month), entries: [] };
    groups[key].entries.push(e);
  }
  return Object.values(groups)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(g => ({ ...g, entries: [...g.entries].sort((a, b) => a.log_date.localeCompare(b.log_date)) }));
}

function StudyLogBoardCard({ entry, onClick }) {
  const day = Number(entry.log_date.split('-')[2]);
  const label = entry.scripture_ref || entry.topic || 'Untitled';
  return (
    <button
      type="button"
      className={`study-card ${entry.scripture_ref ? 'has-scripture' : ''}`}
      onClick={onClick}
    >
      <span className="study-card-day">{day}</span>
      <span className="study-card-text">{label}</span>
    </button>
  );
}

function StudyLogView() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [calendarWarning, setCalendarWarning] = useState('');

  const loadEntries = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('study_log').select('*').order('log_date', { ascending: false });
    setEntries(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const handleSave = (entry) => {
    setEntries(prev => {
      const idx = prev.findIndex(e => e.id === entry.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = entry; return next; }
      return [entry, ...prev].sort((a, b) => b.log_date.localeCompare(a.log_date));
    });
    setShowForm(false);
    setEditingEntry(null);
  };

  const handleDelete = async (entry) => {
    if (entry.calendar_event_id) {
      try {
        const resp = await fetch('/api/calendar-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
          body: JSON.stringify({ action: 'delete', eventId: entry.calendar_event_id }),
        });
        if (!resp.ok) {
          const calData = await resp.json().catch(() => ({}));
          throw new Error(calData.error || `Calendar delete failed (${resp.status})`);
        }
      } catch (calErr) {
        console.warn('Calendar delete failed:', calErr);
        setCalendarWarning(`Deleted, but removing the calendar event failed: ${calErr.message}`);
      }
    }
    await supabase.from('study_log').delete().eq('id', entry.id);
    setEntries(prev => prev.filter(e => e.id !== entry.id));
    setConfirmDelete(null);
  };

  const monthGroups = groupStudyEntriesByMonth(entries);

  return (
    <div className="detail-view">
      <div className="visits-header">
        <h2>Study Log <span className="count-badge">{entries.length}</span></h2>
        <button className="btn-primary small" onClick={() => setShowForm(true)}><Plus size={14} /> Log Study</button>
      </div>

      {calendarWarning && (
        <div className="error-msg" style={{ marginBottom: 12 }}>
          <AlertCircle size={14} /> {calendarWarning}
          <button type="button" className="icon-btn small" style={{ marginLeft: 'auto' }} onClick={() => setCalendarWarning('')}>
            <X size={14} />
          </button>
        </div>
      )}

      {loading ? <div className="loading">Loading study log...</div> :
        entries.length === 0 ? (
          <div className="empty-visits">
            <BookOpen size={32} />
            <p>No study entries logged yet.</p>
            <button className="btn-primary" onClick={() => setShowForm(true)}>Log First Entry</button>
          </div>
        ) : (
          <div className="study-board">
            {monthGroups.map(g => (
              <div key={g.key} className="study-board-column">
                <div className="study-board-column-header">
                  <span>{MONTH_NAMES[g.month - 1]} {g.year}</span>
                  <span className="count-badge">{g.entries.length}</span>
                </div>
                <div className="study-board-cards">
                  {g.entries.map(e => (
                    <StudyLogBoardCard key={e.id} entry={e}
                      onClick={() => { setEditingEntry(e); setShowForm(true); }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      }

      {showForm && (
        <Modal title={editingEntry ? 'Edit Study Entry' : 'Log Study'} onClose={() => { setShowForm(false); setEditingEntry(null); }}>
          <StudyLogForm entry={editingEntry} onSave={handleSave}
            onClose={() => { setShowForm(false); setEditingEntry(null); }}
            onDelete={entry => { setShowForm(false); setEditingEntry(null); setConfirmDelete(entry); }}
            onCalendarWarning={setCalendarWarning} />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm Delete" onClose={() => setConfirmDelete(null)}>
          <div className="form">
            <p style={{ marginBottom: 16 }}>Delete this study entry? This cannot be undone.</p>
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => handleDelete(confirmDelete)}>Delete</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

const BOOK_NUMBERS = {
  Genesis: 1, Exodus: 2, Leviticus: 3, Numbers: 4, Deuteronomy: 5,
  Joshua: 6, Judges: 7, Ruth: 8, '1 Samuel': 9, '2 Samuel': 10,
  '1 Kings': 11, '2 Kings': 12, '1 Chronicles': 13, '2 Chronicles': 14,
  Ezra: 15, Nehemiah: 16, Esther: 17, Job: 18, Psalms: 19,
  Proverbs: 20, Ecclesiastes: 21, 'Song of Solomon': 22, Isaiah: 23,
  Jeremiah: 24, Lamentations: 25, Ezekiel: 26, Daniel: 27,
  Hosea: 28, Joel: 29, Amos: 30, Obadiah: 31, Jonah: 32,
  Micah: 33, Nahum: 34, Habakkuk: 35, Zephaniah: 36, Haggai: 37,
  Zechariah: 38, Malachi: 39, Matthew: 40, Mark: 41, Luke: 42,
  John: 43, Acts: 44, Romans: 45, '1 Corinthians': 46,
  '2 Corinthians': 47, Galatians: 48, Ephesians: 49, Philippians: 50,
  Colossians: 51, '1 Thessalonians': 52, '2 Thessalonians': 53,
  '1 Timothy': 54, '2 Timothy': 55, Titus: 56, Philemon: 57,
  Hebrews: 58, James: 59, '1 Peter': 60, '2 Peter': 61, '1 John': 62,
  '2 John': 63, '3 John': 64, Jude: 65, Revelation: 66,
};

function buildWolUrl(book, chapter, verse) {
  const bookNum = BOOK_NUMBERS[book];
  if (!bookNum || !chapter) return null;
  const url = `https://wol.jw.org/en/wol/b/r1/lp-e/nwtsty/${bookNum}/${chapter}`;
  return verse ? `${url}#v${bookNum}-${chapter}-${verse}-1` : url;
}

function StudyNoteCard({ note }) {
  const wolUrl = buildWolUrl(note.scripture_book, note.scripture_chapter, note.scripture_verse_start);
  return (
    <div className="visit-card">
      <div className="visit-header">
        <span className="visit-date">
          <BookOpen size={13} />
          {wolUrl ? (
            <a href={wolUrl} target="_blank" rel="noopener noreferrer" className="scripture-link">
              {note.scripture_ref}
            </a>
          ) : (
            note.scripture_ref || note.publication_ref || 'Note'
          )}
        </span>
      </div>
      {note.title && <div className="visit-field"><strong>{note.title}</strong></div>}
      <div className="visit-notes">{note.content}</div>
      {note.tags?.length > 0 && (
        <div className="note-tags">
          {note.tags.map(t => <span key={t} className="note-tag">{t}</span>)}
        </div>
      )}
    </div>
  );
}

function StudyNotesView() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('all');
  const [tags, setTags] = useState([]);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('study_notes').select('*').order('note_created_at', { ascending: false });
    if (data) {
      setNotes(data);
      setTags([...new Set(data.flatMap(n => n.tags || []))].sort());
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const filtered = notes.filter(n => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      n.content?.toLowerCase().includes(q) ||
      n.scripture_ref?.toLowerCase().includes(q) ||
      n.title?.toLowerCase().includes(q);
    const matchTag = tagFilter === 'all' || (n.tags || []).includes(tagFilter);
    return matchSearch && matchTag;
  });

  return (
    <>
      <div className="filters-bar">
        <div className="search-wrap">
          <Search size={16} className="search-icon" />
          <input className="search-input" placeholder="Search notes, scriptures..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="icon-btn small" onClick={() => setSearch('')}><X size={14} /></button>}
        </div>
        {tags.length > 0 && (
          <select className="filter-select" value={tagFilter} onChange={e => setTagFilter(e.target.value)}>
            <option value="all">All Tags</option>
            {tags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>
      <main className="contacts-list">
        {loading ? (
          <div className="loading">Loading notes...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <BookOpen size={48} />
            <h3>{notes.length === 0 ? 'No notes imported yet' : 'No results found'}</h3>
            <p>{notes.length === 0 ? 'Import your JW Library notes to see them here.' : 'Try a different search or tag.'}</p>
          </div>
        ) : (
          <div className="visits-list">
            {filtered.map(n => <StudyNoteCard key={n.id} note={n} />)}
          </div>
        )}
      </main>
    </>
  );
}

function SourceBadge({ source }) {
  return source === 'bear'
    ? <span className="source-badge bear">Bear</span>
    : <span className="source-badge jw">JW Library</span>;
}

function SearchResultCard({ result }) {
  const [expanded, setExpanded] = useState(false);
  const isBear = result.source === 'bear';
  const refs = isBear
    ? (result.scripture_refs || [])
    : (result.scripture_ref
        ? [{ ref: result.scripture_ref, book: result.scripture_book, chapter: result.scripture_chapter, verse_start: result.scripture_verse_start }]
        : []);
  const isLong = result.content?.length > 400;
  const snippet = expanded || !isLong ? result.content : result.content.slice(0, 400) + '…';

  return (
    <div className="visit-card">
      <div className="visit-header">
        <SourceBadge source={result.source} />
      </div>
      {result.title && <div className="visit-field"><strong>{result.title}</strong></div>}
      {refs.length > 0 && (
        <div className="note-tags" style={{ marginBottom: 8 }}>
          {refs.map((r, i) => {
            const url = buildWolUrl(r.book, r.chapter, r.verse_start);
            return url ? (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="scripture-link note-tag">{r.ref}</a>
            ) : (
              <span key={i} className="note-tag">{r.ref}</span>
            );
          })}
        </div>
      )}
      <div className="visit-notes" style={{ whiteSpace: 'pre-wrap' }}>{snippet}</div>
      {isLong && (
        <button type="button" className="show-more-btn" onClick={() => setExpanded(e => !e)}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
      {result.tags?.length > 0 && (
        <div className="note-tags">
          {result.tags.map(t => <span key={t} className="note-tag">{t}</span>)}
        </div>
      )}
    </div>
  );
}

function bearNoteIdFromTitle(title) {
  const hash = Array.from(title.toLowerCase()).reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
  return 'manual-' + Math.abs(hash).toString(36);
}

function parseHashtags(text) {
  return [...new Set((text.match(/#[\w-]+/g) || []).map(t => t.slice(1)))];
}

async function postBearNotes(notes) {
  const resp = await fetch('/api/bear-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Import failed');
  return data;
}

function BearBulkUploadButton({ onDone }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    setResult(null);
    try {
      const notes = await Promise.all(files.map(async (file) => {
        const text = (await file.text()).trim();
        const title = file.name.replace(/\.(md|markdown|txt)$/i, '');
        return {
          id: bearNoteIdFromTitle(title),
          title,
          content: text,
          tags: parseHashtags(text),
          created: new Date(file.lastModified || Date.now()).toISOString(),
          modified: new Date(file.lastModified || Date.now()).toISOString(),
        };
      }));
      const data = await postBearNotes(notes);
      setResult(`Imported ${data.imported} note${data.imported !== 1 ? 's' : ''} (${data.scriptureRefsFound} scripture reference${data.scriptureRefsFound !== 1 ? 's' : ''} found)`);
      onDone?.();
    } catch (err) {
      setResult('Error: ' + err.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <input ref={inputRef} type="file" accept=".md,.markdown,.txt" multiple style={{ display: 'none' }} onChange={handleFiles} />
      <button className="btn-secondary small" onClick={() => inputRef.current?.click()} disabled={uploading}>
        <Upload size={14} /> {uploading ? 'Uploading...' : 'Upload Files'}
      </button>
      {result && <p style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 220, textAlign: 'right' }}>{result}</p>}
    </div>
  );
}

function AddBearNoteForm({ onSave, onClose }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    if (!content.trim()) { setError('Paste the note content first'); return; }
    setSaving(true);
    setError('');
    try {
      const firstLine = content.trim().split('\n')[0].replace(/^#+\s*/, '').trim();
      const finalTitle = title.trim() || firstLine || 'Untitled';
      const parsedTags = tags.trim()
        ? tags.split(',').map(t => t.trim()).filter(Boolean)
        : parseHashtags(content);

      await postBearNotes([{
        id: bearNoteIdFromTitle(finalTitle),
        title: finalTitle,
        content: content.trim(),
        tags: parsedTags,
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
      }]);
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      {error && <div className="error-msg"><AlertCircle size={14} /> {error}</div>}
      <div className="form-row">
        <label>Title (optional — uses the note's first line if left blank)</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Circuit Overseer visit talk" />
      </div>
      <div className="form-row">
        <label>Note content</label>
        <textarea value={content} onChange={e => setContent(e.target.value)} rows={10}
          placeholder={'Open the note in Bear, select all the text, copy, and paste it here.\n\nIf you highlighted scriptures in Bear, they’ll already be wrapped like ==Rev 21:3,4== when pasted — those get auto-detected and linked.'} />
      </div>
      <div className="form-row">
        <label>Tags (optional, comma-separated — auto-detected from #hashtags in the note if left blank)</label>
        <input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. talk, convention" />
      </div>
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Note'}</button>
      </div>
    </form>
  );
}

function formatAnswer(text) {
  const urlRegex = /(https?:\/\/wol\.jw\.org[^\s)]+)/g;
  const linked = text.replace(urlRegex, (url) => {
    const label = url.replace('https://wol.jw.org', 'wol.jw.org/…').slice(0, 60);
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  return linked
    .split(/\n\n+/)
    .filter((p) => p.trim())
    .map((p) => `<p>${p.replace(/\n/g, ' ').trim()}</p>`)
    .join('');
}

async function callResearchAPI(question, thread) {
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({
      question,
      thread: thread.map((t) => ({ q: t.q, a: t.rawA })),
    }),
  });

  // The server streams blank-line heartbeats to keep the connection alive
  // during long searches, then writes one JSON line as the real payload.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let data = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (line.trim()) data = JSON.parse(line);
    }
  }
  if (!data && buffer.trim()) data = JSON.parse(buffer);
  if (!data) throw new Error('No response received');
  if (data.error) throw new Error(data.error);
  return data.answer;
}

function AIAnswerCard({ question }) {
  const [thread, setThread] = useState([]);
  const [followUp, setFollowUp] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [error, setError] = useState('');
  const askedFor = useRef(null);

  useEffect(() => {
    if (!question || askedFor.current === question) return;
    askedFor.current = question;
    setThread([]);
    setStatus('loading');
    setError('');
    callResearchAPI(question, [])
      .then((rawA) => {
        setThread([{ q: question, rawA, htmlA: formatAnswer(rawA) }]);
        setStatus('done');
      })
      .catch((err) => {
        setError(err.message);
        setStatus('error');
      });
  }, [question]);

  const askFollowUp = async () => {
    const q = followUp.trim();
    if (!q || status === 'loading') return;
    setFollowUp('');
    setStatus('loading');
    setError('');
    try {
      const rawA = await callResearchAPI(q, thread);
      setThread((prev) => [...prev, { q, rawA, htmlA: formatAnswer(rawA) }]);
      setStatus('done');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };

  if (status === 'idle') return null;

  const latest = thread[thread.length - 1];

  return (
    <div className="ai-answer-card">
      <div className="ai-answer-header"><Sparkles size={13} /> Research Assistant — wol.jw.org &amp; your notes</div>
      {thread.slice(0, -1).map((turn, i) => (
        <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 6 }}>↪ {turn.q}</div>
          <div className="ai-answer-body" dangerouslySetInnerHTML={{ __html: turn.htmlA }} />
        </div>
      ))}
      {status === 'loading' && (
        <div className="loading" style={{ padding: '8px 0' }}>Researching wol.jw.org and your notes...</div>
      )}
      {status === 'error' && (
        <div className="error-msg"><AlertCircle size={14} /> {error}</div>
      )}
      {latest && status !== 'loading' && (
        <>
          {thread.length > 1 && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 6 }}>↪ {latest.q}</div>
          )}
          <div className="ai-answer-body" dangerouslySetInnerHTML={{ __html: latest.htmlA }} />
          <div className="ai-followup-row">
            <div className="search-wrap" style={{ flex: 1 }}>
              <input
                className="search-input"
                placeholder="Ask a follow-up..."
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); askFollowUp(); } }}
              />
            </div>
            <button className="btn-primary small" onClick={askFollowUp} disabled={!followUp.trim()}>Ask</button>
          </div>
        </>
      )}
    </div>
  );
}

function addMonths(year, month, n) {
  const total = year * 12 + (month - 1) + n;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

function monthKey(year, month) { return `${year}-${String(month).padStart(2, '0')}`; }

// Rolling ~12-month window starting this month, unioned with any month that
// already has a trade row — so a far-future confirmation (or an old one kept
// for reference) stays visible even outside the rolling window.
function buildTradeMonths(trades) {
  const today = new Date();
  const keys = new Set();
  for (let i = 0; i < 12; i++) {
    const { year, month } = addMonths(today.getFullYear(), today.getMonth() + 1, i);
    keys.add(monthKey(year, month));
  }
  trades.forEach(t => keys.add(t.trade_month.slice(0, 7)));

  return [...keys].sort().map(key => monthEntryFor(trades, key));
}

function TradeForm({ month, trade, onSave, onClose, onDelete }) {
  const [form, setForm] = useState({
    congregation: trade?.congregation || '',
    coordinator_name: trade?.coordinator_name || '',
    coordinator_phone: trade?.coordinator_phone || '',
    coordinator_email: trade?.coordinator_email || '',
    confirmed_date: trade?.confirmed_date || '',
    notes: trade?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, trade_month: `${month.key}-01`, confirmed_date: form.confirmed_date || null };
      const { data, error: err } = await supabase
        .from('pub_talk_trades')
        .upsert(payload, { onConflict: 'trade_month' })
        .select()
        .single();
      if (err) throw err;
      onSave(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      {error && <div className="error-msg"><AlertCircle size={14} /> {error}</div>}
      <div className="form-row">
        <label>Congregation</label>
        <input value={form.congregation} onChange={e => setForm(f => ({ ...f, congregation: e.target.value }))} placeholder="e.g. Bountiful" />
      </div>
      <div className="form-row">
        <label>Talk Coordinator</label>
        <input value={form.coordinator_name} onChange={e => setForm(f => ({ ...f, coordinator_name: e.target.value }))} placeholder="Name" />
      </div>
      <div className="form-row">
        <label>Phone</label>
        <input value={form.coordinator_phone} onChange={e => setForm(f => ({ ...f, coordinator_phone: e.target.value }))} placeholder="Optional" />
      </div>
      <div className="form-row">
        <label>Email</label>
        <input value={form.coordinator_email} onChange={e => setForm(f => ({ ...f, coordinator_email: e.target.value }))} placeholder="Optional" />
      </div>
      <div className="form-row">
        <label>Confirmed Date</label>
        <input type="date" value={form.confirmed_date} onChange={e => setForm(f => ({ ...f, confirmed_date: e.target.value }))} />
      </div>
      <div className="form-row">
        <label>Notes</label>
        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Anything else worth recording" />
      </div>
      <div className="form-actions">
        {trade && onDelete && (
          <button type="button" className="btn-danger" style={{ marginRight: 'auto' }} onClick={() => onDelete(trade)}>
            <Trash2 size={14} />
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </form>
  );
}

function TradeRow({ entry, onClick }) {
  const { year, month, trade } = entry;
  const label = `${MONTH_NAMES[month - 1]} ${year}`;
  let status, statusStyle;
  if (trade?.confirmed_date) {
    status = `Confirmed ${trade.confirmed_date}`;
    statusStyle = { color: '#4ade80' };
  } else if (trade?.congregation || trade?.coordinator_name) {
    status = 'Not yet confirmed';
    statusStyle = { color: '#facc15' };
  } else {
    status = 'Not arranged';
    statusStyle = { color: 'var(--text-muted)' };
  }

  return (
    <div className="visit-card" style={{ cursor: 'pointer' }} onClick={onClick}>
      <div className="visit-header">
        <span className="visit-date"><Calendar size={13} /> {label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, ...statusStyle }}>{status}</span>
      </div>
      <div className="visit-field">
        <strong>{trade?.congregation || <span style={{ color: 'var(--text-muted)' }}>No congregation set</span>}</strong>
      </div>
      {trade?.coordinator_name && <div className="visit-field">{trade.coordinator_name}</div>}
      {trade?.notes && <div className="visit-notes">{trade.notes}</div>}
    </div>
  );
}

function monthEntryFor(trades, key) {
  const [year, month] = key.split('-').map(Number);
  return { key, year, month, trade: trades.find(t => t.trade_month.slice(0, 7) === key) || null };
}

function AddMonthPicker({ onPick, onClose }) {
  const today = new Date();
  const [value, setValue] = useState(monthKey(today.getFullYear(), today.getMonth() + 1));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value) onPick(value);
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <div className="form-row">
        <label>Month</label>
        <input type="month" value={value} onChange={e => setValue(e.target.value)} required />
      </div>
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary">Continue</button>
      </div>
    </form>
  );
}

function TradesView() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingMonth, setEditingMonth] = useState(null);
  const [pickingMonth, setPickingMonth] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const loadTrades = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('pub_talk_trades').select('*').order('trade_month', { ascending: true });
    setTrades(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadTrades(); }, [loadTrades]);

  const handleSave = (row) => {
    setTrades(prev => {
      const idx = prev.findIndex(t => t.id === row.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = row; return next; }
      return [...prev, row];
    });
    setEditingMonth(null);
  };

  const handleDelete = async (row) => {
    await supabase.from('pub_talk_trades').delete().eq('id', row.id);
    setTrades(prev => prev.filter(t => t.id !== row.id));
    setConfirmDelete(null);
    setEditingMonth(null);
  };

  const months = buildTradeMonths(trades);

  return (
    <div className="detail-view">
      <div className="visits-header">
        <h2>Public Talk Trades <span className="count-badge">{trades.length}</span></h2>
        <button className="btn-primary small" onClick={() => setPickingMonth(true)}><Plus size={14} /> Add Month</button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
        Bilateral month trades confirmed with other congregations. Individual speaker scheduling still happens in NW Scheduler.
        The list below always shows the next 12 months — use Add Month for anything confirmed further out.
      </p>

      {loading ? <div className="loading">Loading trades...</div> : (
        <div className="visits-list">
          {months.map(entry => (
            <TradeRow key={entry.key} entry={entry} onClick={() => setEditingMonth(entry)} />
          ))}
        </div>
      )}

      {pickingMonth && (
        <Modal title="Add Month" onClose={() => setPickingMonth(false)}>
          <AddMonthPicker
            onPick={(key) => { setPickingMonth(false); setEditingMonth(monthEntryFor(trades, key)); }}
            onClose={() => setPickingMonth(false)}
          />
        </Modal>
      )}

      {editingMonth && (
        <Modal title={`${MONTH_NAMES[editingMonth.month - 1]} ${editingMonth.year}`} onClose={() => setEditingMonth(null)}>
          <TradeForm
            month={editingMonth}
            trade={editingMonth.trade}
            onSave={handleSave}
            onClose={() => setEditingMonth(null)}
            onDelete={(row) => setConfirmDelete(row)}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm Delete" onClose={() => setConfirmDelete(null)}>
          <div className="form">
            <p style={{ marginBottom: 16 }}>Clear this month's trade info? This cannot be undone.</p>
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => handleDelete(confirmDelete)}>Delete</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SearchView() {
  const [query, setQuery] = useState('');
  const [askedQuestion, setAskedQuestion] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);

  const runSearch = async (e) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) { setResults(null); setAskedQuestion(''); return; }
    setLoading(true);
    const [studyRes, bearRes] = await Promise.all([
      supabase.from('study_notes').select('*')
        .or(`title.ilike.%${q}%,content.ilike.%${q}%,scripture_ref.ilike.%${q}%,publication_ref.ilike.%${q}%`)
        .limit(50),
      supabase.from('bear_notes').select('*')
        .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
        .limit(50),
    ]);
    const combined = [
      ...(studyRes.data || []).map(n => ({ ...n, source: 'jw' })),
      ...(bearRes.data || []).map(n => ({ ...n, source: 'bear' })),
    ].sort((a, b) => new Date(b.note_modified_at || b.note_created_at || 0) - new Date(a.note_modified_at || a.note_created_at || 0));
    setResults(combined);
    setLoading(false);
    setAskedQuestion(q);
  };

  return (
    <>
      <div className="filters-bar">
        <form onSubmit={runSearch} className="search-wrap" style={{ flex: 1 }}>
          <Search size={16} className="search-icon" />
          <input
            className="search-input"
            placeholder="Ask a question or search JW Library and Bear notes..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button type="button" className="icon-btn small" onClick={() => { setQuery(''); setResults(null); }}>
              <X size={14} />
            </button>
          )}
        </form>
        <BearBulkUploadButton onDone={() => { if (query.trim()) runSearch(); }} />
        <button className="btn-primary small" onClick={() => setShowAddNote(true)}><Plus size={14} /> Add Note</button>
      </div>
      <main className="contacts-list">
        <AIAnswerCard question={askedQuestion} />
        {loading ? (
          <div className="loading">Searching...</div>
        ) : results === null ? (
          <div className="empty-state">
            <Search size={48} />
            <h3>Search everything</h3>
            <p>Ask a question or search across your JW Library notes and Bear talk notes together.</p>
          </div>
        ) : results.length === 0 ? (
          <div className="empty-state">
            <Search size={48} />
            <h3>No note matches</h3>
            <p>No notes matched, but check the research answer above.</p>
          </div>
        ) : (
          <div className="visits-list">
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
              {results.length} note result{results.length !== 1 ? 's' : ''}
            </p>
            {results.map(r => <SearchResultCard key={`${r.source}-${r.id}`} result={r} />)}
          </div>
        )}
      </main>

      {showAddNote && (
        <Modal title="Add Bear Note" onClose={() => setShowAddNote(false)}>
          <AddBearNoteForm
            onSave={() => { setShowAddNote(false); if (query.trim()) runSearch(); }}
            onClose={() => setShowAddNote(false)}
          />
        </Modal>
      )}
    </>
  );
}

function MinistryTracker() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') !== 'false');
  const [tab, setTab] = useState('contacts');
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [territoryFilter, setTerritoryFilter] = useState('all');
  const [territories, setTerritories] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const [contactsRes, visitsRes, studyLogRes, studyNotesRes, bearNotesRes] = await Promise.all([
        supabase.from('contacts').select('*'),
        supabase.from('visits').select('*'),
        supabase.from('study_log').select('*'),
        supabase.from('study_notes').select('*'),
        supabase.from('bear_notes').select('*'),
      ]);
      const backup = {
        exported_at: new Date().toISOString(),
        contacts: contactsRes.data || [],
        visits: visitsRes.data || [],
        study_log: studyLogRes.data || [],
        study_notes: studyNotesRes.data || [],
        bear_notes: bearNotesRes.data || [],
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ministry-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    document.body.className = darkMode ? 'dark' : 'light';
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('contacts')
      .select('*, visits(id)')
      .order('name');
    if (data) {
      const enriched = data.map(c => ({ ...c, visit_count: c.visits?.length || 0 }));
      setContacts(enriched);
      const terrs = [...new Set(enriched.map(c => c.territory).filter(Boolean))].sort();
      setTerritories(terrs);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  const filtered = contacts.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.address?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchTerritory = territoryFilter === 'all' || c.territory === territoryFilter;
    return matchSearch && matchStatus && matchTerritory;
  });

  const handleContactSave = (contact) => {
    setContacts(prev => {
      const idx = prev.findIndex(c => c.id === contact.id);
      const enriched = { ...contact, visit_count: contact.visit_count || 0 };
      if (idx >= 0) { const next = [...prev]; next[idx] = enriched; return next.sort((a,b) => a.name.localeCompare(b.name)); }
      return [...prev, enriched].sort((a,b) => a.name.localeCompare(b.name));
    });
    setShowAddContact(false);
  };

  const handleContactUpdate = (updated) => {
    setContacts(prev => {
      const idx = prev.findIndex(c => c.id === updated.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = { ...next[idx], ...updated }; return next; }
      return prev;
    });
    setSelectedContact(updated);
  };

  const handleBack = (deleted) => {
    if (deleted) {
      setContacts(prev => prev.filter(c => c.id !== selectedContact.id));
    }
    setSelectedContact(null);
  };

  if (selectedContact) {
    return (
      <div className={`app ${darkMode ? 'dark' : 'light'}`}>
        <ContactDetail contact={selectedContact} onBack={handleBack} onUpdate={handleContactUpdate} darkMode={darkMode} />
      </div>
    );
  }

  return (
    <div className={`app ${darkMode ? 'dark' : 'light'}`}>
      <header className="app-header">
        <div className="header-left">
          <BookOpen size={22} className="header-icon" />
          <div>
            <h1 className="app-title">Ministry Tracker</h1>
            <p className="app-subtitle">{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="header-right">
          <button className="icon-btn" onClick={handleExportBackup} disabled={exporting} title="Download a backup of all data as JSON">
            <Download size={18} />
          </button>
          <button className="icon-btn" onClick={() => setDarkMode(d => !d)}>
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="icon-btn" onClick={() => supabase.auth.signOut()} title="Sign out">
            <LogOut size={18} />
          </button>
          {tab === 'contacts' && (
            <button className="btn-primary" onClick={() => setShowAddContact(true)}>
              <Plus size={16} /> Add Contact
            </button>
          )}
        </div>
      </header>

      <div className="tabs-bar">
        <button className={`tab-btn ${tab === 'contacts' ? 'active' : ''}`} onClick={() => setTab('contacts')}>Contacts</button>
        <button className={`tab-btn ${tab === 'studyLog' ? 'active' : ''}`} onClick={() => setTab('studyLog')}>Study Log</button>
        <button className={`tab-btn ${tab === 'studyNotes' ? 'active' : ''}`} onClick={() => setTab('studyNotes')}>Study Notes</button>
        <button className={`tab-btn ${tab === 'search' ? 'active' : ''}`} onClick={() => setTab('search')}>Search</button>
        <button className={`tab-btn ${tab === 'trades' ? 'active' : ''}`} onClick={() => setTab('trades')}>Trades</button>
      </div>

      {tab === 'contacts' && (
        <>
          <div className="filters-bar">
            <div className="search-wrap">
              <Search size={16} className="search-icon" />
              <input className="search-input" placeholder="Search by name or address..." value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button className="icon-btn small" onClick={() => setSearch('')}><X size={14} /></button>}
            </div>
            <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              {Object.entries(STATUS_CONFIG).map(([val, cfg]) => <option key={val} value={val}>{cfg.label}</option>)}
            </select>
            {territories.length > 0 && (
              <select className="filter-select" value={territoryFilter} onChange={e => setTerritoryFilter(e.target.value)}>
                <option value="all">All Territories</option>
                {territories.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </div>

          <main className="contacts-list">
            {loading ? (
              <div className="loading">Loading contacts...</div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <User size={48} />
                <h3>{contacts.length === 0 ? 'No contacts yet' : 'No results found'}</h3>
                <p>{contacts.length === 0 ? 'Add your first return visit contact to get started.' : 'Try adjusting your search or filters.'}</p>
                {contacts.length === 0 && <button className="btn-primary" onClick={() => setShowAddContact(true)}><Plus size={16} /> Add First Contact</button>}
              </div>
            ) : (
              filtered.map(c => <ContactCard key={c.id} contact={c} onClick={setSelectedContact} />)
            )}
          </main>

          {showAddContact && (
            <Modal title="Add New Contact" onClose={() => setShowAddContact(false)}>
              <ContactForm onSave={handleContactSave} onClose={() => setShowAddContact(false)} />
            </Modal>
          )}
        </>
      )}

      {tab === 'studyLog' && <StudyLogView />}
      {tab === 'studyNotes' && <StudyNotesView />}
      {tab === 'search' && <SearchView />}
      {tab === 'trades' && <TradesView />}
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSigningIn(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(err.message);
    setSigningIn(false);
  };

  return (
    <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <form onSubmit={handleSubmit} className="form" style={{ width: '100%', maxWidth: 320 }}>
        <h2 style={{ marginBottom: 4 }}>Ministry Tracker</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Sign in to continue.</p>
        {error && <div className="error-msg"><AlertCircle size={14} /> {error}</div>}
        <div className="form-row">
          <label>Email</label>
          <input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="form-row">
          <label>Password</label>
          <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={signingIn} style={{ width: '100%' }}>
            {signingIn ? 'Signing in...' : 'Sign In'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null; // brief flash while the session is resolved
  if (!session) return <Login />;
  return <MinistryTracker />;
}
