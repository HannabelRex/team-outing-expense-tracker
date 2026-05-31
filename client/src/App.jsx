import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  Download,
  FileText,
  Filter,
  MapPin,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  WalletCards,
  Smartphone
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
  isRecurring: false,
  approvalStatus: 'pending'
};

const roleDescriptions = {
  admin: 'Can manage event, participants, budgets, expenses, and settlement finalization.',
  member: 'Can view expenses, add personal expenses, upload receipt references, and mark payments.',
  finance: 'Can review and approve expenses before settlement.'
};

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: 'Request failed.' }));
    throw new Error(errorBody.error || 'Request failed. The server chose violence.');
  }

  if (response.status === 204) return null;
  return response.json();
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

function Participants({ data, reload, setToast }) {
  const [form, setForm] = useState({ name: '', emailOrPhone: '', attendanceStatus: 'attending' });

  async function addParticipant(event) {
    event.preventDefault();
    await api('/participants', { method: 'POST', body: JSON.stringify(form) });
    setForm({ name: '', emailOrPhone: '', attendanceStatus: 'attending' });
    setToast('Participant added. The attendee herd grows.');
    reload();
  }

  async function updateParticipant(id, patch) {
    await api(`/participants/${id}`, { method: 'PUT', body: JSON.stringify(patch) });
    reload();
  }

  async function deleteParticipant(id) {
    await api(`/participants/${id}`, { method: 'DELETE' });
    setToast('Participant removed. Quietly, because HR frowns on drama.');
    reload();
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
        <button className="btn-primary" type="submit"><Plus size={16} /> Add</button>
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
              <tr key={participant.id} className="border-t border-slate-100">
                <td className="p-3 font-semibold text-slate-800">{participant.name}</td>
                <td className="p-3 text-slate-600">{participant.emailOrPhone}</td>
                <td className="p-3">
                  <select className="rounded-xl border border-slate-200 px-3 py-1" value={participant.attendanceStatus} onChange={(e) => updateParticipant(participant.id, { attendanceStatus: e.target.value })}>
                    <option value="attending">Attending</option>
                    <option value="tentative">Tentative</option>
                    <option value="not-attending">Not attending</option>
                  </select>
                </td>
                <td className="p-3"><span className={statusBadge(participant.paymentStatus)}>{participant.paymentStatus}</span></td>
                <td className="p-3">
                  <button className="btn-ghost text-rose-700" onClick={() => deleteParticipant(participant.id)} type="button"><Trash2 size={15} /> Remove</button>
                </td>
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
  const currency = data.event.currency;

  async function addCategory(event) {
    event.preventDefault();
    await api('/categories', { method: 'POST', body: JSON.stringify(form) });
    setForm({ name: '', estimatedCost: '' });
    setToast('Budget category added. A new bucket for money to disappear into.');
    reload();
  }

  async function deleteCategory(id) {
    await api(`/categories/${id}`, { method: 'DELETE' });
    reload();
  }

  return (
    <Section title="Budget planning" icon={WalletCards}>
      <form onSubmit={addCategory} className="mb-5 grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <input className="input" placeholder="Category name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="input" placeholder="Estimated cost" type="number" min="0" value={form.estimatedCost} onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })} required />
        <button className="btn-primary" type="submit"><Plus size={16} /> Add</button>
      </form>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.dashboard.categorySpending.map((category) => (
          <div key={category.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-slate-900">{category.name}</p>
                <p className="text-sm text-slate-500">Estimated {money(category.estimatedCost, currency)}</p>
              </div>
              <button className="btn-icon" type="button" onClick={() => deleteCategory(category.id)}><Trash2 size={15} /></button>
            </div>
            <div className="mt-4 h-2 rounded-full bg-slate-200">
              <div className="h-2 rounded-full bg-slate-900" style={{ width: `${Math.min((category.actualCost / Math.max(category.estimatedCost, 1)) * 100, 100)}%` }} />
            </div>
            <p className="mt-2 text-sm text-slate-600">Actual {money(category.actualCost, currency)} · Remaining {money(category.remaining, currency)}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Expenses({ data, reload, setToast }) {
  const [form, setForm] = useState(() => ({
    ...emptyExpenseForm,
    categoryId: data.categories[0]?.id || '',
    paidByParticipantId: data.participants[0]?.id || '',
    participantIds: data.participants.filter((p) => p.attendanceStatus !== 'not-attending').map((p) => p.id)
  }));
  const [filters, setFilters] = useState({ query: '', categoryId: '', paidByParticipantId: '', paymentStatus: '', fromDate: '', toDate: '' });
  const currency = data.event.currency;

  const filteredExpenses = useMemo(() => {
    return data.dashboard.expenses.filter((expense) => {
      const matchesQuery = !filters.query || `${expense.title} ${expense.notes}`.toLowerCase().includes(filters.query.toLowerCase());
      const matchesCategory = !filters.categoryId || expense.categoryId === filters.categoryId;
      const matchesPaidBy = !filters.paidByParticipantId || expense.paidByParticipantId === filters.paidByParticipantId;
      const matchesStatus = !filters.paymentStatus || expense.approvalStatus === filters.paymentStatus;
      const matchesFrom = !filters.fromDate || expense.date >= filters.fromDate;
      const matchesTo = !filters.toDate || expense.date <= filters.toDate;
      return matchesQuery && matchesCategory && matchesPaidBy && matchesStatus && matchesFrom && matchesTo;
    });
  }, [data.dashboard.expenses, filters]);

  function toggleParticipant(id) {
    const next = form.participantIds.includes(id)
      ? form.participantIds.filter((participantId) => participantId !== id)
      : [...form.participantIds, id];
    setForm({ ...form, participantIds: next });
  }

  function parseSplitText(text, key) {
    if (!text.trim()) return [];
    return text.split('\n').map((line) => {
      const [participantId, rawValue] = line.split(':').map((part) => part.trim());
      return { participantId, [key]: Number(rawValue) };
    });
  }

  async function addExpense(event) {
    event.preventDefault();
    const payload = {
      ...form,
      amount: Number(form.amount),
      receipt: form.receiptFileName ? { fileName: form.receiptFileName, url: `receipt-placeholder://${form.receiptFileName}` } : null,
      customSplits: parseSplitText(form.customSplitsText, 'amount'),
      percentageSplits: parseSplitText(form.percentageSplitsText, 'percentage')
    };

    delete payload.customSplitsText;
    delete payload.percentageSplitsText;
    delete payload.receiptFileName;

    await api('/expenses', { method: 'POST', body: JSON.stringify(payload) });
    setForm({
      ...emptyExpenseForm,
      categoryId: data.categories[0]?.id || '',
      paidByParticipantId: data.participants[0]?.id || '',
      participantIds: data.participants.filter((p) => p.attendanceStatus !== 'not-attending').map((p) => p.id)
    });
    setToast('Expense added and balances recalculated. The math goblin has spoken.');
    reload();
  }

  async function approveExpense(expense, approvalStatus) {
    await api(`/expenses/${expense.id}`, { method: 'PUT', body: JSON.stringify({ ...expense, approvalStatus }) });
    reload();
  }

  async function deleteExpense(id) {
    await api(`/expenses/${id}?confirm=true`, { method: 'DELETE' });
    setToast('Expense deleted. History is written by whoever has API access.');
    reload();
  }

  return (
    <div className="space-y-6">
      <Section title="Record an expense" icon={Receipt}>
        <form onSubmit={addExpense} className="grid gap-4 lg:grid-cols-3">
          <label className="field-label">Title<input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
          <label className="field-label">Amount<input className="input" type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></label>
          <label className="field-label">Date<input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label>
          <label className="field-label">Category<select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label className="field-label">Paid by<select className="input" value={form.paidByParticipantId} onChange={(e) => setForm({ ...form, paidByParticipantId: e.target.value })} required>{data.participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.name}</option>)}</select></label>
          <label className="field-label">Payment method<select className="input" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}><option>UPI</option><option>Card</option><option>Cash</option><option>Bank transfer</option><option>Corporate card</option></select></label>
          <label className="field-label">Split method<select className="input" value={form.splitMethod} onChange={(e) => setForm({ ...form, splitMethod: e.target.value })}><option value="equal">Equal among selected</option><option value="selected">Selected participants</option><option value="custom">Custom amount</option><option value="percentage">Percentage</option></select></label>
          <label className="field-label">Receipt file name<input className="input" placeholder="receipt.jpg or invoice.pdf" value={form.receiptFileName} onChange={(e) => setForm({ ...form, receiptFileName: e.target.value })} /></label>
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
          <div className="lg:col-span-3"><button className="btn-primary" type="submit"><Plus size={16} /> Save expense</button></div>
        </form>
      </Section>

      <Section title="Expense list" icon={Filter}>
        <div className="mb-4 grid gap-3 lg:grid-cols-6">
          <label className="relative lg:col-span-2"><Search className="absolute left-3 top-3 text-slate-400" size={16} /><input className="input pl-10" placeholder="Search expenses" value={filters.query} onChange={(e) => setFilters({ ...filters, query: e.target.value })} /></label>
          <select className="input" value={filters.categoryId} onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}><option value="">All categories</option>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
          <select className="input" value={filters.paidByParticipantId} onChange={(e) => setFilters({ ...filters, paidByParticipantId: e.target.value })}><option value="">Paid by anyone</option>{data.participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.name}</option>)}</select>
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
                    <td className="p-3"><p className="font-bold text-slate-900">{expense.title}</p><p className="text-xs text-slate-500">{expense.date} · {expense.paymentMethod} · {expense.splitMethod}</p>{expense.receipt && <p className="mt-1 text-xs text-slate-500">Receipt: {expense.receipt.fileName}</p>}</td>
                    <td className="p-3">{expense.categoryName}</td>
                    <td className="p-3">{expense.paidByName}</td>
                    <td className="p-3 font-bold">{money(expense.amount, currency)}</td>
                    <td className="p-3"><span className={statusBadge(expense.approvalStatus)}>{expense.approvalStatus}</span></td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button className="btn-ghost" type="button" onClick={() => approveExpense(expense, 'approved')}>Approve</button>
                        <button className="btn-ghost" type="button" onClick={() => approveExpense(expense, 'rejected')}>Reject</button>
                        <button className="btn-ghost text-rose-700" type="button" onClick={() => deleteExpense(expense.id)}><Trash2 size={15} /> Delete</button>
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

function Notifications({ setToast }) {
  const [form, setForm] = useState({ type: 'payment-reminder', channel: 'email-placeholder', title: 'Pending payment reminder', message: 'Please clear your team outing balance before the settlement deadline.' });

  async function sendPreview(event) {
    event.preventDefault();
    await api('/notifications/send-preview', { method: 'POST', body: JSON.stringify(form) });
    setToast('Notification preview queued. No inbox was harmed.');
  }

  return (
    <Section title="Notifications and reminders" icon={Bell}>
      <form onSubmit={sendPreview} className="grid gap-4 md:grid-cols-2">
        <label className="field-label">Type<select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="outing-reminder">Upcoming outing</option><option value="payment-reminder">Pending payment</option><option value="missing-contribution">Missing contribution</option><option value="settlement-deadline">Settlement deadline</option></select></label>
        <label className="field-label">Channel<select className="input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}><option value="in-app">In-app</option><option value="email-placeholder">Email placeholder</option></select></label>
        <label className="field-label md:col-span-2">Title<input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label className="field-label md:col-span-2">Message<textarea className="input min-h-28" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></label>
        <div className="md:col-span-2"><button className="btn-primary" type="submit">Queue reminder preview</button></div>
      </form>
    </Section>
  );
}

function Reports({ data }) {
  const currency = data.event.currency;
  const pieData = data.dashboard.categorySpending.filter((category) => category.actualCost > 0).map((category) => ({ name: category.name, value: category.actualCost }));

  return (
    <Section title="Reports and export" icon={FileText} action={<a className="btn-primary" href="/api/reports.csv"><Download size={16} /> Export CSV</a>}>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4">
          <h3 className="font-bold text-slate-900">Event report summary</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><dt>Total event cost</dt><dd className="font-bold">{money(data.dashboard.totalSpent, currency)}</dd></div>
            <div className="flex justify-between"><dt>Remaining budget</dt><dd className="font-bold">{money(data.dashboard.remainingBudget, currency)}</dd></div>
            <div className="flex justify-between"><dt>Receipts attached</dt><dd className="font-bold">{data.expenses.filter((expense) => expense.receipt).length}</dd></div>
            <div className="flex justify-between"><dt>Settlement items</dt><dd className="font-bold">{data.settlementPlan.settlements.length}</dd></div>
          </dl>
          <p className="mt-4 text-sm text-slate-500">PDF export can be added through a server-side renderer such as Playwright or PDFKit. This implementation includes JSON and CSV export so the basics are not held together by vibes alone.</p>
        </div>
        <div className="h-80 rounded-2xl bg-slate-50 p-4">
          {pieData.length === 0 ? <EmptyState title="No chart data" body="Add expenses to visualize spending." /> : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={105} label>
                  {pieData.map((entry, index) => <Cell key={entry.name} />)}
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

function Roles() {
  return (
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
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

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

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const tabs = [
    ['dashboard', 'Dashboard'],
    ['event', 'Event setup'],
    ['participants', 'Participants'],
    ['budget', 'Budget'],
    ['expenses', 'Expenses'],
    ['settlements', 'Settlements'],
    ['reports', 'Reports'],
    ['notifications', 'Notifications'],
    ['roles', 'Roles']
  ];

  if (loading && !data) {
    return <div className="grid min-h-screen place-items-center bg-slate-100 text-slate-700">Loading outing finances, because chaos needs a progress spinner.</div>;
  }

  if (error && !data) {
    return <div className="grid min-h-screen place-items-center bg-slate-100 p-6"><div className="rounded-3xl bg-white p-6 shadow-soft"><p className="font-bold text-rose-700">{error}</p><button className="btn-primary mt-4" onClick={reload}>Retry</button></div></div>;
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
            <div className="flex flex-wrap gap-3">
              <InstallAppButton setToast={setToast} />
              <button className="rounded-2xl bg-white px-4 py-2 font-bold text-slate-950" onClick={reload} type="button"><RefreshCw className="inline" size={16} /> Refresh</button>
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

      {toast && <div className="fixed right-4 top-4 z-20 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-soft">{toast}</div>}
      {error && <div className="mx-auto mt-4 max-w-7xl px-4 sm:px-6 lg:px-8"><div className="rounded-2xl bg-rose-50 p-4 text-rose-800 ring-1 ring-rose-200">{error}</div></div>}

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {activeTab === 'dashboard' && <Dashboard data={data} />}
        {activeTab === 'event' && <EventSetup data={data} reload={reload} setToast={setToast} />}
        {activeTab === 'participants' && <Participants data={data} reload={reload} setToast={setToast} />}
        {activeTab === 'budget' && <BudgetPlanning data={data} reload={reload} setToast={setToast} />}
        {activeTab === 'expenses' && <Expenses data={data} reload={reload} setToast={setToast} />}
        {activeTab === 'settlements' && <Settlements data={data} reload={reload} setToast={setToast} />}
        {activeTab === 'reports' && <Reports data={data} />}
        {activeTab === 'notifications' && <Notifications setToast={setToast} />}
        {activeTab === 'roles' && <Roles />}
      </div>

      <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-slate-500 sm:px-6 lg:px-8">
          Mobile PWA mode · PostgreSQL/Supabase-ready backend · Currency: {currency} 
          © 2026 Team Outing Expense Tracker · Designed, engineered, and deployed by Satheeshkumar Balaji.
      </footer>
    </main>
  );
}
