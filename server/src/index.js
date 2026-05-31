import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { nanoid } from 'nanoid';
import { readStore, writeStore, sanitizeObject } from './storage.js';
import {
  buildExpenseReport,
  calculateDashboard,
  generateSettlementPlan,
  toCsv,
  validateExpensePayload,
  roundMoney
} from './calculations.js';

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_URLS = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || CLIENT_URLS.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  }
}));
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function findById(collection, id) {
  return collection.find((item) => item.id === id);
}

function requireExistingItem(item, label) {
  if (!item) {
    const error = new Error(`${label} not found.`);
    error.statusCode = 404;
    throw error;
  }
  return item;
}

function syncSettlements(data) {
  const plan = generateSettlementPlan(data);
  data.settlements = plan.settlements;
  return plan;
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, app: 'Team Outing Expense Tracker', storage: process.env.DATABASE_URL ? 'postgres' : 'local-json' });
});

app.get('/api/bootstrap', asyncHandler(async (req, res) => {
  const data = await readStore();
  const dashboard = calculateDashboard(data);
  const settlementPlan = syncSettlements(data);
  await writeStore(data);
  res.json({ ...data, dashboard, settlementPlan });
}));

app.get('/api/event', asyncHandler(async (req, res) => {
  const data = await readStore();
  res.json(data.event);
}));

app.put('/api/event', asyncHandler(async (req, res) => {
  const data = await readStore();
  const nextEvent = {
    ...data.event,
    ...sanitizeObject(req.body),
    estimatedBudget: roundMoney(Number(req.body.estimatedBudget ?? data.event.estimatedBudget))
  };

  if (!nextEvent.name || !nextEvent.date || !nextEvent.location || !nextEvent.currency) {
    return res.status(400).json({ error: 'Event name, date, location, and currency are required.' });
  }

  if (nextEvent.estimatedBudget < 0) {
    return res.status(400).json({ error: 'Estimated budget cannot be negative.' });
  }

  data.event = nextEvent;
  await writeStore(data);
  res.json(data.event);
}));

app.get('/api/participants', asyncHandler(async (req, res) => {
  const data = await readStore();
  res.json(data.participants);
}));

app.post('/api/participants', asyncHandler(async (req, res) => {
  const data = await readStore();
  const participant = {
    id: `p-${nanoid(8)}`,
    name: sanitizeObject(req.body).name,
    emailOrPhone: sanitizeObject(req.body).emailOrPhone,
    attendanceStatus: req.body.attendanceStatus || 'attending',
    paymentStatus: 'pending',
    amountPaid: 0,
    amountOwed: 0
  };

  if (!participant.name || !participant.emailOrPhone) {
    return res.status(400).json({ error: 'Participant name and email or phone are required.' });
  }

  data.participants.push(participant);
  await writeStore(data);
  res.status(201).json(participant);
}));

app.put('/api/participants/:id', asyncHandler(async (req, res) => {
  const data = await readStore();
  const participant = requireExistingItem(findById(data.participants, req.params.id), 'Participant');

  Object.assign(participant, {
    ...participant,
    ...sanitizeObject(req.body)
  });

  await writeStore(data);
  res.json(participant);
}));

app.delete('/api/participants/:id', asyncHandler(async (req, res) => {
  const data = await readStore();
  const usedInExpense = data.expenses.some(
    (expense) => expense.paidByParticipantId === req.params.id || expense.participantIds.includes(req.params.id)
  );

  if (usedInExpense) {
    return res.status(409).json({ error: 'Cannot remove a participant linked to existing expenses.' });
  }

  data.participants = data.participants.filter((participant) => participant.id !== req.params.id);
  await writeStore(data);
  res.status(204).send();
}));

app.get('/api/categories', asyncHandler(async (req, res) => {
  const data = await readStore();
  res.json(data.categories);
}));

app.post('/api/categories', asyncHandler(async (req, res) => {
  const data = await readStore();
  const category = {
    id: `c-${nanoid(8)}`,
    name: sanitizeObject(req.body).name,
    estimatedCost: roundMoney(Number(req.body.estimatedCost || 0))
  };

  if (!category.name) {
    return res.status(400).json({ error: 'Category name is required.' });
  }

  if (category.estimatedCost < 0) {
    return res.status(400).json({ error: 'Estimated cost cannot be negative.' });
  }

  data.categories.push(category);
  await writeStore(data);
  res.status(201).json(category);
}));

app.put('/api/categories/:id', asyncHandler(async (req, res) => {
  const data = await readStore();
  const category = requireExistingItem(findById(data.categories, req.params.id), 'Category');

  category.name = req.body.name ?? category.name;
  category.estimatedCost = roundMoney(Number(req.body.estimatedCost ?? category.estimatedCost));

  if (!category.name || category.estimatedCost < 0) {
    return res.status(400).json({ error: 'Category name is required and cost cannot be negative.' });
  }

  await writeStore(data);
  res.json(category);
}));

app.delete('/api/categories/:id', asyncHandler(async (req, res) => {
  const data = await readStore();
  const usedInExpense = data.expenses.some((expense) => expense.categoryId === req.params.id);

  if (usedInExpense) {
    return res.status(409).json({ error: 'Cannot remove a category linked to existing expenses.' });
  }

  data.categories = data.categories.filter((category) => category.id !== req.params.id);
  await writeStore(data);
  res.status(204).send();
}));

app.get('/api/expenses', asyncHandler(async (req, res) => {
  const data = await readStore();
  res.json(calculateDashboard(data).expenses);
}));

app.post('/api/expenses', asyncHandler(async (req, res) => {
  const data = await readStore();
  const expense = {
    id: `e-${nanoid(8)}`,
    title: req.body.title,
    amount: roundMoney(Number(req.body.amount)),
    categoryId: req.body.categoryId,
    date: req.body.date,
    paidByParticipantId: req.body.paidByParticipantId,
    participantIds: req.body.participantIds || [],
    splitMethod: req.body.splitMethod || 'equal',
    customSplits: req.body.customSplits || [],
    percentageSplits: req.body.percentageSplits || [],
    paymentMethod: req.body.paymentMethod,
    notes: req.body.notes || '',
    receipt: req.body.receipt || null,
    approvalStatus: req.body.approvalStatus || 'pending',
    createdByUserId: req.body.createdByUserId || 'u-admin',
    isRecurring: Boolean(req.body.isRecurring),
    isSettledLocked: false
  };

  validateExpensePayload(expense);
  data.expenses.push(expense);
  syncSettlements(data);
  await writeStore(data);
  res.status(201).json(expense);
}));

app.put('/api/expenses/:id', asyncHandler(async (req, res) => {
  const data = await readStore();
  const expense = requireExistingItem(findById(data.expenses, req.params.id), 'Expense');

  if (expense.isSettledLocked && req.body.confirmSettledEdit !== true) {
    return res.status(409).json({ error: 'This expense is tied to completed settlements. Confirm before editing.' });
  }

  const nextExpense = {
    ...expense,
    ...req.body,
    amount: roundMoney(Number(req.body.amount ?? expense.amount))
  };

  validateExpensePayload(nextExpense);
  Object.assign(expense, nextExpense);
  syncSettlements(data);
  await writeStore(data);
  res.json(expense);
}));

app.delete('/api/expenses/:id', asyncHandler(async (req, res) => {
  const data = await readStore();
  const expense = requireExistingItem(findById(data.expenses, req.params.id), 'Expense');

  if (expense.isSettledLocked && req.query.confirm !== 'true') {
    return res.status(409).json({ error: 'Cannot delete a settled expense without confirmation.' });
  }

  data.expenses = data.expenses.filter((item) => item.id !== req.params.id);
  syncSettlements(data);
  await writeStore(data);
  res.status(204).send();
}));

app.get('/api/dashboard', asyncHandler(async (req, res) => {
  const data = await readStore();
  res.json(calculateDashboard(data));
}));

app.get('/api/settlements', asyncHandler(async (req, res) => {
  const data = await readStore();
  const settlementPlan = syncSettlements(data);
  await writeStore(data);
  res.json(settlementPlan);
}));

app.patch('/api/settlements/:id', asyncHandler(async (req, res) => {
  const data = await readStore();
  syncSettlements(data);
  const settlement = requireExistingItem(findById(data.settlements, req.params.id), 'Settlement');

  const paidAmount = roundMoney(Number(req.body.paidAmount ?? settlement.paidAmount ?? 0));
  if (paidAmount < 0 || paidAmount > settlement.amount) {
    return res.status(400).json({ error: 'Paid amount must be between zero and settlement amount.' });
  }

  settlement.paidAmount = paidAmount;
  settlement.status = req.body.status || (paidAmount === 0 ? 'pending' : paidAmount >= settlement.amount ? 'completed' : 'partially-paid');
  settlement.transactionReference = req.body.transactionReference ?? settlement.transactionReference;
  settlement.paymentProofUrl = req.body.paymentProofUrl ?? settlement.paymentProofUrl;
  settlement.updatedAt = new Date().toISOString();

  data.expenses = data.expenses.map((expense) => ({
    ...expense,
    isSettledLocked: data.settlements.some((item) => item.status === 'completed')
  }));

  await writeStore(data);
  res.json(settlement);
}));

app.get('/api/notifications', asyncHandler(async (req, res) => {
  const data = await readStore();
  res.json(data.notifications);
}));

app.post('/api/notifications/send-preview', asyncHandler(async (req, res) => {
  const data = await readStore();
  const notification = {
    id: `n-${nanoid(8)}`,
    type: req.body.type || 'payment-reminder',
    title: req.body.title || 'Payment reminder',
    message: req.body.message || 'Please clear your pending outing balance.',
    channel: req.body.channel || 'email-placeholder',
    status: 'queued-placeholder'
  };
  data.notifications.push(notification);
  await writeStore(data);
  res.status(201).json(notification);
}));

app.get('/api/reports', asyncHandler(async (req, res) => {
  const data = await readStore();
  res.json(buildExpenseReport(data));
}));

app.get('/api/reports.csv', asyncHandler(async (req, res) => {
  const data = await readStore();
  const report = buildExpenseReport(data);
  const rows = report.participantWiseContribution.map((participant) => ({
    participant: participant.name,
    paid: participant.amountPaid,
    owed: participant.amountOwed,
    netBalance: participant.netBalance,
    paymentStatus: participant.paymentStatus
  }));

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="team-outing-expense-report.csv"');
  res.send(toCsv(rows));
}));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 400).json({ error: err.message || 'Something went wrong.' });
});

app.listen(PORT, () => {
  console.log(`Team Outing Expense Tracker API running at http://localhost:${PORT}`);
});
