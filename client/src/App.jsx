import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Filter,
  MapPin,
  LogOut,
  LockKeyhole,
  Plus,
  Pencil,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  Save,
  Trash2,
  UploadCloud,
  UserRound,
  Users,
  WalletCards,
  Smartphone,
  X
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const SUPABASE_AUTH_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const SESSION_STORAGE_KEY = 'team-outing-session-v1';
let apiAccessToken = '';
function setApiAccessToken(token) {
  apiAccessToken = token || '';
}

const emptyExpenseForm = {
  title: '',
  amount: '',
  categoryId: '',
  date: new Date().toISOString().slice(0, 10),
  paidByParticipantId: '',
  participantIds: [],
  splitMethod: 'equal',
  customSplitsText: '',
  percentageSplitsText: '',
  paymentMethod: 'UPI',
  notes: '',
  receiptFileName: '',
  receipt: null,
  isRecurring: false,
  approvalStatus: 'pending'
};

const roleDescriptions = {
  admin: 'Can manage event, participants, budgets, expenses, and settlement finalization.',
  member: 'Can view expenses, add personal expenses, upload receipt references, and mark payments.',
  finance: 'Can review and approve expenses before settlement.'
};
function formatSplitLines(splits = [], valueKey) {
  return splits.map((split) => `${split.participantId}:${split[valueKey]}`).join('\n');
}

function buildDefaultExpenseForm(data, expense = null) {
  if (expense) {
    return {
      title: expense.title || '',
      amount: String(expense.amount ?? ''),
      categoryId: expense.categoryId || data.categories[0]?.id || '',
      date: expense.date || new Date().toISOString().slice(0, 10),
      paidByParticipantId: expense.paidByParticipantId || data.participants[0]?.id || '',
      participantIds: expense.participantIds || [],
      splitMethod: expense.splitMethod || 'equal',
      customSplitsText: formatSplitLines(expense.customSplits, 'amount'),
      percentageSplitsText: formatSplitLines(expense.percentageSplits, 'percentage'),
      paymentMethod: expense.paymentMethod || 'UPI',
      notes: expense.notes || '',
      receiptFileName: expense.receipt?.fileName || '',
      receipt: expense.receipt || null,
      isRecurring: Boolean(expense.isRecurring),
      approvalStatus: expense.approvalStatus || 'pending'
    };
  }

  return {
    ...emptyExpenseForm,
    categoryId: data.categories[0]?.id || '',
    paidByParticipantId: data.participants[0]?.id || '',
    participantIds: data.participants.filter((p) => p.attendanceStatus !== 'not-attending').map((p) => p.id)
  };
}

function parseSplitText(text, key) {
  if (!text.trim()) return [];
  return text.split('\n').filter(Boolean).map((line) => {
    const [participantId, rawValue] = line.split(':').map((part) => part.trim());
    return { participantId, [key]: Number(rawValue) };
  });
}

function buildExpensePayload(form) {
  const payload = {
    ...form,
    amount: Number(form.amount),
    receipt: form.receipt || null,
    customSplits: parseSplitText(form.customSplitsText, 'amount'),
    percentageSplits: parseSplitText(form.percentageSplitsText, 'percentage')
  };

  delete payload.customSplitsText;
  delete payload.percentageSplitsText;
  delete payload.receiptFileName;
  return payload;
}

function showActionError(setToast, err) {
  setToast(err?.message || 'Action failed. The app tried, the universe objected.');
}



function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error('Could not read the receipt file. Even the browser gave up.'));
    reader.readAsDataURL(file);
  });
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (apiAccessToken) headers.Authorization = `Bearer ${apiAccessToken}`;

  const response = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: 'Request failed.' }));
    throw new Error(errorBody.error || 'Request failed. The server chose violence.');
  }

  if (response.status === 204) return null;
  return response.json();
}


async function downloadApiFile(path, fileName) {
  const headers = {};
  if (apiAccessToken) headers.Authorization = `Bearer ${apiAccessToken}`;

  const response = await fetch(`${API_BASE}${path}`, { headers });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: 'Download failed.' }));
    throw new Error(errorBody.error || 'Download failed. The file refused to leave the server.');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function reportFileBaseName(eventName = 'team-outing') {
  return String(eventName)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'team-outing';
}


function readSavedSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session) {
  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

async function supabaseAuthRequest(path, payload) {
  if (!SUPABASE_AUTH_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Auth is not configured in Vercel. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
  }

  const response = await fetch(`${SUPABASE_AUTH_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error_description || body.msg || body.error || 'Authentication failed. Even the login form is being dramatic.');
  }
  return body;
}

function AuthScreen({ onSession, setToast }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const payload = mode === 'signup'
        ? { email: form.email, password: form.password, data: { name: form.name || form.email.split('@')[0] } }
        : { email: form.email, password: form.password };
      const path = mode === 'signup' ? 'signup' : 'token?grant_type=password';
      const session = await supabaseAuthRequest(path, payload);

      if (!session.access_token && mode === 'signup') {
        setMessage('Account created. Check your email if confirmation is enabled in Supabase, because apparently even email wants paperwork.');
        return;
      }

      onSession(session);
      setToast(mode === 'signup' ? 'Account created and signed in.' : 'Signed in successfully.');
      if (mode === 'signup') {
        window.setTimeout(() => window.location.reload(), 350);
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-10 text-slate-900">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-2xl bg-slate-950 p-3 text-white"><LockKeyhole size={22} /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Team Outing Expense Tracker</p>
            <h1 className="text-2xl font-black text-slate-950">{mode === 'signup' ? 'Create account' : 'Sign in'}</h1>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === 'signup' && (
            <label className="field-label">Name
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
            </label>
          )}
          <label className="field-label">Email
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" required />
          </label>
          <label className="field-label">Password
            <input className="input" type="password" minLength="6" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Minimum 6 characters" required />
          </label>

          {message && <div className="rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-800 ring-1 ring-amber-200">{message}</div>}

          <button className="btn-primary w-full justify-center" type="submit" disabled={busy}>
            {busy ? 'Working...' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <button
          className="mt-4 w-full text-sm font-bold text-slate-600 hover:text-slate-950"
          type="button"
          onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setMessage(''); }}
        >
          {mode === 'signup' ? 'Already have an account? Sign in' : 'New user? Create an account'}
        </button>
      </div>
    </main>
  );
}

function money(value, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function statusBadge(status) {
  const styles = {
    attending: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    tentative: 'bg-amber-50 text-amber-700 ring-amber-200',
    'not-attending': 'bg-slate-100 text-slate-600 ring-slate-200',
    pending: 'bg-amber-50 text-amber-700 ring-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
    completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    'partially-paid': 'bg-blue-50 text-blue-700 ring-blue-200',
    settled: 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  };

  return `inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${styles[status] || 'bg-slate-100 text-slate-700 ring-slate-200'}`;
}

function Section({ title, icon: Icon, children, action }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="rounded-2xl bg-slate-900 p-2 text-white">
              <Icon size={18} />
            </div>
          )}
          <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value, helper, danger }) {
  return (
    <div className={`rounded-3xl p-5 ring-1 ${danger ? 'bg-rose-50 ring-rose-200' : 'bg-white ring-slate-100'} shadow-soft`}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-black ${danger ? 'text-rose-700' : 'text-slate-950'}`}>{value}</p>
      {helper && <p className="mt-2 text-xs text-slate-500">{helper}</p>}
    </div>
  );
}

function EmptyState({ title, body }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
      <p className="font-bold text-slate-800">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{body}</p>
    </div>
  );
}

function Dashboard({ data }) {
  const { dashboard, event } = data;
  const currency = event.currency;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total budget" value={money(dashboard.totalBudget, currency)} helper="Event-level approved limit" />
        <StatCard label="Total spent" value={money(dashboard.totalSpent, currency)} helper="Approved and pending expenses" />
        <StatCard label="Remaining" value={money(dashboard.remainingBudget, currency)} danger={dashboard.isOverBudget} helper={dashboard.isOverBudget ? 'Over budget. The budget has left the group chat.' : 'Still within budget'} />
        <StatCard label="Planned category budget" value={money(dashboard.plannedBudget, currency)} helper="Sum of category estimates" />
      </div>

      {dashboard.isOverBudget && (
        <div className="flex items-center gap-3 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
          <AlertTriangle size={20} />
          <p className="font-semibold">Warning: actual spending has crossed the estimated event budget.</p>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Category spending" icon={WalletCards}>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboard.categorySpending}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => money(value, currency)} />
                <Legend />
                <Bar dataKey="estimatedCost" name="Estimated" radius={[8, 8, 0, 0]} />
                <Bar dataKey="actualCost" name="Actual" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="Participant balances" icon={Users}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="p-3">Participant</th>
                  <th className="p-3">Paid</th>
                  <th className="p-3">Owed</th>
                  <th className="p-3">Net</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.participantBalances.map((person) => (
                  <tr key={person.participantId} className="border-t border-slate-100">
                    <td className="p-3 font-semibold text-slate-800">{person.name}</td>
                    <td className="p-3">{money(person.amountPaid, currency)}</td>
                    <td className="p-3">{money(person.amountOwed, currency)}</td>
                    <td className={`p-3 font-bold ${person.netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{money(person.netBalance, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </div>
  );
}

function EventSetup({ data, reload, setToast }) {
  const [form, setForm] = useState(data.event);

  async function saveEvent(event) {
    event.preventDefault();
    await api('/event', { method: 'PUT', body: JSON.stringify(form) });
    setToast('Event updated. Civilization survives another form submission.');
    reload();
  }

  return (
    <Section title="Event setup" icon={CalendarDays}>
      <form onSubmit={saveEvent} className="grid gap-4 md:grid-cols-2">
        <label className="field-label">Event name<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
        <label className="field-label">Date<input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label>
        <label className="field-label">Location<input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required /></label>
        <label className="field-label">Estimated budget<input className="input" type="number" min="0" value={form.estimatedBudget} onChange={(e) => setForm({ ...form, estimatedBudget: e.target.value })} required /></label>
        <label className="field-label">Currency<input className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} required /></label>
        <label className="field-label">Settlement deadline<input className="input" type="date" value={form.settlementDeadline || ''} onChange={(e) => setForm({ ...form, settlementDeadline: e.target.value })} /></label>
        <label className="field-label">Organizer name<input className="input" value={form.organizer?.name || ''} onChange={(e) => setForm({ ...form, organizer: { ...form.organizer, name: e.target.value } })} /></label>
        <label className="field-label">Organizer email<input className="input" type="email" value={form.organizer?.email || ''} onChange={(e) => setForm({ ...form, organizer: { ...form.organizer, email: e.target.value } })} /></label>
        <div className="md:col-span-2">
          <button className="btn-primary" type="submit">Save event</button>
        </div>
      </form>
    </Section>
  );
}


function EventsConsole({ data, reload, setToast, onSwitchEvent }) {
  const [form, setForm] = useState({
    name: '',
    date: new Date().toISOString().slice(0, 10),
    location: '',
    estimatedBudget: '',
    currency: data.event.currency || 'INR',
    settlementDeadline: '',
    copyParticipantsFromEventId: ''
  });
  const [busy, setBusy] = useState(false);
  const events = data.eventList || [];
  const currency = data.event.currency;

  async function createEvent(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api('/events', { method: 'POST', body: JSON.stringify(form) });
      setToast('New outing event created and activated. Fresh chaos, neatly separated.');
      setForm({
        name: '',
        date: new Date().toISOString().slice(0, 10),
        location: '',
        estimatedBudget: '',
        currency: data.event.currency || 'INR',
        settlementDeadline: '',
        copyParticipantsFromEventId: ''
      });
      await reload();
    } catch (err) {
      showActionError(setToast, err);
    } finally {
      setBusy(false);
    }
  }

  async function updateEventStatus(eventId, status) {
    setBusy(true);
    try {
      await api(`/events/${eventId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setToast(status === 'active' ? 'Event reactivated.' : `Event marked as ${status}.`);
      await reload();
    } catch (err) {
      showActionError(setToast, err);
    } finally {
      setBusy(false);
    }
  }

  async function deleteDraftEvent(eventId) {
    if (!window.confirm('Delete this event? Only events without expenses can be deleted.')) return;
    setBusy(true);
    try {
      await api(`/events/${eventId}`, { method: 'DELETE' });
      setToast('Draft event deleted. It had one job and failed quietly.');
      await reload();
    } catch (err) {
      showActionError(setToast, err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Section title="Create outing event" icon={CalendarDays}>
        <form onSubmit={createEvent} className="grid gap-4 md:grid-cols-2">
          <label className="field-label">Event name<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Goa Team Outing" /></label>
          <label className="field-label">Date<input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label>
          <label className="field-label">Location<input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required placeholder="Goa, India" /></label>
          <label className="field-label">Estimated budget<input className="input" type="number" min="0" value={form.estimatedBudget} onChange={(e) => setForm({ ...form, estimatedBudget: e.target.value })} required /></label>
          <label className="field-label">Currency<input className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} required /></label>
          <label className="field-label">Settlement deadline<input className="input" type="date" value={form.settlementDeadline} onChange={(e) => setForm({ ...form, settlementDeadline: e.target.value })} /></label>
          <label className="field-label md:col-span-2">Copy participants from existing event
            <select className="input" value={form.copyParticipantsFromEventId} onChange={(e) => setForm({ ...form, copyParticipantsFromEventId: e.target.value })}>
              <option value="">Do not copy participants</option>
              {events.map((eventItem) => <option key={eventItem.id} value={eventItem.id}>{eventItem.name}</option>)}
            </select>
          </label>
          <div className="md:col-span-2"><button className="btn-primary" type="submit" disabled={busy}><Plus size={16} /> Create and switch</button></div>
        </form>
      </Section>

      <Section title="Outing events" icon={CalendarDays}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="p-3">Event</th>
                <th className="p-3">Status</th>
                <th className="p-3">Date</th>
                <th className="p-3">Location</th>
                <th className="p-3">Budget</th>
                <th className="p-3">Spent</th>
                <th className="p-3">People</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((eventItem) => (
                <tr key={eventItem.id} className="border-t border-slate-100 align-top">
                  <td className="p-3">
                    <p className="font-bold text-slate-900">{eventItem.name}</p>
                    {eventItem.id === data.activeEventId && <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Current event</p>}
                  </td>
                  <td className="p-3"><span className={statusBadge(eventItem.status)}>{eventItem.status}</span></td>
                  <td className="p-3">{eventItem.date}</td>
                  <td className="p-3">{eventItem.location}</td>
                  <td className="p-3">{money(eventItem.estimatedBudget, eventItem.currency || currency)}</td>
                  <td className="p-3">{money(eventItem.totalSpent, eventItem.currency || currency)}</td>
                  <td className="p-3">{eventItem.participantCount}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      {eventItem.id !== data.activeEventId && <button className="btn-ghost" type="button" disabled={busy} onClick={() => onSwitchEvent(eventItem.id)}>Switch</button>}
                      {eventItem.status === 'archived' || eventItem.status === 'completed' ? (
                        <button className="btn-ghost" type="button" disabled={busy} onClick={() => updateEventStatus(eventItem.id, 'active')}>Reactivate</button>
                      ) : (
                        <>
                          <button className="btn-ghost" type="button" disabled={busy} onClick={() => updateEventStatus(eventItem.id, 'completed')}>Complete</button>
                          <button className="btn-ghost" type="button" disabled={busy} onClick={() => updateEventStatus(eventItem.id, 'archived')}>Archive</button>
                        </>
                      )}
                      {eventItem.expenseCount === 0 && events.length > 1 && <button className="btn-ghost text-rose-700" type="button" disabled={busy} onClick={() => deleteDraftEvent(eventItem.id)}>Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function Participants({ data, reload, setToast }) {
  const [form, setForm] = useState({ name: '', emailOrPhone: '', attendanceStatus: 'attending' });
  const [editingId, setEditingId] = useState('');
  const [editForm, setEditForm] = useState({ name: '', emailOrPhone: '', attendanceStatus: 'attending', paymentStatus: 'pending' });
  const [busy, setBusy] = useState(false);

  function startEdit(participant) {
    setEditingId(participant.id);
    setEditForm({
      name: participant.name || '',
      emailOrPhone: participant.emailOrPhone || '',
      attendanceStatus: participant.attendanceStatus || 'attending',
      paymentStatus: participant.paymentStatus || 'pending'
    });
  }

  async function addParticipant(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api('/participants', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', emailOrPhone: '', attendanceStatus: 'attending' });
      setToast('Participant added successfully. The attendee herd grows.');
      await reload();
    } catch (err) {
      showActionError(setToast, err);
    } finally {
      setBusy(false);
    }
  }

  async function saveParticipant(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(`/participants/${editingId}`, { method: 'PUT', body: JSON.stringify(editForm) });
      setEditingId('');
      setToast('Participant updated successfully. Behold, editable humans.');
      await reload();
    } catch (err) {
      showActionError(setToast, err);
    } finally {
      setBusy(false);
    }
  }

  async function deleteParticipant(id) {
    if (!window.confirm('Remove this participant? This is blocked if they are linked to expenses.')) return;
    setBusy(true);
    try {
      await api(`/participants/${id}`, { method: 'DELETE' });
      setToast('Participant removed. Quietly, because HR frowns on drama.');
      await reload();
    } catch (err) {
      showActionError(setToast, err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Participants" icon={Users}>
      <form onSubmit={addParticipant} className="mb-5 grid gap-3 md:grid-cols-[1fr_1fr_180px_auto]">
        <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="input" placeholder="Email or phone" value={form.emailOrPhone} onChange={(e) => setForm({ ...form, emailOrPhone: e.target.value })} required />
        <select className="input" value={form.attendanceStatus} onChange={(e) => setForm({ ...form, attendanceStatus: e.target.value })}>
          <option value="attending">Attending</option>
          <option value="tentative">Tentative</option>
          <option value="not-attending">Not attending</option>
        </select>
        <button className="btn-primary" type="submit" disabled={busy}><Plus size={16} /> Add</button>
      </form>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="p-3">Name</th>
              <th className="p-3">Contact</th>
              <th className="p-3">Attendance</th>
              <th className="p-3">Payment</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.participants.map((participant) => (
              <tr key={participant.id} className="border-t border-slate-100 align-top">
                {editingId === participant.id ? (
                  <>
                    <td className="p-3"><input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required /></td>
                    <td className="p-3"><input className="input" value={editForm.emailOrPhone} onChange={(e) => setEditForm({ ...editForm, emailOrPhone: e.target.value })} required /></td>
                    <td className="p-3">
                      <select className="input" value={editForm.attendanceStatus} onChange={(e) => setEditForm({ ...editForm, attendanceStatus: e.target.value })}>
                        <option value="attending">Attending</option>
                        <option value="tentative">Tentative</option>
                        <option value="not-attending">Not attending</option>
                      </select>
                    </td>
                    <td className="p-3">
                      <select className="input" value={editForm.paymentStatus} onChange={(e) => setEditForm({ ...editForm, paymentStatus: e.target.value })}>
                        <option value="pending">Pending</option>
                        <option value="partially-paid">Partially paid</option>
                        <option value="completed">Completed</option>
                        <option value="settled">Settled</option>
                      </select>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button className="btn-ghost" type="button" onClick={saveParticipant} disabled={busy}><Save size={15} /> Save</button>
                        <button className="btn-ghost" type="button" onClick={() => setEditingId('')}><X size={15} /> Cancel</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-3 font-semibold text-slate-800">{participant.name}</td>
                    <td className="p-3 text-slate-600">{participant.emailOrPhone}</td>
                    <td className="p-3"><span className={statusBadge(participant.attendanceStatus)}>{participant.attendanceStatus}</span></td>
                    <td className="p-3"><span className={statusBadge(participant.paymentStatus)}>{participant.paymentStatus}</span></td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button className="btn-ghost" onClick={() => startEdit(participant)} type="button"><Pencil size={15} /> Edit</button>
                        <button className="btn-ghost text-rose-700" onClick={() => deleteParticipant(participant.id)} type="button"><Trash2 size={15} /> Remove</button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function BudgetPlanning({ data, reload, setToast }) {
  const [form, setForm] = useState({ name: '', estimatedCost: '' });
  const [editingId, setEditingId] = useState('');
  const [editForm, setEditForm] = useState({ name: '', estimatedCost: '' });
  const [busy, setBusy] = useState(false);
  const currency = data.event.currency;

  async function addCategory(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api('/categories', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', estimatedCost: '' });
      setToast('Budget category added. A new bucket for money to disappear into.');
      await reload();
    } catch (err) {
      showActionError(setToast, err);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(category) {
    setEditingId(category.id);
    setEditForm({ name: category.name, estimatedCost: String(category.estimatedCost ?? 0) });
  }

  async function saveCategory(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(`/categories/${editingId}`, { method: 'PUT', body: JSON.stringify(editForm) });
      setEditingId('');
      setToast('Budget category updated. The spreadsheet spirits are appeased.');
      await reload();
    } catch (err) {
      showActionError(setToast, err);
    } finally {
      setBusy(false);
    }
  }

  async function deleteCategory(id) {
    if (!window.confirm('Delete this category? This is blocked if expenses already use it.')) return;
    setBusy(true);
    try {
      await api(`/categories/${id}`, { method: 'DELETE' });
      setToast('Budget category deleted. One less place for money to vanish.');
      await reload();
    } catch (err) {
      showActionError(setToast, err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Budget planning" icon={WalletCards}>
      <form onSubmit={addCategory} className="mb-5 grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <input className="input" placeholder="Category name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="input" placeholder="Estimated cost" type="number" min="0" value={form.estimatedCost} onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })} required />
        <button className="btn-primary" type="submit" disabled={busy}><Plus size={16} /> Add</button>
      </form>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.dashboard.categorySpending.map((category) => (
          <div key={category.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            {editingId === category.id ? (
              <form onSubmit={saveCategory} className="space-y-3">
                <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
                <input className="input" type="number" min="0" value={editForm.estimatedCost} onChange={(e) => setEditForm({ ...editForm, estimatedCost: e.target.value })} required />
                <div className="flex flex-wrap gap-2">
                  <button className="btn-ghost" type="submit" disabled={busy}><Save size={15} /> Save</button>
                  <button className="btn-ghost" type="button" onClick={() => setEditingId('')}><X size={15} /> Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{category.name}</p>
                    <p className="text-sm text-slate-500">Estimated {money(category.estimatedCost, currency)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-icon" type="button" onClick={() => startEdit(category)} aria-label="Edit category"><Pencil size={15} /></button>
                    <button className="btn-icon" type="button" onClick={() => deleteCategory(category.id)} aria-label="Delete category"><Trash2 size={15} /></button>
                  </div>
                </div>
                <div className="mt-4 h-2 rounded-full bg-slate-200">
                  <div className="h-2 rounded-full bg-slate-900" style={{ width: `${Math.min((category.actualCost / Math.max(category.estimatedCost, 1)) * 100, 100)}%` }} />
                </div>
                <p className="mt-2 text-sm text-slate-600">Actual {money(category.actualCost, currency)} · Remaining {money(category.remaining, currency)}</p>
              </>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

function Expenses({ data, reload, setToast }) {
  const [form, setForm] = useState(() => buildDefaultExpenseForm(data));
  const [editingExpenseId, setEditingExpenseId] = useState('');
  const [filters, setFilters] = useState({ query: '', categoryId: '', paidByParticipantId: '', approvalStatus: '', fromDate: '', toDate: '' });
  const [busy, setBusy] = useState(false);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const currency = data.event.currency;

  const expenseRows = useMemo(() => {
    const categoryMap = new Map(data.categories.map((category) => [category.id, category.name]));
    const participantMap = new Map(data.participants.map((participant) => [participant.id, participant.name]));
    return data.expenses.map((expense) => ({
      ...expense,
      categoryName: categoryMap.get(expense.categoryId) || 'Uncategorized',
      paidByName: participantMap.get(expense.paidByParticipantId) || 'Unknown'
    }));
  }, [data.categories, data.expenses, data.participants]);

  const filteredExpenses = useMemo(() => {
    return expenseRows.filter((expense) => {
      const matchesQuery = !filters.query || `${expense.title} ${expense.notes}`.toLowerCase().includes(filters.query.toLowerCase());
      const matchesCategory = !filters.categoryId || expense.categoryId === filters.categoryId;
      const matchesPaidBy = !filters.paidByParticipantId || expense.paidByParticipantId === filters.paidByParticipantId;
      const matchesStatus = !filters.approvalStatus || expense.approvalStatus === filters.approvalStatus;
      const matchesFrom = !filters.fromDate || expense.date >= filters.fromDate;
      const matchesTo = !filters.toDate || expense.date <= filters.toDate;
      return matchesQuery && matchesCategory && matchesPaidBy && matchesStatus && matchesFrom && matchesTo;
    });
  }, [expenseRows, filters]);

  function resetForm() {
    setEditingExpenseId('');
    setForm(buildDefaultExpenseForm(data));
  }

  function startEditExpense(expense) {
    setEditingExpenseId(expense.id);
    setForm(buildDefaultExpenseForm(data, expense));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }


  async function uploadReceipt(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setToast('Only JPG, PNG, WebP, and PDF receipts are allowed. The app has standards now, apparently.');
      event.target.value = '';
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setToast('Receipt is too large. Maximum size is 4 MB. Compress it before the cloud starts wheezing.');
      event.target.value = '';
      return;
    }

    setReceiptBusy(true);
    try {
      const base64 = await fileToBase64(file);
      const receipt = await api('/receipts/upload', {
        method: 'POST',
        body: JSON.stringify({ fileName: file.name, contentType: file.type, base64 })
      });
      setForm((current) => ({ ...current, receipt, receiptFileName: receipt.fileName }));
      setToast('Receipt uploaded and attached. The paper trail has entered the chat.');
    } catch (err) {
      showActionError(setToast, err);
    } finally {
      setReceiptBusy(false);
      event.target.value = '';
    }
  }

  function clearReceipt() {
    setForm((current) => ({ ...current, receipt: null, receiptFileName: '' }));
  }

  function toggleParticipant(id) {
    const next = form.participantIds.includes(id)
      ? form.participantIds.filter((participantId) => participantId !== id)
      : [...form.participantIds, id];
    setForm({ ...form, participantIds: next });
  }

  async function saveExpense(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = buildExpensePayload(form);
      if (editingExpenseId) {
        await api(`/expenses/${editingExpenseId}`, { method: 'PUT', body: JSON.stringify({ ...payload, confirmSettledEdit: true }) });
        setToast('Expense updated and balances recalculated. The math goblin has revised its prophecy.');
      } else {
        await api('/expenses', { method: 'POST', body: JSON.stringify(payload) });
        setToast('Expense added and balances recalculated. The math goblin has spoken.');
      }
      resetForm();
      await reload();
    } catch (err) {
      showActionError(setToast, err);
    } finally {
      setBusy(false);
    }
  }

  async function approveExpense(expense, approvalStatus) {
    setBusy(true);
    try {
      await api(`/expenses/${expense.id}`, { method: 'PUT', body: JSON.stringify({ approvalStatus, confirmSettledEdit: true }) });
      setToast(`Expense ${approvalStatus}. Finance has waved its tiny stamp.`);
      await reload();
    } catch (err) {
      showActionError(setToast, err);
    } finally {
      setBusy(false);
    }
  }

  async function deleteExpense(id) {
    if (!window.confirm('Delete this expense? Balances and settlements will recalculate.')) return;
    setBusy(true);
    try {
      await api(`/expenses/${id}?confirm=true`, { method: 'DELETE' });
      setToast('Expense deleted. History is written by whoever has API access.');
      if (editingExpenseId === id) resetForm();
      await reload();
    } catch (err) {
      showActionError(setToast, err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Section title={editingExpenseId ? 'Edit expense' : 'Record an expense'} icon={Receipt} action={editingExpenseId && <button className="btn-ghost" type="button" onClick={resetForm}><X size={15} /> Cancel edit</button>}>
        <form onSubmit={saveExpense} className="grid gap-4 lg:grid-cols-3">
          <label className="field-label">Title<input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
          <label className="field-label">Amount<input className="input" type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></label>
          <label className="field-label">Date<input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label>
          <label className="field-label">Category<select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label className="field-label">Paid by<select className="input" value={form.paidByParticipantId} onChange={(e) => setForm({ ...form, paidByParticipantId: e.target.value })} required>{data.participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.name}</option>)}</select></label>
          <label className="field-label">Payment method<select className="input" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}><option>UPI</option><option>Card</option><option>Cash</option><option>Bank transfer</option><option>Corporate card</option></select></label>
          <label className="field-label">Split method<select className="input" value={form.splitMethod} onChange={(e) => setForm({ ...form, splitMethod: e.target.value })}><option value="equal">Equal among selected</option><option value="selected">Selected participants</option><option value="custom">Custom amount</option><option value="percentage">Percentage</option></select></label>

          <div className="field-label">
            Receipt upload
            <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:border-slate-500">
              <UploadCloud size={16} /> {receiptBusy ? 'Uploading receipt...' : 'Upload JPG, PNG, WebP, or PDF'}
              <input className="hidden" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={uploadReceipt} disabled={receiptBusy || busy} />
            </label>
            {form.receipt && (
              <div className="mt-2 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600 ring-1 ring-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-800">{form.receipt.fileName}</span>
                  <div className="flex gap-2">
                    <a className="btn-ghost" href={form.receipt.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> View</a>
                    <button className="btn-ghost text-rose-700" type="button" onClick={clearReceipt}><X size={14} /> Remove</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <label className="field-label">Approval status<select className="input" value={form.approvalStatus} onChange={(e) => setForm({ ...form, approvalStatus: e.target.value })}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label>

          <div className="lg:col-span-3">
            <p className="field-label mb-2">Participants involved</p>
            <div className="flex flex-wrap gap-2">
              {data.participants.map((participant) => (
                <button key={participant.id} className={`rounded-full px-3 py-2 text-sm ring-1 ${form.participantIds.includes(participant.id) ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-200'}`} type="button" onClick={() => toggleParticipant(participant.id)}>
                  {participant.name}
                </button>
              ))}
            </div>
          </div>

          {form.splitMethod === 'custom' && (
            <label className="field-label lg:col-span-3">Custom splits, one per line: participantId:amount<textarea className="input min-h-24" value={form.customSplitsText} onChange={(e) => setForm({ ...form, customSplitsText: e.target.value })} placeholder="p-001:500\np-002:750" /></label>
          )}
          {form.splitMethod === 'percentage' && (
            <label className="field-label lg:col-span-3">Percentage splits, one per line: participantId:percentage<textarea className="input min-h-24" value={form.percentageSplitsText} onChange={(e) => setForm({ ...form, percentageSplitsText: e.target.value })} placeholder="p-001:40\np-002:60" /></label>
          )}

          <label className="field-label lg:col-span-3">Notes<textarea className="input min-h-24" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.isRecurring} onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })} /> Recurring/shared expense</label>
          <div className="lg:col-span-3"><button className="btn-primary" type="submit" disabled={busy}>{editingExpenseId ? <Save size={16} /> : <Plus size={16} />} {editingExpenseId ? 'Update expense' : 'Save expense'}</button></div>
        </form>
      </Section>

      <Section title="Expense list" icon={Filter}>
        <div className="mb-4 grid gap-3 lg:grid-cols-7">
          <label className="relative lg:col-span-2"><Search className="absolute left-3 top-3 text-slate-400" size={16} /><input className="input pl-10" placeholder="Search expenses" value={filters.query} onChange={(e) => setFilters({ ...filters, query: e.target.value })} /></label>
          <select className="input" value={filters.categoryId} onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}><option value="">All categories</option>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
          <select className="input" value={filters.paidByParticipantId} onChange={(e) => setFilters({ ...filters, paidByParticipantId: e.target.value })}><option value="">Paid by anyone</option>{data.participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.name}</option>)}</select>
          <select className="input" value={filters.approvalStatus} onChange={(e) => setFilters({ ...filters, approvalStatus: e.target.value })}><option value="">Any status</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>
          <input className="input" type="date" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} />
          <input className="input" type="date" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} />
        </div>

        {filteredExpenses.length === 0 ? (
          <EmptyState title="No expenses found" body="Try clearing filters or adding the first expense." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="p-3">Expense</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Paid by</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="border-t border-slate-100 align-top">
                    <td className="p-3"><p className="font-bold text-slate-900">{expense.title}</p><p className="text-xs text-slate-500">{expense.date} · {expense.paymentMethod} · {expense.splitMethod}</p>{expense.receipt && <p className="mt-1 text-xs text-slate-500">Receipt: <a className="font-semibold text-slate-800 underline" href={expense.receipt.url} target="_blank" rel="noreferrer">{expense.receipt.fileName}</a></p>}</td>
                    <td className="p-3">{expense.categoryName}</td>
                    <td className="p-3">{expense.paidByName}</td>
                    <td className="p-3 font-bold">{money(expense.amount, currency)}</td>
                    <td className="p-3"><span className={statusBadge(expense.approvalStatus)}>{expense.approvalStatus}</span></td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button className="btn-ghost" type="button" onClick={() => startEditExpense(expense)}><Pencil size={15} /> Edit</button>
                        <button className="btn-ghost" type="button" onClick={() => approveExpense(expense, 'approved')} disabled={busy}>Approve</button>
                        <button className="btn-ghost" type="button" onClick={() => approveExpense(expense, 'rejected')} disabled={busy}>Reject</button>
                        <button className="btn-ghost text-rose-700" type="button" onClick={() => deleteExpense(expense.id)} disabled={busy}><Trash2 size={15} /> Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

function Settlements({ data, reload, setToast }) {
  const currency = data.event.currency;
  const settlements = data.settlementPlan.settlements;

  async function markSettlement(settlement, status) {
    const paidAmount = status === 'completed' ? settlement.amount : status === 'pending' ? 0 : settlement.paidAmount || settlement.amount / 2;
    await api(`/settlements/${settlement.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        paidAmount,
        transactionReference: status === 'completed' ? `TXN-${Date.now()}` : settlement.transactionReference,
        paymentProofUrl: status === 'completed' ? 'proof-placeholder://uploaded-payment-proof' : settlement.paymentProofUrl
      })
    });
    setToast('Settlement updated. Money has moved, or at least we claim it has.');
    reload();
  }

  return (
    <Section title="Settlement tracking" icon={CheckCircle2}>
      {settlements.length === 0 ? (
        <EmptyState title="No settlements needed" body="Balances are already clean. Suspiciously peaceful." />
      ) : (
        <div className="space-y-4">
          {settlements.map((settlement) => (
            <div key={settlement.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">{settlement.fromName} pays {settlement.toName}</p>
                  <p className="text-2xl font-black text-slate-950">{money(settlement.amount, currency)}</p>
                  {settlement.transactionReference && <p className="text-xs text-slate-500">Ref: {settlement.transactionReference}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={statusBadge(settlement.status)}>{settlement.status}</span>
                  <button className="btn-ghost" onClick={() => markSettlement(settlement, 'partially-paid')} type="button">Partially paid</button>
                  <button className="btn-primary" onClick={() => markSettlement(settlement, 'completed')} type="button">Complete</button>
                </div>
              </div>
            </div>
          ))}
          {data.settlementPlan.allSettled && (
            <div className="rounded-3xl bg-emerald-50 p-4 font-bold text-emerald-800 ring-1 ring-emerald-200">All settled. A miracle with receipts.</div>
          )}
        </div>
      )}
    </Section>
  );
}

function Notifications({ data, setToast }) {
  const [form, setForm] = useState({
    type: 'payment-reminder',
    channel: 'in-app',
    target: 'participants-with-balance',
    title: 'Pending payment reminder',
    message: 'Please clear your team outing balance before the settlement deadline.',
    selectedParticipantIds: []
  });
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);

  const participants = data.participants || [];
  const balanceMap = new Map((data.dashboard?.participantBalances || []).map((balance) => [balance.participantId, balance]));

  async function loadHistory() {
    try {
      setLoadingHistory(true);
      const rows = await api('/notifications');
      setHistory(rows);
    } catch (err) {
      showActionError(setToast, err);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, [data.activeEventId]);

  function toggleParticipant(participantId) {
    const selected = new Set(form.selectedParticipantIds);
    if (selected.has(participantId)) selected.delete(participantId);
    else selected.add(participantId);
    setForm({ ...form, selectedParticipantIds: [...selected] });
  }

  async function sendReminder(event) {
    event.preventDefault();
    try {
      setSending(true);
      const notification = await api('/notifications/send-preview', { method: 'POST', body: JSON.stringify(form) });
      const emailSummary = notification.emailStatus && notification.emailStatus !== 'not-requested' ? ` Email: ${notification.emailStatus}.` : '';
      setToast(`Reminder queued for ${notification.recipientCount || 0} recipient(s).${emailSummary}`);
      await loadHistory();
    } catch (err) {
      showActionError(setToast, err);
    } finally {
      setSending(false);
    }
  }

  async function deleteNotification(notificationId) {
    if (!window.confirm('Delete this reminder from history?')) return;
    try {
      await api(`/notifications/${notificationId}`, { method: 'DELETE' });
      setToast('Reminder removed from history. One less digital breadcrumb.');
      await loadHistory();
    } catch (err) {
      showActionError(setToast, err);
    }
  }

  return (
    <Section title="Notifications and reminders" icon={Bell} action={<button className="btn-ghost" type="button" onClick={loadHistory}>{loadingHistory ? 'Loading...' : 'Refresh history'}</button>}>
      <form onSubmit={sendReminder} className="grid gap-4 md:grid-cols-2">
        <label className="field-label">Type<select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="outing-reminder">Upcoming outing</option><option value="payment-reminder">Pending payment</option><option value="missing-contribution">Missing contribution</option><option value="settlement-deadline">Settlement deadline</option></select></label>
        <label className="field-label">Channel<select className="input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}><option value="in-app">In-app history only</option><option value="email">Email</option><option value="both">In-app + email</option></select></label>
        <label className="field-label">Recipients<select className="input" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })}><option value="participants-with-balance">Participants with pending balance</option><option value="all-participants">All participants with email</option><option value="selected-participants">Selected participants</option></select></label>
        <label className="field-label">Title<input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label className="field-label md:col-span-2">Message<textarea className="input min-h-28" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></label>

        {form.target === 'selected-participants' && (
          <div className="md:col-span-2 rounded-3xl border border-slate-100 bg-slate-50 p-4">
            <p className="mb-3 text-sm font-black text-slate-700">Select recipients</p>
            <div className="grid gap-2 md:grid-cols-2">
              {participants.map((participant) => {
                const balance = balanceMap.get(participant.id);
                return (
                  <label key={participant.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 text-sm ring-1 ring-slate-100">
                    <span><input className="mr-2" type="checkbox" checked={form.selectedParticipantIds.includes(participant.id)} onChange={() => toggleParticipant(participant.id)} />{participant.name}</span>
                    <span className="text-xs text-slate-500">{participant.emailOrPhone || 'No email'} · Net {money(balance?.netBalance || 0, data.event.currency)}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="md:col-span-2 flex flex-wrap items-center gap-3">
          <button className="btn-primary" type="submit" disabled={sending}>{sending ? 'Sending...' : 'Send / queue reminder'}</button>
          <p className="text-xs text-slate-500">Email delivery works when SMTP is configured in Render. Without SMTP, reminders are stored in-app only. Technology, generously giving us another config screen.</p>
        </div>
      </form>

      <div className="mt-8">
        <h3 className="mb-3 text-lg font-black text-slate-950">Reminder history</h3>
        {history.length === 0 ? (
          <EmptyState title="No reminders yet" body="Send one above and it will appear here with recipient delivery status." />
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div key={item.id} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-500">{item.type} · {item.channel} · {new Date(item.createdAt).toLocaleString()}</p>
                    <p className="text-lg font-black text-slate-950">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                    <p className="mt-2 text-xs text-slate-500">Recipients: {item.recipientCount || item.recipients?.length || 0} · Email status: {item.emailStatus || 'not-requested'} · Created by {item.createdByName || 'Unknown'}</p>
                  </div>
                  <button className="btn-ghost text-rose-700" type="button" onClick={() => deleteNotification(item.id)}>Delete</button>
                </div>
                {Array.isArray(item.recipients) && item.recipients.length > 0 && (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {item.recipients.map((recipient) => (
                      <div key={`${item.id}-${recipient.participantId}-${recipient.email}`} className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
                        <span className="font-bold text-slate-800">{recipient.name}</span> · {recipient.email} · {recipient.deliveryStatus || 'queued'}{recipient.error ? ` · ${recipient.error}` : ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}


function NotificationInbox({ open, onClose, items, loading, onRefresh, onMarkRead, onMarkAllRead, currentRole }) {
  const unreadCount = items.filter((item) => !item.read).length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 bg-slate-950/50 px-4 py-6 backdrop-blur-sm" onClick={onClose}>
      <div className="ml-auto flex h-full w-full max-w-xl flex-col rounded-3xl bg-white shadow-soft ring-1 ring-slate-200" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Notification inbox</p>
            <h2 className="text-2xl font-black text-slate-950">{unreadCount} unread</h2>
            <p className="mt-1 text-sm text-slate-500">
              {currentRole === 'member'
                ? 'Personal reminders for events where you are tagged as a participant.'
                : 'Reminder inbox for the selected event.'}
            </p>
          </div>
          <button className="rounded-2xl bg-slate-100 p-2 text-slate-700 hover:bg-slate-200" type="button" onClick={onClose} aria-label="Close notification inbox">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <button className="btn-ghost" type="button" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={16} /> {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="btn-primary" type="button" onClick={onMarkAllRead} disabled={!unreadCount || loading}>
            <CheckCircle2 size={16} /> Mark all read
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && items.length === 0 ? (
            <EmptyState title="Loading inbox" body="Fetching reminders. The bell is checking its paperwork." />
          ) : items.length === 0 ? (
            <EmptyState title="No notifications" body="No reminders for this event yet. A peaceful silence, somehow suspicious." />
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className={`rounded-3xl border p-4 shadow-sm ${item.read ? 'border-slate-100 bg-white' : 'border-blue-200 bg-blue-50'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">{item.type || 'reminder'} · {item.channel || 'in-app'} · {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Unknown time'}</p>
                      <h3 className="mt-1 text-lg font-black text-slate-950">{item.title}</h3>
                      <p className="mt-1 text-sm text-slate-700">{item.message}</p>
                      <p className="mt-2 text-xs text-slate-500">Created by {item.createdByName || 'Unknown'} · Recipients visible to you: {item.recipientCount || 0} · Email: {item.emailStatus || 'not-requested'}</p>
                    </div>
                    {!item.read ? (
                      <button className="btn-ghost" type="button" onClick={() => onMarkRead(item.id)}>Mark read</button>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">Read</span>
                    )}
                  </div>
                  {Array.isArray(item.recipients) && item.recipients.length > 0 && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {item.recipients.map((recipient) => (
                        <div key={`${item.id}-${recipient.participantId}-${recipient.email}`} className="rounded-2xl bg-white/80 p-3 text-xs text-slate-600 ring-1 ring-slate-100">
                          <span className="font-bold text-slate-800">{recipient.name}</span> · {recipient.email} · {recipient.deliveryStatus || 'queued'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Reports({ data, setToast }) {
  const currency = data.event.currency;
  const [busy, setBusy] = useState('');
  const pieData = data.dashboard.categorySpending.filter((category) => category.actualCost > 0).map((category) => ({ name: category.name, value: category.actualCost }));
  const baseName = reportFileBaseName(data.event.name);

  async function downloadReport(type) {
    setBusy(type);
    try {
      if (type === 'pdf') {
        await downloadApiFile('/reports.pdf', `${baseName}-expense-report.pdf`);
        setToast('PDF report downloaded. The finance paperwork has achieved physical form.');
      } else {
        await downloadApiFile('/reports.csv', `${baseName}-expense-report.csv`);
        setToast('CSV report downloaded. Spreadsheet goblins may now feast.');
      }
    } catch (err) {
      showActionError(setToast, err);
    } finally {
      setBusy('');
    }
  }

  const reportAction = (
    <div className="flex flex-wrap gap-2">
      <button className="btn-primary" type="button" onClick={() => downloadReport('pdf')} disabled={Boolean(busy)}>
        <Download size={16} /> {busy === 'pdf' ? 'Preparing PDF...' : 'Export PDF'}
      </button>
      <button className="btn-ghost" type="button" onClick={() => downloadReport('csv')} disabled={Boolean(busy)}>
        <Download size={16} /> {busy === 'csv' ? 'Preparing CSV...' : 'Export CSV'}
      </button>
    </div>
  );

  return (
    <Section title="Reports and export" icon={FileText} action={reportAction}>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4">
          <h3 className="font-bold text-slate-900">Event report summary</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><dt>Total event cost</dt><dd className="font-bold">{money(data.dashboard.totalSpent, currency)}</dd></div>
            <div className="flex justify-between"><dt>Remaining budget</dt><dd className="font-bold">{money(data.dashboard.remainingBudget, currency)}</dd></div>
            <div className="flex justify-between"><dt>Receipts attached</dt><dd className="font-bold">{data.expenses.filter((expense) => expense.receipt).length}</dd></div>
            <div className="flex justify-between"><dt>Settlement items</dt><dd className="font-bold">{data.settlementPlan.settlements.length}</dd></div>
          </dl>
          <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-600 ring-1 ring-slate-200">
            <p className="font-bold text-slate-900">PDF export includes</p>
            <p className="mt-2">Event details, budget summary, category spending, participant contribution, settlement summary, expense list, receipt references, and your developer signature.</p>
          </div>
        </div>
        <div className="h-80 rounded-2xl bg-slate-50 p-4">
          {pieData.length === 0 ? <EmptyState title="No chart data" body="Add expenses to visualize spending." /> : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={105} label>
                  {pieData.map((entry) => <Cell key={entry.name} />)}
                </Pie>
                <Tooltip formatter={(value) => money(value, currency)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </Section>
  );
}


function InstallAppButton({ setToast }) {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    setIsInstalled(Boolean(standalone));

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }

    function handleInstalled() {
      setIsInstalled(true);
      setInstallPrompt(null);
      setToast('App installed. Your phone now has one more thing to judge you from.');
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [setToast]);

  async function install() {
    if (!installPrompt) {
      setToast('Use your browser menu and choose Install app or Add to Home Screen. Browsers enjoy hiding useful buttons.');
      return;
    }

    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  if (isInstalled) {
    return <span className="rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 ring-1 ring-emerald-200">Installed</span>;
  }

  return (
    <button className="rounded-2xl bg-white px-4 py-2 font-bold text-slate-950" onClick={install} type="button">
      <Smartphone className="inline" size={16} /> Install app
    </button>
  );
}

function Roles({ data, reload, setToast }) {
  const [busyUserId, setBusyUserId] = useState('');
  const currentUser = data.currentUser;
  const users = data.users || [];

  async function updateRole(userId, role) {
    setBusyUserId(userId);
    try {
      await api(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify({ role }) });
      setToast('Role updated. Power redistributed, hopefully responsibly.');
      await reload();
    } catch (err) {
      showActionError(setToast, err);
    } finally {
      setBusyUserId('');
    }
  }

  return (
    <div className="space-y-5">
      <Section title="Current signed-in user" icon={UserRound}>
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
          <p className="text-sm text-slate-500">Signed in as</p>
          <p className="mt-1 text-lg font-black text-slate-950">{currentUser?.name || currentUser?.email}</p>
          <p className="text-sm text-slate-600">{currentUser?.email}</p>
          <span className={statusBadge(currentUser?.role || 'member')}>{currentUser?.role || 'member'}</span>
        </div>
      </Section>

      <Section title="Roles and permissions" icon={ShieldCheck}>
        <div className="grid gap-3 md:grid-cols-3">
          {Object.entries(roleDescriptions).map(([role, description]) => (
            <div key={role} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="font-black capitalize text-slate-950">{role}</p>
              <p className="mt-2 text-sm text-slate-600">{description}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="User access" icon={Users}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">Last login</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-slate-100">
                  <td className="p-3 font-semibold text-slate-800">{user.name}</td>
                  <td className="p-3 text-slate-600">{user.email}</td>
                  <td className="p-3">
                    {currentUser?.role === 'admin' ? (
                      <select className="input max-w-40" value={user.role} disabled={busyUserId === user.id} onChange={(e) => updateRole(user.id, e.target.value)}>
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="finance">Finance</option>
                      </select>
                    ) : (
                      <span className={statusBadge(user.role)}>{user.role}</span>
                    )}
                  </td>
                  <td className="p-3 text-slate-500">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Not recorded'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [session, setSession] = useState(() => readSavedSession());
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxItems, setInboxItems] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(false);

  function handleSession(nextSession) {
    const hasToken = Boolean(nextSession?.access_token);
    setLoading(hasToken);
    setError('');
    if (hasToken) {
      setData(null);
    }
    setSession(nextSession);
    saveSession(nextSession);
    setApiAccessToken(nextSession?.access_token || '');
  }

  function logout() {
    handleSession(null);
    setData(null);
    setError('');
    setToast('Signed out. The app will now stop trusting you, professionally.');
  }

  async function reload() {
    try {
      setLoading(true);
      const bootstrap = await api('/bootstrap');
      setData(bootstrap);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function switchEvent(eventId) {
    try {
      await api(`/events/${eventId}/activate`, { method: 'POST' });
      setActiveTab('dashboard');
      setToast('Switched outing event. Different trip, same financial consequences.');
      await reload();
    } catch (err) {
      showActionError(setToast, err);
    }
  }


  async function loadNotificationInbox() {
    if (!session?.access_token || !data) return;
    try {
      setInboxLoading(true);
      const rows = await api('/notification-inbox');
      setInboxItems(rows);
    } catch (err) {
      showActionError(setToast, err);
    } finally {
      setInboxLoading(false);
    }
  }

  async function markNotificationRead(notificationId) {
    try {
      const updated = await api(`/notification-inbox/${notificationId}/read`, { method: 'POST' });
      setInboxItems((items) => items.map((item) => item.id === notificationId ? updated : item));
    } catch (err) {
      showActionError(setToast, err);
    }
  }

  async function markAllNotificationsRead() {
    try {
      await api('/notification-inbox/read-all', { method: 'POST' });
      await loadNotificationInbox();
      setToast('Inbox marked as read. The bell has been pacified.');
    } catch (err) {
      showActionError(setToast, err);
    }
  }

  useEffect(() => {
    setApiAccessToken(session?.access_token || '');
    if (session?.access_token) {
      reload();
    } else {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (data?.activeEventId && session?.access_token) {
      loadNotificationInbox();
    }
  }, [data?.activeEventId, session?.access_token]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const currentRole = data?.currentUser?.role || 'member';
  const canViewEvents = currentRole === 'admin' || currentRole === 'finance';
  const canSwitchEvents = canViewEvents || (currentRole === 'member' && (data?.eventList?.length || 0) > 1);
  const canViewNotifications = currentRole === 'admin' || currentRole === 'finance';
  const canViewRoles = currentRole === 'admin';
  const unreadInboxCount = inboxItems.filter((item) => !item.read).length;

  const tabs = useMemo(() => {
    const visibleTabs = [
      ['dashboard', 'Dashboard']
    ];

    if (canViewEvents) {
      visibleTabs.push(['events', 'Events']);
    }

    visibleTabs.push(
      ['event', 'Event setup'],
      ['participants', 'Participants'],
      ['budget', 'Budget'],
      ['expenses', 'Expenses'],
      ['settlements', 'Settlements'],
      ['reports', 'Reports']
    );

    if (canViewNotifications) {
      visibleTabs.push(['notifications', 'Notifications']);
    }

    if (canViewRoles) {
      visibleTabs.push(['roles', 'Roles']);
    }

    return visibleTabs;
  }, [canViewEvents, canViewNotifications, canViewRoles]);

  useEffect(() => {
    const canAccessActiveTab = tabs.some(([key]) => key === activeTab);
    if (!canAccessActiveTab) {
      setActiveTab('dashboard');
    }
  }, [activeTab, tabs]);

  if (!session?.access_token) {
    return <AuthScreen onSession={handleSession} setToast={setToast} />;
  }

  if (loading && !data) {
    return <div className="grid min-h-screen place-items-center bg-slate-100 text-slate-700">Loading outing finances, because chaos needs a progress spinner.</div>;
  }

  if (error && !data) {
    return <div className="grid min-h-screen place-items-center bg-slate-100 p-6"><div className="rounded-3xl bg-white p-6 shadow-soft"><p className="font-bold text-rose-700">{error}</p><button className="btn-primary mt-4" onClick={reload}>Retry</button></div></div>;
  }

  if (!data) {
    return <div className="grid min-h-screen place-items-center bg-slate-100 text-slate-700">Loading your account and outing data...</div>;
  }

  const currency = data.event.currency;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Team Outing Expense Tracker</p>
              <h1 className="mt-2 text-3xl font-black md:text-5xl">{data.event.name}</h1>
              <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-300">
                <span className="inline-flex items-center gap-2"><CalendarDays size={16} /> {data.event.date}</span>
                <span className="inline-flex items-center gap-2"><MapPin size={16} /> {data.event.location}</span>
                <span className="inline-flex items-center gap-2"><Users size={16} /> {data.participants.length} participants</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {canSwitchEvents && data.eventList?.length > 0 && (
                <select
                  className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950"
                  value={data.activeEventId || ''}
                  onChange={(e) => switchEvent(e.target.value)}
                  aria-label="Switch outing event"
                >
                  {data.eventList.map((eventItem) => <option key={eventItem.id} value={eventItem.id}>{eventItem.name}</option>)}
                </select>
              )}
              {data.currentUser && (
                <div className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/20">
                  {data.currentUser.name || data.currentUser.email} · {data.currentUser.role}
                </div>
              )}
              <button
                className="relative rounded-2xl bg-white px-4 py-2 font-bold text-slate-950"
                type="button"
                onClick={() => { setInboxOpen(true); loadNotificationInbox(); }}
                aria-label="Open notification inbox"
              >
                <Bell className="inline" size={16} /> Inbox
                {unreadInboxCount > 0 && (
                  <span className="absolute -right-2 -top-2 rounded-full bg-rose-600 px-2 py-0.5 text-xs font-black text-white">{unreadInboxCount}</span>
                )}
              </button>
              <InstallAppButton setToast={setToast} />
              <button className="rounded-2xl bg-white px-4 py-2 font-bold text-slate-950" onClick={reload} type="button"><RefreshCw className="inline" size={16} /> Refresh</button>
              <button className="rounded-2xl bg-white px-4 py-2 font-bold text-slate-950" onClick={logout} type="button"><LogOut className="inline" size={16} /> Sign out</button>
            </div>
          </div>
        </div>
      </header>

      <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
          {tabs.map(([key, label]) => (
            <button key={key} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${activeTab === key ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`} onClick={() => setActiveTab(key)} type="button">
              {label}
            </button>
          ))}
        </div>
      </nav>

      <NotificationInbox
        open={inboxOpen}
        onClose={() => setInboxOpen(false)}
        items={inboxItems}
        loading={inboxLoading}
        onRefresh={loadNotificationInbox}
        onMarkRead={markNotificationRead}
        onMarkAllRead={markAllNotificationsRead}
        currentRole={currentRole}
      />

      {toast && <div className="fixed right-4 top-4 z-20 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-soft">{toast}</div>}
      {error && <div className="mx-auto mt-4 max-w-7xl px-4 sm:px-6 lg:px-8"><div className="rounded-2xl bg-rose-50 p-4 text-rose-800 ring-1 ring-rose-200">{error}</div></div>}

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {activeTab === 'dashboard' && <Dashboard data={data} />}
        {activeTab === 'events' && canViewEvents && <EventsConsole data={data} reload={reload} setToast={setToast} onSwitchEvent={switchEvent} />}
        {activeTab === 'event' && <EventSetup data={data} reload={reload} setToast={setToast} />}
        {activeTab === 'participants' && <Participants data={data} reload={reload} setToast={setToast} />}
        {activeTab === 'budget' && <BudgetPlanning data={data} reload={reload} setToast={setToast} />}
        {activeTab === 'expenses' && <Expenses data={data} reload={reload} setToast={setToast} />}
        {activeTab === 'settlements' && <Settlements data={data} reload={reload} setToast={setToast} />}
        {activeTab === 'reports' && <Reports data={data} setToast={setToast} />}
        {activeTab === 'notifications' && canViewNotifications && <Notifications data={data} setToast={setToast} />}
        {activeTab === 'roles' && canViewRoles && <Roles data={data} reload={reload} setToast={setToast} />}
      </div>

      <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-slate-500 sm:px-6 lg:px-8">
        Mobile PWA mode · PostgreSQL/Supabase-ready backend · Currency: {currency} · Designed, engineered, and deployed by Satheeshkumar Balaji.
      </footer>
    </main>
  );
}
