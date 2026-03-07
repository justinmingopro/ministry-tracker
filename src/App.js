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

export default function App() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') !== 'false');
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
          <button className="btn-primary" onClick={() => setShowAddContact(true)}>
            <Plus size={16} /> Add Contact
          </button>
        </div>
      </header>

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
    </div>
  );
}
