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
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'receipts';
const MAX_RECEIPT_BYTES = Number(process.env.MAX_RECEIPT_BYTES || 4 * 1024 * 1024);
const AUTH_REQUIRED = String(process.env.AUTH_REQUIRED || 'false').toLowerCase() === 'true';
const SUPABASE_AUTH_API_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || SUPABASE_SERVICE_ROLE_KEY;
const CLIENT_URLS = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((url) => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    const normalizedOrigin = origin?.replace(/\/+$/, '');
    if (!origin || CLIENT_URLS.includes(normalizedOrigin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  }
}));
app.use(express.json({ limit: '12mb' }));
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

function defaultCategories() {
  return [
    { id: `c-${nanoid(8)}`, name: 'Travel', estimatedCost: 0 },
    { id: `c-${nanoid(8)}`, name: 'Food', estimatedCost: 0 },
    { id: `c-${nanoid(8)}`, name: 'Accommodation', estimatedCost: 0 },
    { id: `c-${nanoid(8)}`, name: 'Activities', estimatedCost: 0 },
    { id: `c-${nanoid(8)}`, name: 'Miscellaneous', estimatedCost: 0 }
  ];
}

function buildEventRecord(input = {}) {
  const event = input.event || input;
  const id = event.id || input.id || `evt-${nanoid(8)}`;
  return {
    id,
    status: input.status || event.status || 'active',
    createdAt: input.createdAt || event.createdAt || new Date().toISOString(),
    archivedAt: input.archivedAt || event.archivedAt || null,
    event: {
      id,
      name: event.name || 'New Team Outing',
      date: event.date || new Date().toISOString().slice(0, 10),
      location: event.location || 'TBD',
      estimatedBudget: roundMoney(Number(event.estimatedBudget || 0)),
      currency: event.currency || 'INR',
      settlementDeadline: event.settlementDeadline || '',
      organizer: event.organizer || { name: '', email: '' }
    },
    participants: Array.isArray(input.participants) ? input.participants : [],
    categories: Array.isArray(input.categories) && input.categories.length ? input.categories : defaultCategories(),
    expenses: Array.isArray(input.expenses) ? input.expenses : [],
    settlements: Array.isArray(input.settlements) ? input.settlements : [],
    notifications: Array.isArray(input.notifications) ? input.notifications : []
  };
}

function normalizeMultiEventStore(data) {
  if (!data || typeof data !== 'object') return data;

  if (!Array.isArray(data.events) || data.events.length === 0) {
    const legacyRecord = buildEventRecord({
      event: data.event || {},
      participants: data.participants || [],
      categories: data.categories || [],
      expenses: data.expenses || [],
      settlements: data.settlements || [],
      notifications: data.notifications || []
    });
    data.events = [legacyRecord];
    data.activeEventId = legacyRecord.id;
  } else {
    data.events = data.events.map((record) => buildEventRecord(record));
    if (!data.activeEventId || !data.events.some((eventRecord) => eventRecord.id === data.activeEventId)) {
      const firstActive = data.events.find((eventRecord) => eventRecord.status !== 'archived') || data.events[0];
      data.activeEventId = firstActive.id;
    }
  }

  return data;
}

function getActiveEventRecord(data) {
  normalizeMultiEventStore(data);
  return requireExistingItem(data.events.find((eventRecord) => eventRecord.id === data.activeEventId) || data.events[0], 'Active event');
}

function eventSummary(eventRecord) {
  const dashboard = calculateDashboard(eventRecord);
  return {
    id: eventRecord.id,
    name: eventRecord.event.name,
    date: eventRecord.event.date,
    location: eventRecord.event.location,
    currency: eventRecord.event.currency,
    estimatedBudget: eventRecord.event.estimatedBudget,
    status: eventRecord.status || 'active',
    createdAt: eventRecord.createdAt,
    archivedAt: eventRecord.archivedAt,
    participantCount: eventRecord.participants.length,
    expenseCount: eventRecord.expenses.length,
    totalSpent: dashboard.totalSpent,
    remainingBudget: dashboard.remainingBudget
  };
}

function syncSettlements(eventRecord) {
  const plan = generateSettlementPlan(eventRecord);
  eventRecord.settlements = plan.settlements;
  return plan;
}

function assertActiveEventEditable(eventRecord) {
  if (eventRecord.status === 'archived' || eventRecord.status === 'completed') {
    const error = new Error('This event is archived or completed. Reactivate it before making changes.');
    error.statusCode = 409;
    throw error;
  }
}

function requireReceiptStorageConfig() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const error = new Error('Receipt storage is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Render.');
    error.statusCode = 503;
    throw error;
  }
}

function safeFileName(fileName = 'receipt') {
  const cleaned = String(fileName).trim().replace(/[^a-zA-Z0-9._-]/g, '-');
  return cleaned || 'receipt';
}

function extensionFromContentType(contentType = '') {
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'application/pdf': '.pdf'
  };
  return map[contentType] || '';
}

function validateReceiptPayload({ fileName, contentType, base64 }) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!fileName || !contentType || !base64) {
    const error = new Error('Receipt file name, type, and content are required.');
    error.statusCode = 400;
    throw error;
  }
  if (!allowedTypes.includes(contentType)) {
    const error = new Error('Only JPG, PNG, WebP, and PDF receipts are allowed.');
    error.statusCode = 400;
    throw error;
  }
}

async function uploadReceiptToSupabase({ fileName, contentType, base64 }) {
  requireReceiptStorageConfig();
  validateReceiptPayload({ fileName, contentType, base64 });

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.byteLength <= 0) {
    const error = new Error('Receipt file is empty.');
    error.statusCode = 400;
    throw error;
  }
  if (buffer.byteLength > MAX_RECEIPT_BYTES) {
    const error = new Error(`Receipt file is too large. Maximum allowed size is ${Math.round(MAX_RECEIPT_BYTES / 1024 / 1024)} MB.`);
    error.statusCode = 400;
    throw error;
  }

  const cleanName = safeFileName(fileName);
  const ext = cleanName.includes('.') ? '' : extensionFromContentType(contentType);
  const storagePath = `expense-receipts/${new Date().toISOString().slice(0, 10)}/${nanoid(12)}-${cleanName}${ext}`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_STORAGE_BUCKET}/${storagePath}`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': contentType,
      'x-upsert': 'true'
    },
    body: buffer
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const error = new Error(`Receipt upload failed. ${body || response.statusText}`);
    error.statusCode = 502;
    throw error;
  }

  return {
    id: `r-${nanoid(8)}`,
    fileName: cleanName,
    contentType,
    sizeBytes: buffer.byteLength,
    storagePath,
    url: `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${storagePath}`,
    uploadedAt: new Date().toISOString()
  };
}

function ensureUsers(data) {
  if (!Array.isArray(data.users)) data.users = [];
  return data.users;
}

function publicUser(user) {
  return {
    id: user.id,
    authUserId: user.authUserId,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt
  };
}

async function verifySupabaseToken(token) {
  if (!SUPABASE_URL || !SUPABASE_AUTH_API_KEY) {
    const error = new Error('Authentication is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY in Render.');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_AUTH_API_KEY
    }
  });

  if (!response.ok) {
    const error = new Error('Your login session is invalid or expired. Please sign in again.');
    error.statusCode = 401;
    throw error;
  }

  return response.json();
}

async function authMiddleware(req, res, next) {
  try {
    if (!AUTH_REQUIRED) {
      req.authUser = {
        id: 'demo-auth-user',
        email: 'demo@example.com',
        user_metadata: { name: 'Demo Admin' }
      };
      return next();
    }

    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      const error = new Error('Please sign in to use this app.');
      error.statusCode = 401;
      throw error;
    }

    req.authUser = await verifySupabaseToken(token);
    return next();
  } catch (error) {
    return next(error);
  }
}

function resolveAppUser(data, authUser) {
  normalizeMultiEventStore(data);
  const users = ensureUsers(data);
  const email = authUser?.email || '';
  let user = users.find((item) => item.authUserId === authUser?.id) || users.find((item) => item.email?.toLowerCase() === email.toLowerCase());

  if (!user) {
    user = {
      id: `u-${nanoid(8)}`,
      authUserId: authUser.id,
      name: authUser.user_metadata?.name || email.split('@')[0] || 'Team member',
      email,
      role: users.length === 0 ? 'admin' : 'member',
      createdAt: new Date().toISOString()
    };
    users.push(user);
  }

  if (!user.authUserId) user.authUserId = authUser.id;
  if (!user.email && email) user.email = email;
  user.lastLoginAt = new Date().toISOString();
  return user;
}

function requireRole(user, allowedRoles) {
  if (!allowedRoles.includes(user.role)) {
    const error = new Error(`Permission denied. Required role: ${allowedRoles.join(' or ')}.`);
    error.statusCode = 403;
    throw error;
  }
}

function canManageExpense(user, expense) {
  return ['admin', 'finance'].includes(user.role) || expense.createdByUserId === user.id;
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    app: 'Team Outing Expense Tracker',
    storage: process.env.DATABASE_URL ? 'postgres' : 'local-json',
    receiptStorage: SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? 'configured' : 'not-configured',
    auth: AUTH_REQUIRED ? 'required' : 'disabled',
    multiEvent: 'enabled'
  });
});

app.use('/api', authMiddleware);

app.get('/api/me', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const user = resolveAppUser(data, req.authUser);
  await writeStore(data);
  res.json(publicUser(user));
}));

app.get('/api/users', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  requireRole(currentUser, ['admin', 'finance']);
  await writeStore(data);
  res.json(ensureUsers(data).map(publicUser));
}));

app.patch('/api/users/:id', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  requireRole(currentUser, ['admin']);
  const user = requireExistingItem(findById(ensureUsers(data), req.params.id), 'User');
  const nextRole = req.body.role || user.role;
  if (!['admin', 'member', 'finance'].includes(nextRole)) {
    return res.status(400).json({ error: 'Role must be admin, member, or finance.' });
  }
  user.role = nextRole;
  if (req.body.name) user.name = sanitizeObject(req.body).name;
  await writeStore(data);
  res.json(publicUser(user));
}));

app.get('/api/bootstrap', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  const activeEvent = getActiveEventRecord(data);
  const dashboard = calculateDashboard(activeEvent);
  const settlementPlan = syncSettlements(activeEvent);
  await writeStore(data);
  res.json({
    ...activeEvent,
    event: { ...activeEvent.event, status: activeEvent.status },
    activeEventId: data.activeEventId,
    eventList: data.events.map(eventSummary),
    currentUser: publicUser(currentUser),
    users: ensureUsers(data).map(publicUser),
    dashboard,
    settlementPlan
  });
}));

app.get('/api/events', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  requireRole(currentUser, ['admin', 'finance']);
  await writeStore(data);
  res.json({ activeEventId: data.activeEventId, events: data.events.map(eventSummary) });
}));

app.post('/api/events', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  requireRole(currentUser, ['admin']);

  const sourceEvent = req.body.copyParticipantsFromEventId
    ? data.events.find((eventRecord) => eventRecord.id === req.body.copyParticipantsFromEventId)
    : null;

  const eventId = `evt-${nanoid(8)}`;
  const record = buildEventRecord({
    id: eventId,
    status: req.body.status || 'active',
    event: {
      id: eventId,
      name: sanitizeObject(req.body).name,
      date: req.body.date,
      location: sanitizeObject(req.body).location,
      estimatedBudget: roundMoney(Number(req.body.estimatedBudget || 0)),
      currency: req.body.currency || 'INR',
      settlementDeadline: req.body.settlementDeadline || '',
      organizer: sanitizeObject(req.body).organizer || { name: currentUser.name, email: currentUser.email }
    },
    participants: sourceEvent ? sourceEvent.participants.map((participant) => ({
      ...participant,
      id: `p-${nanoid(8)}`,
      paymentStatus: 'pending',
      amountPaid: 0,
      amountOwed: 0
    })) : [],
    categories: defaultCategories(),
    expenses: [],
    settlements: [],
    notifications: []
  });

  if (!record.event.name || !record.event.date || !record.event.location || !record.event.currency) {
    return res.status(400).json({ error: 'Event name, date, location, and currency are required.' });
  }
  if (record.event.estimatedBudget < 0) {
    return res.status(400).json({ error: 'Estimated budget cannot be negative.' });
  }

  data.events.push(record);
  data.activeEventId = record.id;
  await writeStore(data);
  res.status(201).json(eventSummary(record));
}));

app.post('/api/events/:id/activate', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  requireRole(currentUser, ['admin', 'finance']);
  const eventRecord = requireExistingItem(data.events.find((record) => record.id === req.params.id), 'Event');
  data.activeEventId = eventRecord.id;
  await writeStore(data);
  res.json({ activeEventId: data.activeEventId, event: eventSummary(eventRecord) });
}));

app.patch('/api/events/:id', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  requireRole(currentUser, ['admin']);
  const eventRecord = requireExistingItem(data.events.find((record) => record.id === req.params.id), 'Event');
  const nextStatus = req.body.status || eventRecord.status;
  if (!['active', 'completed', 'archived', 'cancelled'].includes(nextStatus)) {
    return res.status(400).json({ error: 'Event status must be active, completed, archived, or cancelled.' });
  }
  eventRecord.status = nextStatus;
  eventRecord.archivedAt = nextStatus === 'archived' || nextStatus === 'completed' ? new Date().toISOString() : null;
  await writeStore(data);
  res.json(eventSummary(eventRecord));
}));

app.delete('/api/events/:id', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  requireRole(currentUser, ['admin']);
  if (data.events.length <= 1) return res.status(409).json({ error: 'You must keep at least one event.' });
  const eventRecord = requireExistingItem(data.events.find((record) => record.id === req.params.id), 'Event');
  if (eventRecord.expenses.length > 0) return res.status(409).json({ error: 'Delete is blocked for events that already have expenses. Archive it instead.' });
  data.events = data.events.filter((record) => record.id !== req.params.id);
  if (data.activeEventId === req.params.id) data.activeEventId = data.events[0].id;
  await writeStore(data);
  res.status(204).send();
}));

app.get('/api/event', asyncHandler(async (req, res) => {
  const data = await readStore();
  const activeEvent = getActiveEventRecord(data);
  res.json({ ...activeEvent.event, status: activeEvent.status });
}));

app.put('/api/event', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  requireRole(currentUser, ['admin']);
  const activeEvent = getActiveEventRecord(data);
  assertActiveEventEditable(activeEvent);
  const nextEvent = {
    ...activeEvent.event,
    ...sanitizeObject(req.body),
    estimatedBudget: roundMoney(Number(req.body.estimatedBudget ?? activeEvent.event.estimatedBudget))
  };

  if (!nextEvent.name || !nextEvent.date || !nextEvent.location || !nextEvent.currency) {
    return res.status(400).json({ error: 'Event name, date, location, and currency are required.' });
  }

  if (nextEvent.estimatedBudget < 0) {
    return res.status(400).json({ error: 'Estimated budget cannot be negative.' });
  }

  activeEvent.event = nextEvent;
  await writeStore(data);
  res.json({ ...activeEvent.event, status: activeEvent.status });
}));

app.get('/api/participants', asyncHandler(async (req, res) => {
  const data = await readStore();
  const activeEvent = getActiveEventRecord(data);
  res.json(activeEvent.participants);
}));

app.post('/api/participants', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  requireRole(currentUser, ['admin']);
  const activeEvent = getActiveEventRecord(data);
  assertActiveEventEditable(activeEvent);
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

  activeEvent.participants.push(participant);
  await writeStore(data);
  res.status(201).json(participant);
}));

app.put('/api/participants/:id', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  requireRole(currentUser, ['admin']);
  const activeEvent = getActiveEventRecord(data);
  assertActiveEventEditable(activeEvent);
  const participant = requireExistingItem(findById(activeEvent.participants, req.params.id), 'Participant');

  Object.assign(participant, {
    ...participant,
    ...sanitizeObject(req.body)
  });

  if (!participant.name || !participant.emailOrPhone) {
    return res.status(400).json({ error: 'Participant name and email or phone are required.' });
  }

  await writeStore(data);
  res.json(participant);
}));

app.delete('/api/participants/:id', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  requireRole(currentUser, ['admin']);
  const activeEvent = getActiveEventRecord(data);
  assertActiveEventEditable(activeEvent);
  const usedInExpense = activeEvent.expenses.some(
    (expense) => expense.paidByParticipantId === req.params.id || expense.participantIds.includes(req.params.id)
  );

  if (usedInExpense) {
    return res.status(409).json({ error: 'Cannot remove a participant linked to existing expenses.' });
  }

  activeEvent.participants = activeEvent.participants.filter((participant) => participant.id !== req.params.id);
  await writeStore(data);
  res.status(204).send();
}));

app.get('/api/categories', asyncHandler(async (req, res) => {
  const data = await readStore();
  const activeEvent = getActiveEventRecord(data);
  res.json(activeEvent.categories);
}));

app.post('/api/categories', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  requireRole(currentUser, ['admin']);
  const activeEvent = getActiveEventRecord(data);
  assertActiveEventEditable(activeEvent);
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

  activeEvent.categories.push(category);
  await writeStore(data);
  res.status(201).json(category);
}));

app.put('/api/categories/:id', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  requireRole(currentUser, ['admin']);
  const activeEvent = getActiveEventRecord(data);
  assertActiveEventEditable(activeEvent);
  const category = requireExistingItem(findById(activeEvent.categories, req.params.id), 'Category');

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
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  requireRole(currentUser, ['admin']);
  const activeEvent = getActiveEventRecord(data);
  assertActiveEventEditable(activeEvent);
  const usedInExpense = activeEvent.expenses.some((expense) => expense.categoryId === req.params.id);

  if (usedInExpense) {
    return res.status(409).json({ error: 'Cannot remove a category linked to existing expenses.' });
  }

  activeEvent.categories = activeEvent.categories.filter((category) => category.id !== req.params.id);
  await writeStore(data);
  res.status(204).send();
}));

app.post('/api/receipts/upload', asyncHandler(async (req, res) => {
  const receipt = await uploadReceiptToSupabase({
    fileName: sanitizeObject(req.body).fileName,
    contentType: req.body.contentType,
    base64: req.body.base64
  });
  res.status(201).json(receipt);
}));

app.get('/api/expenses', asyncHandler(async (req, res) => {
  const data = await readStore();
  const activeEvent = getActiveEventRecord(data);
  res.json(calculateDashboard(activeEvent).expenses);
}));

app.post('/api/expenses', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  const activeEvent = getActiveEventRecord(data);
  assertActiveEventEditable(activeEvent);
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
    createdByUserId: currentUser.id,
    isRecurring: Boolean(req.body.isRecurring),
    isSettledLocked: false
  };

  validateExpensePayload(expense);
  activeEvent.expenses.push(expense);
  syncSettlements(activeEvent);
  await writeStore(data);
  res.status(201).json(expense);
}));

app.put('/api/expenses/:id', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  const activeEvent = getActiveEventRecord(data);
  assertActiveEventEditable(activeEvent);
  const expense = requireExistingItem(findById(activeEvent.expenses, req.params.id), 'Expense');

  if (!canManageExpense(currentUser, expense)) {
    return res.status(403).json({ error: 'You can only edit expenses you created unless you are admin or finance.' });
  }
  if (req.body.approvalStatus && req.body.approvalStatus !== expense.approvalStatus) {
    requireRole(currentUser, ['admin', 'finance']);
  }

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
  syncSettlements(activeEvent);
  await writeStore(data);
  res.json(expense);
}));

app.delete('/api/expenses/:id', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  const activeEvent = getActiveEventRecord(data);
  assertActiveEventEditable(activeEvent);
  const expense = requireExistingItem(findById(activeEvent.expenses, req.params.id), 'Expense');

  if (!canManageExpense(currentUser, expense)) {
    return res.status(403).json({ error: 'You can only delete expenses you created unless you are admin or finance.' });
  }

  if (expense.isSettledLocked && req.query.confirm !== 'true') {
    return res.status(409).json({ error: 'Cannot delete a settled expense without confirmation.' });
  }

  activeEvent.expenses = activeEvent.expenses.filter((item) => item.id !== req.params.id);
  syncSettlements(activeEvent);
  await writeStore(data);
  res.status(204).send();
}));

app.get('/api/dashboard', asyncHandler(async (req, res) => {
  const data = await readStore();
  const activeEvent = getActiveEventRecord(data);
  res.json(calculateDashboard(activeEvent));
}));

app.get('/api/settlements', asyncHandler(async (req, res) => {
  const data = await readStore();
  const activeEvent = getActiveEventRecord(data);
  const settlementPlan = syncSettlements(activeEvent);
  await writeStore(data);
  res.json(settlementPlan);
}));

app.patch('/api/settlements/:id', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  requireRole(currentUser, ['admin', 'finance']);
  const activeEvent = getActiveEventRecord(data);
  assertActiveEventEditable(activeEvent);
  syncSettlements(activeEvent);
  const settlement = requireExistingItem(findById(activeEvent.settlements, req.params.id), 'Settlement');

  const paidAmount = roundMoney(Number(req.body.paidAmount ?? settlement.paidAmount ?? 0));
  if (paidAmount < 0 || paidAmount > settlement.amount) {
    return res.status(400).json({ error: 'Paid amount must be between zero and settlement amount.' });
  }

  settlement.paidAmount = paidAmount;
  settlement.status = req.body.status || (paidAmount === 0 ? 'pending' : paidAmount >= settlement.amount ? 'completed' : 'partially-paid');
  settlement.transactionReference = req.body.transactionReference ?? settlement.transactionReference;
  settlement.paymentProofUrl = req.body.paymentProofUrl ?? settlement.paymentProofUrl;
  settlement.updatedAt = new Date().toISOString();

  activeEvent.expenses = activeEvent.expenses.map((expense) => ({
    ...expense,
    isSettledLocked: activeEvent.settlements.some((item) => item.status === 'completed')
  }));

  await writeStore(data);
  res.json(settlement);
}));

app.get('/api/notifications', asyncHandler(async (req, res) => {
  const data = await readStore();
  const activeEvent = getActiveEventRecord(data);
  res.json(activeEvent.notifications);
}));

app.post('/api/notifications/send-preview', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  requireRole(currentUser, ['admin']);
  const activeEvent = getActiveEventRecord(data);
  assertActiveEventEditable(activeEvent);
  const notification = {
    id: `n-${nanoid(8)}`,
    type: req.body.type || 'payment-reminder',
    title: req.body.title || 'Payment reminder',
    message: req.body.message || 'Please clear your pending outing balance.',
    channel: req.body.channel || 'email-placeholder',
    status: 'queued-placeholder'
  };
  activeEvent.notifications.push(notification);
  await writeStore(data);
  res.status(201).json(notification);
}));

app.get('/api/reports', asyncHandler(async (req, res) => {
  const data = await readStore();
  const activeEvent = getActiveEventRecord(data);
  res.json(buildExpenseReport(activeEvent));
}));

app.get('/api/reports.csv', asyncHandler(async (req, res) => {
  const data = await readStore();
  const activeEvent = getActiveEventRecord(data);
  const report = buildExpenseReport(activeEvent);
  const rows = report.participantWiseContribution.map((participant) => ({
    participant: participant.name,
    paid: participant.amountPaid,
    owed: participant.amountOwed,
    netBalance: participant.netBalance,
    paymentStatus: participant.paymentStatus
  }));

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${activeEvent.event.name.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}-expense-report.csv"`);
  res.send(toCsv(rows));
}));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 400).json({ error: err.message || 'Something went wrong.' });
});

app.listen(PORT, () => {
  console.log(`Team Outing Expense Tracker API running at http://localhost:${PORT}`);
});
