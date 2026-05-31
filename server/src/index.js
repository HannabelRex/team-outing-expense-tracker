import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { nanoid } from 'nanoid';
import PDFDocument from 'pdfkit';
import nodemailer from 'nodemailer';
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
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || '';
const EMAIL_NOTIFICATIONS_ENABLED = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && SMTP_FROM);
let cachedMailer = null;
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
    notifications: Array.isArray(input.notifications) ? input.notifications : [],
    auditLog: Array.isArray(input.auditLog) ? input.auditLog : Array.isArray(input.audit) ? input.audit : []
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

function normalizeIdentity(value = '') {
  return String(value || '').trim().toLowerCase();
}

function contactTokens(value = '') {
  return normalizeIdentity(value)
    .split(/[\s,;|/]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function participantMatchesUser(participant = {}, user = {}) {
  const userEmail = normalizeIdentity(user.email);
  if (!participant || !userEmail) return false;

  if (participant.userId && participant.userId === user.id) return true;
  if (participant.authUserId && participant.authUserId === user.authUserId) return true;

  const participantEmail = normalizeIdentity(participant.email);
  if (participantEmail && participantEmail === userEmail) return true;

  const participantContact = normalizeIdentity(participant.emailOrPhone);
  if (participantContact && participantContact === userEmail) return true;

  return contactTokens(participant.emailOrPhone).includes(userEmail);
}

function memberAssignedEvents(data, user) {
  normalizeMultiEventStore(data);
  return data.events.filter((eventRecord) =>
    eventRecord.participants.some((participant) => participantMatchesUser(participant, user))
  );
}

function visibleEventsForUser(data, user) {
  normalizeMultiEventStore(data);
  if (['admin', 'finance'].includes(user.role)) return data.events;
  return memberAssignedEvents(data, user);
}

function getEventRecordForUser(data, user) {
  normalizeMultiEventStore(data);

  if (['admin', 'finance'].includes(user.role)) {
    return getActiveEventRecord(data);
  }

  const assignedEvents = memberAssignedEvents(data, user);
  if (assignedEvents.length === 0) {
    const error = new Error('You are not tagged as a participant in any event yet. Ask an admin to add your login email in the Participants tab.');
    error.statusCode = 403;
    throw error;
  }

  return assignedEvents.find((eventRecord) => eventRecord.id === user.activeEventId)
    || assignedEvents.find((eventRecord) => eventRecord.id === data.activeEventId)
    || assignedEvents.find((eventRecord) => eventRecord.status === 'active')
    || assignedEvents[0];
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
    accessStatus: user.accessStatus || 'active',
    disabledAt: user.disabledAt || null,
    disabledByUserId: user.disabledByUserId || '',
    activeEventId: user.activeEventId || '',
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt
  };
}

function userHasAccess(user) {
  return (user?.accessStatus || 'active') !== 'disabled';
}

function activeAdminCount(users) {
  return users.filter((user) => user.role === 'admin' && userHasAccess(user)).length;
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
  if (!user.accessStatus) user.accessStatus = 'active';
  if (!userHasAccess(user)) {
    const error = new Error('Your access to this app has been removed by an administrator. Please contact the event admin if this is unexpected. Bureaucracy finally found the login screen.');
    error.statusCode = 403;
    throw error;
  }
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

function safeAuditDetails(details = {}) {
  return sanitizeObject(details || {});
}

function addAuditLog(eventRecord, user, action, entityType, description, details = {}) {
  eventRecord.auditLog = Array.isArray(eventRecord.auditLog) ? eventRecord.auditLog : [];
  eventRecord.auditLog.push({
    id: `a-${nanoid(8)}`,
    createdAt: new Date().toISOString(),
    userId: user?.id || '',
    userName: user?.name || user?.email || 'Unknown user',
    userEmail: user?.email || '',
    userRole: user?.role || 'unknown',
    eventId: eventRecord.id,
    eventName: eventRecord.event?.name || 'Unknown event',
    action,
    entityType,
    description,
    details: safeAuditDetails(details)
  });
  eventRecord.auditLog = eventRecord.auditLog.slice(-750);
}

function publicAuditEntry(entry) {
  return {
    id: entry.id,
    createdAt: entry.createdAt,
    userName: entry.userName,
    userEmail: entry.userEmail,
    userRole: entry.userRole,
    eventId: entry.eventId,
    eventName: entry.eventName,
    action: entry.action,
    entityType: entry.entityType,
    description: entry.description,
    details: entry.details || {}
  };
}

function currentEventForAudit(data, user) {
  try {
    return getEventRecordForUser(data, user);
  } catch (_error) {
    normalizeMultiEventStore(data);
    return data.events[0];
  }
}

function participantLabel(eventRecord, participantId) {
  return findById(eventRecord.participants || [], participantId)?.name || participantId || 'Unknown participant';
}

function categoryLabel(eventRecord, categoryId) {
  return findById(eventRecord.categories || [], categoryId)?.name || categoryId || 'Unknown category';
}

function assertMemberExpenseParticipant(eventRecord, user, expense) {
  if (user.role !== 'member') return;
  const paidByParticipant = findById(eventRecord.participants || [], expense.paidByParticipantId);
  if (!participantMatchesUser(paidByParticipant, user)) {
    const error = new Error('Members can only create or update expenses paid by their own participant profile. Match the participant email with your login email. Very picky, yes, but safer.');
    error.statusCode = 403;
    throw error;
  }
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    app: 'Team Outing Expense Tracker',
    storage: process.env.DATABASE_URL ? 'postgres' : 'local-json',
    receiptStorage: SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? 'configured' : 'not-configured',
    auth: AUTH_REQUIRED ? 'required' : 'disabled',
    multiEvent: 'enabled',
    memberEventScoping: 'enabled',
    memberEventSwitching: 'enabled',
    pdfReports: 'enabled',
    pdfCurrencyMode: 'code',
    inAppNotifications: 'enabled',
    notificationInbox: 'enabled',
    auditTrail: 'enabled',
    securityHardening: 'enabled',
    userAccessControl: 'enabled',
    passwordReset: 'enabled',
    emailNotifications: EMAIL_NOTIFICATIONS_ENABLED ? 'configured' : 'not-configured'
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
  const beforeRole = user.role;
  const beforeName = user.name;
  user.role = nextRole;
  if (req.body.name) user.name = sanitizeObject(req.body).name;
  const auditEvent = currentEventForAudit(data, currentUser);
  addAuditLog(auditEvent, currentUser, 'user.role_updated', 'user', `Updated user access for ${user.email || user.name}.`, {
    targetUserId: user.id,
    targetEmail: user.email,
    beforeRole,
    afterRole: user.role,
    beforeName,
    afterName: user.name
  });
  await writeStore(data);
  res.json(publicUser(user));
}));

app.delete('/api/users/:id', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  requireRole(currentUser, ['admin']);
  const users = ensureUsers(data);
  const user = requireExistingItem(findById(users, req.params.id), 'User');

  if (user.id === currentUser.id) {
    return res.status(400).json({ error: 'You cannot remove your own access while signed in. That is how admins lock themselves out and then blame the furniture.' });
  }
  if (user.role === 'admin' && activeAdminCount(users) <= 1) {
    return res.status(409).json({ error: 'At least one active admin must remain.' });
  }

  const beforeStatus = user.accessStatus || 'active';
  user.accessStatus = 'disabled';
  user.disabledAt = new Date().toISOString();
  user.disabledByUserId = currentUser.id;
  const auditEvent = currentEventForAudit(data, currentUser);
  addAuditLog(auditEvent, currentUser, 'user.access_removed', 'user', `Removed app access for ${user.email || user.name}.`, {
    targetUserId: user.id,
    targetEmail: user.email,
    beforeStatus,
    afterStatus: user.accessStatus
  });
  await writeStore(data);
  res.json(publicUser(user));
}));

app.post('/api/users/:id/restore', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  requireRole(currentUser, ['admin']);
  const user = requireExistingItem(findById(ensureUsers(data), req.params.id), 'User');
  const beforeStatus = user.accessStatus || 'active';
  user.accessStatus = 'active';
  user.disabledAt = null;
  user.disabledByUserId = '';
  const auditEvent = currentEventForAudit(data, currentUser);
  addAuditLog(auditEvent, currentUser, 'user.access_restored', 'user', `Restored app access for ${user.email || user.name}.`, {
    targetUserId: user.id,
    targetEmail: user.email,
    beforeStatus,
    afterStatus: user.accessStatus
  });
  await writeStore(data);
  res.json(publicUser(user));
}));

app.post('/api/users/:id/password-reset', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  requireRole(currentUser, ['admin']);
  const user = requireExistingItem(findById(ensureUsers(data), req.params.id), 'User');
  if (!user.email) return res.status(400).json({ error: 'This user does not have an email address for password reset.' });
  if (!SUPABASE_URL || !SUPABASE_AUTH_API_KEY) {
    return res.status(503).json({ error: 'Supabase Auth is not configured for password reset.' });
  }
  const redirectTo = CLIENT_URLS[0] || '';
  const recoverUrl = `${SUPABASE_URL}/auth/v1/recover${redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : ''}`;
  const response = await fetch(recoverUrl, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_AUTH_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: user.email })
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const error = new Error(`Password reset email could not be sent. ${body || response.statusText}`);
    error.statusCode = 502;
    throw error;
  }
  const auditEvent = currentEventForAudit(data, currentUser);
  addAuditLog(auditEvent, currentUser, 'user.password_reset_requested', 'user', `Sent password reset email to ${user.email}.`, {
    targetUserId: user.id,
    targetEmail: user.email
  });
  await writeStore(data);
  res.json({ ok: true });
}));

app.get('/api/bootstrap', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  const activeEvent = getEventRecordForUser(data, currentUser);
  const dashboard = calculateDashboard(activeEvent);
  const settlementPlan = syncSettlements(activeEvent);
  const eventList = visibleEventsForUser(data, currentUser).map(eventSummary);
  await writeStore(data);
  res.json({
    ...activeEvent,
    event: { ...activeEvent.event, status: activeEvent.status },
    activeEventId: activeEvent.id,
    eventList,
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
  const activeEvent = getEventRecordForUser(data, currentUser);
  await writeStore(data);
  res.json({ activeEventId: activeEvent.id, events: visibleEventsForUser(data, currentUser).map(eventSummary) });
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
  addAuditLog(record, currentUser, 'event.created', 'event', `Created event ${record.event.name}.`, {
    status: record.status,
    copiedParticipantsFromEventId: req.body.copyParticipantsFromEventId || ''
  });
  await writeStore(data);
  res.status(201).json(eventSummary(record));
}));

app.post('/api/events/:id/activate', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  const eventRecord = requireExistingItem(data.events.find((record) => record.id === req.params.id), 'Event');

  if (['admin', 'finance'].includes(currentUser.role)) {
    data.activeEventId = eventRecord.id;
  } else {
    const allowedEvent = memberAssignedEvents(data, currentUser).some((record) => record.id === eventRecord.id);
    if (!allowedEvent) {
      const error = new Error('You can only switch to events where your login email is tagged as a participant.');
      error.statusCode = 403;
      throw error;
    }
    currentUser.activeEventId = eventRecord.id;
  }

  await writeStore(data);
  res.json({ activeEventId: eventRecord.id, event: eventSummary(eventRecord) });
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
  const beforeStatus = eventRecord.status;
  eventRecord.status = nextStatus;
  eventRecord.archivedAt = nextStatus === 'archived' || nextStatus === 'completed' ? new Date().toISOString() : null;
  addAuditLog(eventRecord, currentUser, 'event.status_updated', 'event', `Changed event status from ${beforeStatus} to ${nextStatus}.`, { beforeStatus, afterStatus: nextStatus });
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
  const auditEvent = data.events[0];
  addAuditLog(auditEvent, currentUser, 'event.deleted', 'event', `Deleted draft event ${eventRecord.event.name}.`, { deletedEventId: eventRecord.id, deletedEventName: eventRecord.event.name });
  await writeStore(data);
  res.status(204).send();
}));

app.get('/api/event', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  const activeEvent = getEventRecordForUser(data, currentUser);
  await writeStore(data);
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

  const beforeEvent = activeEvent.event;
  activeEvent.event = nextEvent;
  addAuditLog(activeEvent, currentUser, 'event.updated', 'event', `Updated event setup for ${nextEvent.name}.`, {
    beforeName: beforeEvent.name,
    afterName: nextEvent.name,
    beforeBudget: beforeEvent.estimatedBudget,
    afterBudget: nextEvent.estimatedBudget,
    beforeDate: beforeEvent.date,
    afterDate: nextEvent.date
  });
  await writeStore(data);
  res.json({ ...activeEvent.event, status: activeEvent.status });
}));

app.get('/api/participants', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  const activeEvent = getEventRecordForUser(data, currentUser);
  await writeStore(data);
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
  addAuditLog(activeEvent, currentUser, 'participant.created', 'participant', `Added participant ${participant.name}.`, { participantId: participant.id, emailOrPhone: participant.emailOrPhone });
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

  const beforeParticipant = { ...participant };
  Object.assign(participant, {
    ...participant,
    ...sanitizeObject(req.body)
  });

  if (!participant.name || !participant.emailOrPhone) {
    return res.status(400).json({ error: 'Participant name and email or phone are required.' });
  }

  addAuditLog(activeEvent, currentUser, 'participant.updated', 'participant', `Updated participant ${participant.name}.`, {
    participantId: participant.id,
    beforeName: beforeParticipant.name,
    afterName: participant.name,
    beforeContact: beforeParticipant.emailOrPhone,
    afterContact: participant.emailOrPhone
  });
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
  const participant = requireExistingItem(findById(activeEvent.participants, req.params.id), 'Participant');
  const usedInExpense = activeEvent.expenses.some(
    (expense) => expense.paidByParticipantId === req.params.id || expense.participantIds.includes(req.params.id)
  );

  if (usedInExpense) {
    return res.status(409).json({ error: 'Cannot remove a participant linked to existing expenses.' });
  }

  const removedParticipant = participant;
  activeEvent.participants = activeEvent.participants.filter((participant) => participant.id !== req.params.id);
  addAuditLog(activeEvent, currentUser, 'participant.deleted', 'participant', `Deleted participant ${removedParticipant.name}.`, { participantId: removedParticipant.id, emailOrPhone: removedParticipant.emailOrPhone });
  await writeStore(data);
  res.status(204).send();
}));

app.get('/api/categories', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  const activeEvent = getEventRecordForUser(data, currentUser);
  await writeStore(data);
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
  addAuditLog(activeEvent, currentUser, 'category.created', 'category', `Added budget category ${category.name}.`, { categoryId: category.id, estimatedCost: category.estimatedCost });
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

  const beforeCategory = { ...category };
  category.name = req.body.name ?? category.name;
  category.estimatedCost = roundMoney(Number(req.body.estimatedCost ?? category.estimatedCost));

  if (!category.name || category.estimatedCost < 0) {
    return res.status(400).json({ error: 'Category name is required and cost cannot be negative.' });
  }

  addAuditLog(activeEvent, currentUser, 'category.updated', 'category', `Updated budget category ${category.name}.`, {
    categoryId: category.id,
    beforeName: beforeCategory.name,
    afterName: category.name,
    beforeEstimatedCost: beforeCategory.estimatedCost,
    afterEstimatedCost: category.estimatedCost
  });
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
  const category = requireExistingItem(findById(activeEvent.categories, req.params.id), 'Category');
  const usedInExpense = activeEvent.expenses.some((expense) => expense.categoryId === req.params.id);

  if (usedInExpense) {
    return res.status(409).json({ error: 'Cannot remove a category linked to existing expenses.' });
  }

  const removedCategory = category;
  activeEvent.categories = activeEvent.categories.filter((category) => category.id !== req.params.id);
  addAuditLog(activeEvent, currentUser, 'category.deleted', 'category', `Deleted budget category ${removedCategory.name}.`, { categoryId: removedCategory.id, estimatedCost: removedCategory.estimatedCost });
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
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  const activeEvent = getEventRecordForUser(data, currentUser);
  await writeStore(data);
  res.json(calculateDashboard(activeEvent).expenses);
}));

app.post('/api/expenses', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  const activeEvent = getEventRecordForUser(data, currentUser);
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
  assertMemberExpenseParticipant(activeEvent, currentUser, expense);
  activeEvent.expenses.push(expense);
  addAuditLog(activeEvent, currentUser, 'expense.created', 'expense', `Created expense ${expense.title}.`, {
    expenseId: expense.id,
    amount: expense.amount,
    category: categoryLabel(activeEvent, expense.categoryId),
    paidBy: participantLabel(activeEvent, expense.paidByParticipantId),
    receiptFileName: expense.receipt?.fileName || ''
  });
  syncSettlements(activeEvent);
  await writeStore(data);
  res.status(201).json(expense);
}));

app.put('/api/expenses/:id', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  const activeEvent = getEventRecordForUser(data, currentUser);
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

  const beforeExpense = { ...expense };
  const nextExpense = {
    ...expense,
    ...req.body,
    amount: roundMoney(Number(req.body.amount ?? expense.amount))
  };

  validateExpensePayload(nextExpense);
  assertMemberExpenseParticipant(activeEvent, currentUser, nextExpense);
  Object.assign(expense, nextExpense);
  addAuditLog(activeEvent, currentUser, req.body.approvalStatus && req.body.approvalStatus !== beforeExpense.approvalStatus ? 'expense.approval_updated' : 'expense.updated', 'expense', `Updated expense ${expense.title}.`, {
    expenseId: expense.id,
    beforeAmount: beforeExpense.amount,
    afterAmount: expense.amount,
    beforeStatus: beforeExpense.approvalStatus,
    afterStatus: expense.approvalStatus,
    beforePaidBy: participantLabel(activeEvent, beforeExpense.paidByParticipantId),
    afterPaidBy: participantLabel(activeEvent, expense.paidByParticipantId)
  });
  syncSettlements(activeEvent);
  await writeStore(data);
  res.json(expense);
}));

app.delete('/api/expenses/:id', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  const activeEvent = getEventRecordForUser(data, currentUser);
  assertActiveEventEditable(activeEvent);
  const expense = requireExistingItem(findById(activeEvent.expenses, req.params.id), 'Expense');

  if (!canManageExpense(currentUser, expense)) {
    return res.status(403).json({ error: 'You can only delete expenses you created unless you are admin or finance.' });
  }

  if (expense.isSettledLocked && req.query.confirm !== 'true') {
    return res.status(409).json({ error: 'Cannot delete a settled expense without confirmation.' });
  }

  const removedExpense = expense;
  activeEvent.expenses = activeEvent.expenses.filter((item) => item.id !== req.params.id);
  addAuditLog(activeEvent, currentUser, 'expense.deleted', 'expense', `Deleted expense ${removedExpense.title}.`, { expenseId: removedExpense.id, amount: removedExpense.amount });
  syncSettlements(activeEvent);
  await writeStore(data);
  res.status(204).send();
}));

app.get('/api/dashboard', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  const activeEvent = getEventRecordForUser(data, currentUser);
  await writeStore(data);
  res.json(calculateDashboard(activeEvent));
}));

app.get('/api/settlements', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  const activeEvent = getEventRecordForUser(data, currentUser);
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

  addAuditLog(activeEvent, currentUser, 'settlement.updated', 'settlement', `Updated settlement from ${settlement.fromParticipantName} to ${settlement.toParticipantName}.`, {
    settlementId: settlement.id,
    amount: settlement.amount,
    paidAmount: settlement.paidAmount,
    status: settlement.status,
    transactionReference: settlement.transactionReference || ''
  });
  await writeStore(data);
  res.json(settlement);
}));


function extractEmailAddress(value = '') {
  const token = String(value || '')
    .split(/[\s,;|/<>]+/)
    .map((item) => item.trim())
    .find((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item));
  return token || '';
}

function participantContactEmail(participant = {}) {
  return extractEmailAddress(participant.email) || extractEmailAddress(participant.emailOrPhone);
}

function notificationRecipients(eventRecord, body = {}) {
  const target = body.target || 'all-participants';
  const selectedIds = new Set(Array.isArray(body.selectedParticipantIds) ? body.selectedParticipantIds : []);
  const dashboard = calculateDashboard(eventRecord);
  let participants = eventRecord.participants || [];

  if (target === 'participants-with-balance') {
    const debtorIds = new Set(
      dashboard.participantBalances
        .filter((balance) => balance.netBalance < -0.01)
        .map((balance) => balance.participantId)
    );
    participants = participants.filter((participant) => debtorIds.has(participant.id));
  } else if (target === 'selected-participants') {
    participants = participants.filter((participant) => selectedIds.has(participant.id));
  }

  return participants.map((participant) => ({
    participantId: participant.id,
    name: participant.name,
    email: participantContactEmail(participant)
  })).filter((recipient) => recipient.email);
}

function getMailer() {
  if (!EMAIL_NOTIFICATIONS_ENABLED) return null;
  if (!cachedMailer) {
    cachedMailer = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });
  }
  return cachedMailer;
}

function notificationPlainText(notification, eventRecord, recipient) {
  return [
    notification.title,
    '',
    `Hi ${recipient.name || 'there'},`,
    '',
    notification.message,
    '',
    `Event: ${eventRecord.event.name}`,
    `Date: ${eventRecord.event.date}`,
    `Location: ${eventRecord.event.location}`,
    '',
    'Generated by Team Outing Expense Tracker.',
    'Designed, engineered, and deployed by Satheeshkumar Balaji.'
  ].join('\n');
}

async function sendNotificationEmails(notification, eventRecord) {
  const shouldSendEmail = ['email', 'both'].includes(notification.channel);
  if (!shouldSendEmail) return notification.recipients;

  if (!EMAIL_NOTIFICATIONS_ENABLED) {
    notification.emailStatus = 'not-configured';
    notification.recipients = notification.recipients.map((recipient) => ({
      ...recipient,
      deliveryStatus: 'in-app-only',
      error: 'SMTP is not configured in Render.'
    }));
    return notification.recipients;
  }

  const mailer = getMailer();
  for (const recipient of notification.recipients) {
    try {
      await mailer.sendMail({
        from: SMTP_FROM,
        to: recipient.email,
        subject: `[${eventRecord.event.name}] ${notification.title}`,
        text: notificationPlainText(notification, eventRecord, recipient)
      });
      recipient.deliveryStatus = 'sent';
      recipient.sentAt = new Date().toISOString();
      delete recipient.error;
    } catch (error) {
      recipient.deliveryStatus = 'failed';
      recipient.error = error.message;
    }
  }

  const failed = notification.recipients.filter((recipient) => recipient.deliveryStatus === 'failed').length;
  notification.emailStatus = failed === 0 ? 'sent' : failed === notification.recipients.length ? 'failed' : 'partial';
  return notification.recipients;
}


function notificationVisibleToUser(notification = {}, eventRecord = {}, user = {}) {
  if (['admin', 'finance'].includes(user.role)) return true;

  const userEmail = normalizeIdentity(user.email);
  const matchingParticipantIds = new Set(
    (eventRecord.participants || [])
      .filter((participant) => participantMatchesUser(participant, user))
      .map((participant) => participant.id)
  );

  return (notification.recipients || []).some((recipient) => {
    const recipientEmail = normalizeIdentity(recipient.email);
    return (recipientEmail && recipientEmail === userEmail) || matchingParticipantIds.has(recipient.participantId);
  });
}

function inboxNotification(notification = {}, eventRecord = {}, user = {}) {
  const readByUserIds = Array.isArray(notification.readByUserIds) ? notification.readByUserIds : [];
  const isAdminLike = ['admin', 'finance'].includes(user.role);
  const userEmail = normalizeIdentity(user.email);
  const matchingParticipantIds = new Set(
    (eventRecord.participants || [])
      .filter((participant) => participantMatchesUser(participant, user))
      .map((participant) => participant.id)
  );
  const recipients = isAdminLike
    ? (notification.recipients || [])
    : (notification.recipients || []).filter((recipient) => {
      const recipientEmail = normalizeIdentity(recipient.email);
      return (recipientEmail && recipientEmail === userEmail) || matchingParticipantIds.has(recipient.participantId);
    });

  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    channel: notification.channel,
    status: notification.status,
    emailStatus: notification.emailStatus,
    recipientCount: recipients.length,
    recipients,
    createdByName: notification.createdByName,
    createdAt: notification.createdAt,
    read: readByUserIds.includes(user.id)
  };
}


app.get('/api/audit', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  requireRole(currentUser, ['admin', 'finance']);
  const activeEvent = getEventRecordForUser(data, currentUser);
  const rows = (activeEvent.auditLog || [])
    .map(publicAuditEntry)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  await writeStore(data);
  res.json(rows);
}));

app.get('/api/notification-inbox', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  const activeEvent = getEventRecordForUser(data, currentUser);
  const rows = (activeEvent.notifications || [])
    .filter((notification) => notificationVisibleToUser(notification, activeEvent, currentUser))
    .map((notification) => inboxNotification(notification, activeEvent, currentUser))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  await writeStore(data);
  res.json(rows);
}));

app.post('/api/notification-inbox/:id/read', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  const activeEvent = getEventRecordForUser(data, currentUser);
  const notification = requireExistingItem(findById(activeEvent.notifications || [], req.params.id), 'Notification');
  if (!notificationVisibleToUser(notification, activeEvent, currentUser)) {
    const error = new Error('You can only mark notifications visible to your account. Nice try, tiny permission gremlin.');
    error.statusCode = 403;
    throw error;
  }
  notification.readByUserIds = Array.isArray(notification.readByUserIds) ? notification.readByUserIds : [];
  if (!notification.readByUserIds.includes(currentUser.id)) notification.readByUserIds.push(currentUser.id);
  await writeStore(data);
  res.json(inboxNotification(notification, activeEvent, currentUser));
}));

app.post('/api/notification-inbox/read-all', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  const activeEvent = getEventRecordForUser(data, currentUser);
  let updated = 0;
  activeEvent.notifications = Array.isArray(activeEvent.notifications) ? activeEvent.notifications : [];
  for (const notification of activeEvent.notifications) {
    if (!notificationVisibleToUser(notification, activeEvent, currentUser)) continue;
    notification.readByUserIds = Array.isArray(notification.readByUserIds) ? notification.readByUserIds : [];
    if (!notification.readByUserIds.includes(currentUser.id)) {
      notification.readByUserIds.push(currentUser.id);
      updated += 1;
    }
  }
  await writeStore(data);
  res.json({ updated });
}));

app.get('/api/notifications', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  requireRole(currentUser, ['admin', 'finance']);
  const activeEvent = getEventRecordForUser(data, currentUser);
  await writeStore(data);
  res.json((activeEvent.notifications || []).slice().reverse());
}));

app.post('/api/notifications/send-preview', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  requireRole(currentUser, ['admin', 'finance']);
  const activeEvent = getEventRecordForUser(data, currentUser);
  assertActiveEventEditable(activeEvent);

  const recipients = notificationRecipients(activeEvent, req.body);
  if (recipients.length === 0) {
    return res.status(400).json({ error: 'No recipients with valid email addresses were found for this reminder.' });
  }

  const notification = {
    id: `n-${nanoid(8)}`,
    type: req.body.type || 'payment-reminder',
    title: req.body.title || 'Payment reminder',
    message: req.body.message || 'Please clear your pending outing balance.',
    channel: req.body.channel || 'in-app',
    target: req.body.target || 'all-participants',
    status: 'queued',
    emailStatus: ['email', 'both'].includes(req.body.channel) ? 'pending' : 'not-requested',
    recipientCount: recipients.length,
    recipients: recipients.map((recipient) => ({
      ...recipient,
      deliveryStatus: ['email', 'both'].includes(req.body.channel) ? 'pending' : 'in-app-queued'
    })),
    readByUserIds: [],
    createdByUserId: currentUser.id,
    createdByName: currentUser.name || currentUser.email,
    createdAt: new Date().toISOString()
  };

  await sendNotificationEmails(notification, activeEvent);
  notification.status = notification.emailStatus === 'failed' ? 'delivery-failed' : 'queued';
  activeEvent.notifications = Array.isArray(activeEvent.notifications) ? activeEvent.notifications : [];
  activeEvent.notifications.push(notification);
  addAuditLog(activeEvent, currentUser, 'notification.sent', 'notification', `Queued reminder ${notification.title} for ${notification.recipientCount} recipient(s).`, {
    notificationId: notification.id,
    channel: notification.channel,
    emailStatus: notification.emailStatus,
    recipientCount: notification.recipientCount
  });
  await writeStore(data);
  res.status(201).json(notification);
}));

app.delete('/api/notifications/:id', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  requireRole(currentUser, ['admin', 'finance']);
  const activeEvent = getEventRecordForUser(data, currentUser);
  const before = activeEvent.notifications.length;
  const removedNotification = findById(activeEvent.notifications || [], req.params.id);
  activeEvent.notifications = activeEvent.notifications.filter((notification) => notification.id !== req.params.id);
  if (activeEvent.notifications.length === before) {
    return res.status(404).json({ error: 'Notification not found.' });
  }
  addAuditLog(activeEvent, currentUser, 'notification.deleted', 'notification', `Deleted reminder ${removedNotification?.title || req.params.id}.`, { notificationId: req.params.id });
  await writeStore(data);
  res.status(204).send();
}));

function serverMoney(value, currency = 'INR') {
  // PDFKit's built-in Helvetica font does not reliably render currency symbols
  // such as the Indian Rupee glyph. Use an ASCII currency code so PDF output
  // is portable across browsers, PDF viewers, and hosting environments.
  const amount = Number(value || 0);
  const currencyCode = String(currency || 'INR').toUpperCase();
  const formattedAmount = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
  return `${currencyCode} ${formattedAmount}`;
}

function safeReportFileName(value = 'team-outing-expense-report') {
  return String(value)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'team-outing-expense-report';
}

function pdfStatusLabel(status) {
  return String(status || '').replace(/-/g, ' ') || 'pending';
}

function drawPdfTitle(doc, title, subtitle) {
  doc.fontSize(20).font('Helvetica-Bold').fillColor('#0f172a').text(title, { align: 'left' });
  if (subtitle) {
    doc.moveDown(0.25).fontSize(10).font('Helvetica').fillColor('#64748b').text(subtitle);
  }
  doc.moveDown(0.8);
}

function drawPdfSection(doc, title) {
  doc.moveDown(0.8);
  doc.fontSize(13).font('Helvetica-Bold').fillColor('#0f172a').text(title);
  doc.moveDown(0.35);
  doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor('#e2e8f0').stroke();
  doc.moveDown(0.5);
}

function ensurePdfSpace(doc, needed = 90) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function drawKeyValueGrid(doc, items, currency) {
  const colWidth = 250;
  const rowHeight = 42;
  const startX = doc.page.margins.left;
  let x = startX;
  let y = doc.y;

  items.forEach((item, index) => {
    ensurePdfSpace(doc, rowHeight + 8);
    x = startX + (index % 2) * (colWidth + 16);
    if (index > 0 && index % 2 === 0) y += rowHeight + 10;
    if (index % 2 === 0) doc.y = y;

    doc.roundedRect(x, y, colWidth, rowHeight, 8).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.fillColor('#64748b').fontSize(8).font('Helvetica-Bold').text(item.label.toUpperCase(), x + 12, y + 9, { width: colWidth - 24 });
    doc.fillColor(item.danger ? '#be123c' : '#0f172a').fontSize(12).font('Helvetica-Bold').text(item.value, x + 12, y + 22, { width: colWidth - 24 });
  });

  doc.y = y + rowHeight + 8;
}

function drawSimpleTable(doc, columns, rows, options = {}) {
  const { emptyText = 'No rows available.', rowHeight = 22, fontSize = 8 } = options;
  if (!rows.length) {
    doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(emptyText);
    return;
  }

  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const totalWeight = columns.reduce((sum, column) => sum + (column.weight || 1), 0);
  const widths = columns.map((column) => Math.floor((usableWidth * (column.weight || 1)) / totalWeight));

  function drawHeader() {
    ensurePdfSpace(doc, rowHeight + 8);
    const y = doc.y;
    let x = doc.page.margins.left;
    doc.rect(x, y, usableWidth, rowHeight).fill('#0f172a');
    columns.forEach((column, index) => {
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(fontSize).text(column.label, x + 5, y + 7, { width: widths[index] - 10, ellipsis: true });
      x += widths[index];
    });
    doc.y = y + rowHeight;
  }

  drawHeader();
  rows.forEach((row, rowIndex) => {
    ensurePdfSpace(doc, rowHeight + 8);
    if (doc.y < 80) drawHeader();
    const y = doc.y;
    let x = doc.page.margins.left;
    if (rowIndex % 2 === 0) doc.rect(x, y, usableWidth, rowHeight).fill('#f8fafc');
    columns.forEach((column, index) => {
      const value = typeof column.value === 'function' ? column.value(row) : row[column.key];
      doc.fillColor('#0f172a').font('Helvetica').fontSize(fontSize).text(String(value ?? ''), x + 5, y + 7, {
        width: widths[index] - 10,
        height: rowHeight - 8,
        ellipsis: true
      });
      x += widths[index];
    });
    doc.y = y + rowHeight;
  });
  doc.moveDown(0.4);
}

function buildPdfReport(doc, activeEvent, report, generatedBy) {
  const currency = report.event.currency || 'INR';
  const generatedAt = new Date(report.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  drawPdfTitle(
    doc,
    `${report.event.name} - Expense Report`,
    `Generated ${generatedAt}${generatedBy?.email ? ` by ${generatedBy.email}` : ''}`
  );

  doc.fontSize(10).font('Helvetica').fillColor('#334155')
    .text(`Date: ${report.event.date || 'N/A'}`)
    .text(`Location: ${report.event.location || 'N/A'}`)
    .text(`Organizer: ${report.event.organizer?.name || 'N/A'}${report.event.organizer?.email ? ` (${report.event.organizer.email})` : ''}`)
    .text(`Event status: ${activeEvent.status || 'active'}`);

  drawPdfSection(doc, 'Financial summary');
  drawKeyValueGrid(doc, [
    { label: 'Total budget', value: serverMoney(report.totals.totalBudget, currency) },
    { label: 'Planned category budget', value: serverMoney(report.totals.plannedBudget, currency) },
    { label: 'Total spent', value: serverMoney(report.totals.totalSpent, currency) },
    { label: 'Remaining budget', value: serverMoney(report.totals.remainingBudget, currency), danger: report.totals.isOverBudget }
  ], currency);

  drawPdfSection(doc, 'Category-wise expenses');
  drawSimpleTable(doc, [
    { label: 'Category', key: 'name', weight: 2 },
    { label: 'Estimated', value: (row) => serverMoney(row.estimatedCost, currency), weight: 1 },
    { label: 'Actual', value: (row) => serverMoney(row.actualCost, currency), weight: 1 },
    { label: 'Remaining', value: (row) => serverMoney(row.remaining, currency), weight: 1 }
  ], report.categoryWiseExpenses, { emptyText: 'No categories available.' });

  drawPdfSection(doc, 'Participant-wise contribution');
  drawSimpleTable(doc, [
    { label: 'Participant', key: 'name', weight: 2 },
    { label: 'Paid', value: (row) => serverMoney(row.amountPaid, currency), weight: 1 },
    { label: 'Owed', value: (row) => serverMoney(row.amountOwed, currency), weight: 1 },
    { label: 'Net balance', value: (row) => serverMoney(row.netBalance, currency), weight: 1 },
    { label: 'Status', value: (row) => pdfStatusLabel(row.paymentStatus), weight: 1 }
  ], report.participantWiseContribution, { emptyText: 'No participants available.' });

  drawPdfSection(doc, 'Settlement summary');
  drawSimpleTable(doc, [
    { label: 'From', key: 'fromName', weight: 2 },
    { label: 'To', key: 'toName', weight: 2 },
    { label: 'Amount', value: (row) => serverMoney(row.amount, currency), weight: 1 },
    { label: 'Status', value: (row) => pdfStatusLabel(row.status), weight: 1 },
    { label: 'Reference', value: (row) => row.transactionReference || '-', weight: 1 }
  ], report.settlementSummary, { emptyText: 'No settlement payments needed.' });

  drawPdfSection(doc, 'Expense list');
  const participantMap = new Map(activeEvent.participants.map((participant) => [participant.id, participant.name]));
  const categoryMap = new Map(activeEvent.categories.map((category) => [category.id, category.name]));
  drawSimpleTable(doc, [
    { label: 'Date', key: 'date', weight: 1 },
    { label: 'Expense', key: 'title', weight: 2 },
    { label: 'Category', value: (row) => categoryMap.get(row.categoryId) || 'Uncategorized', weight: 1.3 },
    { label: 'Paid by', value: (row) => participantMap.get(row.paidByParticipantId) || 'Unknown', weight: 1.3 },
    { label: 'Amount', value: (row) => serverMoney(row.amount, currency), weight: 1 },
    { label: 'Approval', value: (row) => pdfStatusLabel(row.approvalStatus), weight: 1 }
  ], activeEvent.expenses, { emptyText: 'No expenses recorded.', fontSize: 7.5 });

  drawPdfSection(doc, 'Receipt references');
  drawSimpleTable(doc, [
    { label: 'Expense', key: 'expenseTitle', weight: 2 },
    { label: 'Receipt file', value: (row) => row.receipt?.fileName || '-', weight: 2 },
    { label: 'URL', value: (row) => row.receipt?.url || '-', weight: 3 }
  ], report.receiptReferences, { emptyText: 'No receipt references attached.', fontSize: 7 });

  doc.moveDown(1.2);
  doc.fontSize(8).font('Helvetica').fillColor('#64748b')
    .text('Designed, engineered, and deployed by Satheeshkumar Balaji.', { align: 'center' });
}

app.get('/api/reports', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  const activeEvent = getEventRecordForUser(data, currentUser);
  await writeStore(data);
  res.json(buildExpenseReport(activeEvent));
}));


app.get('/api/reports.pdf', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  const activeEvent = getEventRecordForUser(data, currentUser);
  await writeStore(data);
  const report = buildExpenseReport(activeEvent);
  const fileName = `${safeReportFileName(activeEvent.event.name)}-expense-report.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Cache-Control', 'no-store');

  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    info: {
      Title: `${activeEvent.event.name} - Expense Report`,
      Author: 'Team Outing Expense Tracker',
      Subject: 'Team outing expense report'
    }
  });

  doc.on('error', (error) => {
    console.error('PDF generation failed:', error);
    if (!res.headersSent) res.status(500).json({ error: 'PDF generation failed.' });
  });

  doc.pipe(res);
  buildPdfReport(doc, activeEvent, report, currentUser);
  doc.end();
}));

app.get('/api/reports.csv', asyncHandler(async (req, res) => {
  const data = await readStore();
  normalizeMultiEventStore(data);
  const currentUser = resolveAppUser(data, req.authUser);
  const activeEvent = getEventRecordForUser(data, currentUser);
  await writeStore(data);
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
