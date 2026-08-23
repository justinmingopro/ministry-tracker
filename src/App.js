import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import {
  Search, Plus, ChevronLeft, BookOpen, MapPin, Phone,
  User, Calendar, Tag, Edit2, Trash2, X, Sun, Moon,
  Filter, ChevronDown, AlertCircle
} from 'lucide-react';
import './App.css';

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

function StudyLogForm({ entry, onSave, onClose }) {
  const [form, setForm] = useState({
    log_date: entry?.log_date || new Date().toISOString().split('T')[0],
    scripture_ref: entry?.scripture_ref || '',
    topic: entry?.topic || '',
    notes: entry?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const pushToCalendar = async (savedEntry) => {
    try {
      const resp = await fetch('/api/calendar-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      if (calData.eventId && calData.eventId !== savedEntry.calendar_event_id) {
        await supabase.from('study_log').update({ calendar_event_id: calData.eventId }).eq('id', savedEntry.id);
        savedEntry.calendar_event_id = calData.eventId;
      }
    } catch (calErr) {
      console.warn('Calendar push failed:', calErr);
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
      await pushToCalendar(data);
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
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : entry ? 'Save Changes' : 'Log Study'}</button>
      </div>
    </form>
  );
}

function StudyLogCard({ entry, onEdit, onDelete }) {
  const date = new Date(entry.log_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  return (
    <div className="visit-card">
      <div className="visit-header">
        <span className="visit-date"><Calendar size={13} /> {date}</span>
        <div className="visit-actions">
          <button className="icon-btn small" onClick={() => onEdit(entry)}><Edit2 size={13} /></button>
          <button className="icon-btn small danger" onClick={() => onDelete(entry)}><Trash2 size={13} /></button>
        </div>
      </div>
      {entry.scripture_ref && <div className="visit-field"><BookOpen size={13} /> <span><strong>Scripture:</strong> {entry.scripture_ref}</span></div>}
      {entry.topic && <div className="visit-field"><Tag size={13} /> <span><strong>Topic:</strong> {entry.topic}</span></div>}
      {entry.notes && <div className="visit-notes">{entry.notes}</div>}
    </div>
  );
}

function StudyLogView() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

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
        await fetch('/api/calendar-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', eventId: entry.calendar_event_id }),
        });
      } catch (calErr) {
        console.warn('Calendar delete failed:', calErr);
      }
    }
    await supabase.from('study_log').delete().eq('id', entry.id);
    setEntries(prev => prev.filter(e => e.id !== entry.id));
    setConfirmDelete(null);
  };

  return (
    <div className="detail-view">
      <div className="visits-header">
        <h2>Study Log <span className="count-badge">{entries.length}</span></h2>
        <button className="btn-primary small" onClick={() => setShowForm(true)}><Plus size={14} /> Log Study</button>
      </div>

      {loading ? <div className="loading">Loading study log...</div> :
        entries.length === 0 ? (
          <div className="empty-visits">
            <BookOpen size={32} />
            <p>No study entries logged yet.</p>
            <button className="btn-primary" onClick={() => setShowForm(true)}>Log First Entry</button>
          </div>
        ) : (
          <div className="visits-list">
            {entries.map(e => (
              <StudyLogCard key={e.id} entry={e}
                onEdit={entry => { setEditingEntry(entry); setShowForm(true); }}
                onDelete={entry => setConfirmDelete(entry)} />
            ))}
          </div>
        )
      }

      {showForm && (
        <Modal title={editingEntry ? 'Edit Study Entry' : 'Log Study'} onClose={() => { setShowForm(false); setEditingEntry(null); }}>
          <StudyLogForm entry={editingEntry} onSave={handleSave} onClose={() => { setShowForm(false); setEditingEntry(null); }} />
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

export default function App() {
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
          <button className="icon-btn" onClick={() => setDarkMode(d => !d)}>
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
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
    </div>
  );
}
