const MONEY_DECIMALS = 2;
const EPSILON = 0.01;
const COLLECTION_ROUNDING_UNIT = 100;
export const PERSONAL_CATEGORY_ID = 'personal-off-budget';
export const PERSONAL_CATEGORY_NAME = 'Personal (off-budget split)';

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function roundWholeMoney(value) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) return 0;
  const sign = numericValue < 0 ? -1 : 1;
  return sign * Math.round(Math.abs(numericValue));
}

export function roundCollectionAmount(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 0;
  return Math.ceil(numericValue / COLLECTION_ROUNDING_UNIT) * COLLECTION_ROUNDING_UNIT;
}

export function calculatePlannedBudget(data = {}) {
  const categories = Array.isArray(data.categories) ? data.categories : [];
  return roundMoney(categories
    .filter((category) => category.id !== PERSONAL_CATEGORY_ID && category.isPersonal !== true)
    .reduce((sum, category) => sum + Number(category.estimatedCost || 0), 0));
}

export function isPersonalExpense(expense = {}) {
  return expense.categoryId === PERSONAL_CATEGORY_ID || expense.isPersonalExpense === true;
}

export function assertPositiveAmount(amount, label = 'Amount') {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
  return numericAmount;
}

function normalizeMoneyShares(rawShares, totalAmount) {
  const shares = rawShares.map((share) => ({
    participantId: share.participantId,
    amount: roundMoney(share.amount)
  }));

  const roundedTotal = roundMoney(shares.reduce((sum, share) => sum + share.amount, 0));
  const difference = roundMoney(totalAmount - roundedTotal);

  if (shares.length > 0 && Math.abs(difference) >= EPSILON) {
    shares[shares.length - 1].amount = roundMoney(shares[shares.length - 1].amount + difference);
  }

  return shares;
}

function normalizeBudgetCollectionPayments(payments = []) {
  if (!Array.isArray(payments)) return [];

  return payments
    .map((payment) => ({
      id: payment.id || '',
      amount: roundMoney(Number(payment.amount || 0)),
      mode: payment.mode || payment.paymentMode || 'UPI',
      reference: payment.reference || payment.note || '',
      paidAt: payment.paidAt || payment.collectedAt || new Date().toISOString().slice(0, 10),
      createdAt: payment.createdAt || null,
      updatedAt: payment.updatedAt || null
    }))
    .filter((payment) => Number.isFinite(payment.amount) && payment.amount > 0);
}

function collectionStatus(expectedAmount, collectedAmount) {
  if (expectedAmount <= EPSILON && collectedAmount <= EPSILON) return 'not-required';
  if (collectedAmount <= EPSILON) return 'not-collected';
  if (collectedAmount + EPSILON < expectedAmount) return 'partially-collected';
  if (collectedAmount > expectedAmount + EPSILON) return 'over-collected';
  return 'collected';
}



function normalizeItineraryStatus(status = 'planned') {
  return ['planned', 'completed', 'cancelled'].includes(status) ? status : 'planned';
}

function itineraryTimestamp(item = {}) {
  const date = item.date || '9999-12-31';
  const time = item.startTime || '23:59';
  return `${date}T${time}`;
}

function normalizeItineraryItems(items = []) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      id: item.id || '',
      title: String(item.title || '').trim(),
      date: item.date || '',
      startTime: item.startTime || '',
      endTime: item.endTime || '',
      location: item.location || '',
      categoryId: item.categoryId || '',
      notes: item.notes || '',
      status: normalizeItineraryStatus(item.status),
      completedAt: item.completedAt || null,
      completedBy: item.completedBy || null,
      cancelledAt: item.cancelledAt || null,
      cancelledBy: item.cancelledBy || null,
      createdAt: item.createdAt || null,
      updatedAt: item.updatedAt || null
    }))
    .filter((item) => item.title)
    .sort((left, right) => itineraryTimestamp(left).localeCompare(itineraryTimestamp(right)));
}

export function calculateItinerary(data = {}, todayOverride = '') {
  const items = normalizeItineraryItems(data.itinerary);
  const today = todayOverride || new Date().toISOString().slice(0, 10);
  const total = items.length;
  const completed = items.filter((item) => item.status === 'completed').length;
  const cancelled = items.filter((item) => item.status === 'cancelled').length;
  const planned = items.filter((item) => item.status === 'planned').length;
  const todayItems = items.filter((item) => item.date === today);
  const upcomingItems = items.filter((item) => item.status === 'planned' && (!item.date || item.date >= today));
  const nextItem = upcomingItems[0] || items.find((item) => item.status === 'planned') || null;
  const progressPercent = total > 0 ? roundMoney((completed / total) * 100) : 0;

  return {
    items,
    total,
    completed,
    cancelled,
    planned,
    today,
    todayItems,
    nextItem,
    progressPercent
  };
}

export function calculateBudgetCollections(data) {
  const participants = Array.isArray(data.participants) ? data.participants : [];
  const categories = Array.isArray(data.categories) ? data.categories : [];
  const storedCollections = Array.isArray(data.budgetCollections) ? data.budgetCollections : [];
  const collectionMap = new Map(storedCollections.map((item) => [item.participantId, item]));
  const plannedBudget = calculatePlannedBudget(data);
  const totalBudget = plannedBudget;
  const collectionBasis = plannedBudget;
  const suggestedPerParticipant = participants.length > 0 ? roundCollectionAmount(collectionBasis / participants.length) : 0;

  const participantsCollection = participants.map((participant) => {
    const stored = collectionMap.get(participant.id) || {};
    const rawExpected = Number(stored.expectedAmount);
    const isExpectedCustom = Boolean(stored.isExpectedCustom);
    const expectedAmount = isExpectedCustom && Number.isFinite(rawExpected) && rawExpected >= 0
      ? roundMoney(rawExpected)
      : suggestedPerParticipant;
    const payments = normalizeBudgetCollectionPayments(stored.payments);
    const collectedAmount = roundMoney(payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
    const pendingAmount = roundMoney(expectedAmount - collectedAmount);

    return {
      id: stored.id || `bc-${participant.id}`,
      participantId: participant.id,
      name: participant.name,
      emailOrPhone: participant.emailOrPhone || participant.email || '',
      suggestedAmount: suggestedPerParticipant,
      expectedAmount,
      isExpectedCustom,
      collectedAmount,
      pendingAmount,
      status: collectionStatus(expectedAmount, collectedAmount),
      payments
    };
  });

  const expectedTotal = roundMoney(participantsCollection.reduce((sum, item) => sum + item.expectedAmount, 0));
  const collectedTotal = roundMoney(participantsCollection.reduce((sum, item) => sum + item.collectedAmount, 0));
  const pendingTotal = roundMoney(expectedTotal - collectedTotal);

  return {
    totalBudget,
    plannedBudget,
    collectionBasis,
    participantCount: participants.length,
    suggestedPerParticipant,
    expectedTotal,
    collectedTotal,
    pendingTotal,
    participants: participantsCollection
  };
}



export const COMPANY_CLAIM_STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  'partially-received': 'Partially received',
  received: 'Received',
  rejected: 'Rejected',
  reopened: 'Reopened'
};

export const COMPANY_CLAIM_TYPES = {
  'fixed-pool': 'Fixed reimbursement to pool',
  financier: 'Company paid financier',
  'category-based': 'Category-based reimbursement',
  percentage: 'Percentage reimbursement',
  'direct-participant': 'Company paid participants directly'
};

export function isExpenseLockedByClaim(data = {}) {
  return (Array.isArray(data.companyClaims) ? data.companyClaims : []).some((claim) =>
    ['submitted', 'approved', 'partially-received', 'received'].includes(claim.status)
  );
}

function normalizeParticipantClaimPayments(payments = []) {
  if (!Array.isArray(payments)) return [];
  return payments
    .map((payment) => ({
      id: payment.id || '',
      participantId: payment.participantId || '',
      amount: roundMoney(Number(payment.amount || 0)),
      mode: payment.mode || payment.paymentMode || 'Bank transfer',
      reference: payment.reference || '',
      receivedAt: payment.receivedAt || payment.date || new Date().toISOString().slice(0, 10),
      note: payment.note || '',
      createdAt: payment.createdAt || null,
      updatedAt: payment.updatedAt || null
    }))
    .filter((payment) => payment.participantId && Number.isFinite(payment.amount) && payment.amount > 0);
}

function approvedOfficialExpenses(data = {}) {
  const expenses = Array.isArray(data.expenses) ? data.expenses : [];
  return expenses.filter((expense) =>
    (expense.approvalStatus || 'pending') === 'approved'
    && !isPersonalExpense(expense)
  );
}

function calculateClaimableAmount(claim = {}, data = {}) {
  const type = claim.type || 'fixed-pool';
  const expenses = approvedOfficialExpenses(data);

  if (type === 'category-based') {
    const selectedCategoryIds = new Set(Array.isArray(claim.categoryIds) ? claim.categoryIds : []);
    if (selectedCategoryIds.size === 0) return 0;
    return roundMoney(expenses
      .filter((expense) => selectedCategoryIds.has(expense.categoryId))
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0));
  }

  if (type === 'percentage') {
    const selectedCategoryIds = new Set(Array.isArray(claim.categoryIds) ? claim.categoryIds : []);
    const eligibleSpend = roundMoney(expenses
      .filter((expense) => selectedCategoryIds.size === 0 || selectedCategoryIds.has(expense.categoryId))
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0));
    const percentage = Math.max(0, Number(claim.percentage || 0));
    const rawAmount = roundMoney((eligibleSpend * percentage) / 100);
    const capAmount = Number(claim.capAmount || 0);
    return capAmount > 0 ? roundMoney(Math.min(rawAmount, capAmount)) : rawAmount;
  }

  if (type === 'direct-participant') {
    const directTotal = normalizeParticipantClaimPayments(claim.participantPayments)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return roundMoney(Number(claim.expectedAmount || directTotal || 0));
  }

  return roundMoney(Number(claim.expectedAmount || 0));
}

export function calculateCompanyClaims(data = {}) {
  const rawClaims = Array.isArray(data.companyClaims) ? data.companyClaims : [];
  const participantMap = new Map((Array.isArray(data.participants) ? data.participants : []).map((participant) => [participant.id, participant]));
  const categories = Array.isArray(data.categories) ? data.categories : [];
  const categoryMap = new Map(categories.map((category) => [category.id, category.name]));
  const approvedSpend = roundMoney(approvedOfficialExpenses(data).reduce((sum, expense) => sum + Number(expense.amount || 0), 0));

  const claims = rawClaims.map((claim) => {
    const type = claim.type || 'fixed-pool';
    const status = claim.status || 'draft';
    const participantPayments = normalizeParticipantClaimPayments(claim.participantPayments);
    const claimableAmount = calculateClaimableAmount({ ...claim, type }, data);
    const approvedAmount = roundMoney(Number(claim.approvedAmount || 0) || claimableAmount || Number(claim.expectedAmount || 0));
    const rawReceivedAmount = type === 'direct-participant'
      ? roundMoney(participantPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0))
      : roundMoney(Number(claim.receivedAmount || 0));
    const isReceivedStatus = ['partially-received', 'received'].includes(status);
    const receivedAmount = isReceivedStatus ? rawReceivedAmount : 0;
    const addsToPool = type !== 'direct-participant';
    const poolReceivedAmount = addsToPool ? receivedAmount : 0;
    const directParticipantAmount = addsToPool ? 0 : receivedAmount;
    const selectedCategoryIds = Array.isArray(claim.categoryIds) ? claim.categoryIds : [];

    return {
      id: claim.id || '',
      type,
      typeLabel: COMPANY_CLAIM_TYPES[type] || type,
      status,
      statusLabel: COMPANY_CLAIM_STATUS_LABELS[status] || status,
      title: claim.title || claim.name || 'Company reimbursement claim',
      expectedAmount: roundMoney(Number(claim.expectedAmount || claimableAmount || 0)),
      claimableAmount,
      approvedAmount,
      receivedAmount,
      rawReceivedAmount,
      poolReceivedAmount,
      directParticipantAmount,
      receivedByParticipantId: claim.receivedByParticipantId || '',
      receivedByName: participantMap.get(claim.receivedByParticipantId)?.name || '',
      mode: claim.mode || claim.paymentMode || 'Bank transfer',
      reference: claim.reference || '',
      note: claim.note || '',
      percentage: Number(claim.percentage || 0),
      capAmount: roundMoney(Number(claim.capAmount || 0)),
      categoryIds: selectedCategoryIds,
      categoryNames: selectedCategoryIds.map((id) => categoryMap.get(id) || id),
      participantPayments: participantPayments.map((payment) => ({
        ...payment,
        participantName: participantMap.get(payment.participantId)?.name || ''
      })),
      submittedAt: claim.submittedAt || '',
      approvedAt: claim.approvedAt || '',
      receivedAt: claim.receivedAt || '',
      createdAt: claim.createdAt || null,
      updatedAt: claim.updatedAt || null,
      locksExpenses: ['submitted', 'approved', 'partially-received', 'received'].includes(status),
      addsToPool
    };
  });

  const poolReceivedTotal = roundMoney(claims.reduce((sum, claim) => sum + Number(claim.poolReceivedAmount || 0), 0));
  const directParticipantTotal = roundMoney(claims.reduce((sum, claim) => sum + Number(claim.directParticipantAmount || 0), 0));
  const totalReceived = roundMoney(poolReceivedTotal + directParticipantTotal);
  const totalApproved = roundMoney(claims.reduce((sum, claim) => sum + Number(claim.approvedAmount || 0), 0));
  const totalExpected = roundMoney(claims.reduce((sum, claim) => sum + Number(claim.expectedAmount || 0), 0));
  const expenseLockActive = claims.some((claim) => claim.locksExpenses);
  const lockedClaim = claims.find((claim) => claim.locksExpenses) || null;

  return {
    claims,
    approvedSpend,
    totalExpected,
    totalApproved,
    totalReceived,
    poolReceivedTotal,
    directParticipantTotal,
    netParticipantCost: roundMoney(Math.max(0, approvedSpend - totalReceived)),
    expenseLockActive,
    lockedClaimId: lockedClaim?.id || '',
    lockedClaimTitle: lockedClaim?.title || '',
    lockedClaimStatus: lockedClaim?.status || ''
  };
}

function normalizeFundTransactions(transactions = []) {
  if (!Array.isArray(transactions)) return [];

  return transactions
    .map((transaction) => {
      const type = transaction.type || 'adjustment';
      const amount = roundMoney(Number(transaction.amount || 0));
      return {
        id: transaction.id || '',
        type,
        amount,
        participantId: transaction.participantId || '',
        mode: transaction.mode || transaction.paymentMode || 'UPI',
        reference: transaction.reference || '',
        note: transaction.note || transaction.description || '',
        date: transaction.date || transaction.paidAt || transaction.createdAt?.slice?.(0, 10) || new Date().toISOString().slice(0, 10),
        createdAt: transaction.createdAt || null,
        updatedAt: transaction.updatedAt || null
      };
    })
    .filter((transaction) => Number.isFinite(transaction.amount) && transaction.amount !== 0);
}

function isPoolExpense(expense = {}) {
  return expense.paymentSource === 'pool' || expense.paidFromPool === true;
}

export function calculateFundPool(data) {
  const budgetCollection = calculateBudgetCollections(data);
  const participants = Array.isArray(data.participants) ? data.participants : [];
  const participantMap = new Map(participants.map((participant) => [participant.id, participant]));
  const expenses = Array.isArray(data.expenses) ? data.expenses : [];
  const activeExpenses = expenses.filter((expense) => expense.approvalStatus !== 'rejected');
  const officialExpenses = activeExpenses.filter((expense) => !isPersonalExpense(expense));
  const poolExpenses = officialExpenses.filter(isPoolExpense);
  const personalExpenses = officialExpenses.filter((expense) => !isPoolExpense(expense));
  const transactions = normalizeFundTransactions(data.fundTransactions);
  const companyClaims = calculateCompanyClaims(data);

  const poolExpenseTotal = roundMoney(poolExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0));
  const personalExpenseTotal = roundMoney(personalExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0));
  const reimbursementTotal = roundMoney(transactions.filter((item) => item.type === 'reimbursement').reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0));
  const refundTotal = roundMoney(transactions.filter((item) => item.type === 'refund').reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0));
  const adjustmentTotal = roundMoney(transactions.filter((item) => item.type === 'adjustment').reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const companyReimbursementTotal = roundMoney(Number(companyClaims.poolReceivedTotal || 0));
  const currentBalance = roundMoney(Number(budgetCollection.collectedTotal || 0) + companyReimbursementTotal - poolExpenseTotal - reimbursementTotal - refundTotal + adjustmentTotal);

  const collectionLedger = (budgetCollection.participants || []).flatMap((collection) => (collection.payments || []).map((payment) => ({
    id: payment.id || `collection-${collection.participantId}-${payment.paidAt}-${payment.amount}`,
    type: 'collection',
    direction: 'inflow',
    date: payment.paidAt || '',
    amount: roundMoney(Number(payment.amount || 0)),
    participantId: collection.participantId,
    participantName: collection.name,
    mode: payment.mode || '',
    reference: payment.reference || '',
    note: 'Participant collection',
    source: 'budgetCollection'
  })));

  const expenseLedger = poolExpenses.map((expense) => ({
    id: expense.id,
    type: 'pool-expense',
    direction: 'outflow',
    date: expense.date || '',
    amount: roundMoney(Number(expense.amount || 0)),
    participantId: expense.handledByParticipantId || expense.paidByParticipantId || '',
    participantName: participantMap.get(expense.handledByParticipantId || expense.paidByParticipantId)?.name || 'Team fund pool',
    mode: expense.paymentMethod || '',
    reference: expense.reference || '',
    note: expense.title || 'Expense paid from pool',
    source: 'expense',
    expenseId: expense.id
  }));

  const companyClaimLedger = (companyClaims.claims || [])
    .filter((claim) => Number(claim.poolReceivedAmount || 0) > 0)
    .map((claim) => ({
      id: claim.id || `company-claim-${claim.receivedAt || claim.updatedAt || claim.createdAt || ''}`,
      type: 'company-reimbursement',
      direction: 'inflow',
      date: claim.receivedAt || claim.updatedAt?.slice?.(0, 10) || claim.createdAt?.slice?.(0, 10) || '',
      amount: roundMoney(Number(claim.poolReceivedAmount || 0)),
      participantId: claim.receivedByParticipantId || '',
      participantName: claim.receivedByName || participantMap.get(claim.receivedByParticipantId)?.name || 'Company reimbursement',
      mode: claim.mode || '',
      reference: claim.reference || '',
      note: claim.title || claim.typeLabel || 'Company reimbursement received',
      source: 'companyClaim'
    }));

  const transactionLedger = transactions.map((transaction) => {
    const outflow = transaction.type === 'reimbursement' || transaction.type === 'refund';
    return {
      id: transaction.id,
      type: transaction.type,
      direction: outflow ? 'outflow' : (Number(transaction.amount || 0) >= 0 ? 'inflow' : 'outflow'),
      date: transaction.date || '',
      amount: roundMoney(Math.abs(Number(transaction.amount || 0))),
      signedAmount: roundMoney(Number(transaction.amount || 0)),
      participantId: transaction.participantId || '',
      participantName: participantMap.get(transaction.participantId)?.name || '',
      mode: transaction.mode || '',
      reference: transaction.reference || '',
      note: transaction.note || '',
      source: 'fundTransaction'
    };
  });

  const ledger = [...collectionLedger, ...companyClaimLedger, ...expenseLedger, ...transactionLedger]
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.id || '').localeCompare(String(a.id || '')));

  return {
    collectedTotal: budgetCollection.collectedTotal,
    expectedTotal: budgetCollection.expectedTotal,
    pendingCollection: budgetCollection.pendingTotal,
    poolExpenseTotal,
    personalExpenseTotal,
    reimbursementTotal,
    refundTotal,
    adjustmentTotal,
    companyReimbursementTotal,
    currentBalance,
    poolExpenseCount: poolExpenses.length,
    personalExpenseCount: personalExpenses.length,
    transactions,
    ledger
  };
}


function normalizeFinalClosureRecords(records = []) {
  if (!Array.isArray(records)) return [];
  return records
    .map((record) => ({
      participantId: record.participantId || '',
      status: record.status || 'pending',
      amount: roundMoney(Number(record.amount || 0)),
      mode: record.mode || 'UPI',
      reference: record.reference || '',
      note: record.note || '',
      closedAt: record.closedAt || record.updatedAt || null,
      updatedAt: record.updatedAt || null
    }))
    .filter((record) => record.participantId);
}

export function calculateFinalClosure(data) {
  const participants = Array.isArray(data.participants) ? data.participants : [];
  const budgetCollection = calculateBudgetCollections(data);
  const fundPool = calculateFundPool(data);
  const companyClaims = calculateCompanyClaims(data);
  const settlementPlan = generateSettlementPlan(data);
  const storedClosure = data.finalClosure && typeof data.finalClosure === 'object' ? data.finalClosure : {};
  const recordMap = new Map(normalizeFinalClosureRecords(storedClosure.records).map((record) => [record.participantId, record]));

  const collectionMap = new Map((budgetCollection.participants || []).map((row) => [row.participantId, row]));
  const settlementPayableMap = new Map(participants.map((participant) => [participant.id, 0]));
  const settlementReceivableMap = new Map(participants.map((participant) => [participant.id, 0]));
  const directCompanyReimbursementMap = new Map(participants.map((participant) => [participant.id, 0]));

  for (const claim of companyClaims.claims || []) {
    if (claim.type !== 'direct-participant' || !['partially-received', 'received'].includes(claim.status)) continue;
    for (const payment of claim.participantPayments || []) {
      directCompanyReimbursementMap.set(
        payment.participantId,
        roundMoney((directCompanyReimbursementMap.get(payment.participantId) || 0) + Number(payment.amount || 0))
      );
    }
  }

  for (const settlement of settlementPlan.settlements || []) {
    const remainingAmount = roundMoney(Math.max(0, Number(settlement.amount || 0) - Number(settlement.paidAmount || 0)));
    if (remainingAmount <= EPSILON) continue;
    settlementPayableMap.set(
      settlement.fromParticipantId,
      roundMoney((settlementPayableMap.get(settlement.fromParticipantId) || 0) + remainingAmount)
    );
    settlementReceivableMap.set(
      settlement.toParticipantId,
      roundMoney((settlementReceivableMap.get(settlement.toParticipantId) || 0) + remainingAmount)
    );
  }

  const currentPoolBalance = roundMoney(Number(fundPool.currentBalance || 0));
  const distributablePoolBalance = Math.max(0, currentPoolBalance);
  const poolDeficit = Math.max(0, roundMoney(-currentPoolBalance));
  const collectedTotal = roundMoney(Number(budgetCollection.collectedTotal || 0));
  const expectedTotal = roundMoney(Number(budgetCollection.expectedTotal || 0));
  const participantCount = participants.length || 1;

  const rows = participants.map((participant) => {
    const collection = collectionMap.get(participant.id) || {};
    const paidToPool = roundMoney(Number(collection.collectedAmount || 0));
    const expectedCollection = roundMoney(Number(collection.expectedAmount || 0));
    const pendingCollection = roundMoney(Math.max(0, Number(collection.pendingAmount || 0)));
    const refundShareRatio = collectedTotal > EPSILON ? paidToPool / collectedTotal : 1 / participantCount;
    const deficitShareRatio = expectedTotal > EPSILON ? expectedCollection / expectedTotal : 1 / participantCount;
    const poolRefundShare = roundMoney(distributablePoolBalance * refundShareRatio);
    const poolDeficitShare = roundMoney(poolDeficit * deficitShareRatio);
    const settlementPayable = roundMoney(settlementPayableMap.get(participant.id) || 0);
    const settlementReceivable = roundMoney(settlementReceivableMap.get(participant.id) || 0);
    const settlementAdjustment = roundMoney(settlementReceivable - settlementPayable);
    const companyDirectReimbursement = roundMoney(directCompanyReimbursementMap.get(participant.id) || 0);
    const finalAmount = roundMoney(poolRefundShare - poolDeficitShare + settlementAdjustment - pendingCollection - companyDirectReimbursement);
    const absoluteFinalAmount = roundMoney(Math.abs(finalAmount));
    const poolRefundShareRounded = roundWholeMoney(poolRefundShare);
    const poolDeficitShareRounded = roundWholeMoney(poolDeficitShare);
    const settlementAdjustmentRounded = roundWholeMoney(settlementAdjustment);
    const pendingCollectionRounded = roundWholeMoney(pendingCollection);
    const finalAmountRounded = roundWholeMoney(finalAmount);
    const absoluteFinalAmountRounded = Math.abs(finalAmountRounded);
    const roundingAdjustment = roundMoney(finalAmountRounded - finalAmount);
    const finalAction = finalAmount > EPSILON ? 'refund-due' : finalAmount < -EPSILON ? 'collect-due' : 'settled';
    const record = recordMap.get(participant.id) || {};
    const completionStatus = finalAction === 'settled'
      ? 'settled'
      : record.status === 'completed'
        ? (finalAction === 'refund-due' ? 'refund-paid' : 'amount-collected')
        : record.status === 'waived'
          ? 'waived'
          : 'pending';

    return {
      participantId: participant.id,
      name: participant.name,
      emailOrPhone: participant.emailOrPhone || participant.email || '',
      paidToPool,
      expectedCollection,
      pendingCollection,
      poolRefundShare,
      poolRefundShareRounded,
      poolDeficitShare,
      poolDeficitShareRounded,
      settlementPayable,
      settlementReceivable,
      settlementAdjustment,
      settlementAdjustmentRounded,
      companyDirectReimbursement,
      companyDirectReimbursementRounded: roundWholeMoney(companyDirectReimbursement),
      pendingCollectionRounded,
      finalAmount,
      finalAmountRounded,
      absoluteFinalAmount,
      absoluteFinalAmountRounded,
      roundingAdjustment,
      finalAction,
      completionStatus,
      recordedAmount: roundMoney(Number(record.amount || 0)),
      mode: record.mode || '',
      reference: record.reference || '',
      note: record.note || '',
      closedAt: record.closedAt || null
    };
  });

  const totalRefundDue = roundMoney(rows.filter((row) => row.finalAmount > EPSILON).reduce((sum, row) => sum + row.finalAmount, 0));
  const totalCollectDue = roundMoney(rows.filter((row) => row.finalAmount < -EPSILON).reduce((sum, row) => sum + Math.abs(row.finalAmount), 0));
  const totalNetFinal = roundMoney(rows.reduce((sum, row) => sum + row.finalAmount, 0));
  const totalRefundDueRounded = rows
    .filter((row) => row.finalAmount > EPSILON)
    .reduce((sum, row) => sum + row.absoluteFinalAmountRounded, 0);
  const totalCollectDueRounded = rows
    .filter((row) => row.finalAmount < -EPSILON)
    .reduce((sum, row) => sum + row.absoluteFinalAmountRounded, 0);
  const totalNetFinalRounded = rows.reduce((sum, row) => sum + row.finalAmountRounded, 0);
  const totalRoundingAdjustment = roundMoney(totalNetFinalRounded - totalNetFinal);
  const totalRefundRoundingAdjustment = roundMoney(totalRefundDueRounded - totalRefundDue);
  const totalCollectRoundingAdjustment = roundMoney(totalCollectDueRounded - totalCollectDue);
  const roundedCashNetOutflow = roundMoney(totalRefundDueRounded - totalCollectDueRounded);
  const roundOffTargetPoolBalance = roundMoney(currentPoolBalance);
  const netRoundOffImpact = roundMoney(roundedCashNetOutflow - roundOffTargetPoolBalance);
  const roundOffBalancerAction = netRoundOffImpact > EPSILON
    ? 'collect-roundoff'
    : netRoundOffImpact < -EPSILON
      ? 'refund-roundoff'
      : 'balanced';
  const roundOffBalancerAmount = roundMoney(Math.abs(netRoundOffImpact));
  const roundOffBalancerAmountRounded = Math.abs(roundWholeMoney(netRoundOffImpact));
  const totalRefundWithRoundOffBalancer = roundMoney(totalRefundDueRounded + (roundOffBalancerAction === 'refund-roundoff' ? roundOffBalancerAmountRounded : 0));
  const totalCollectWithRoundOffBalancer = roundMoney(totalCollectDueRounded + (roundOffBalancerAction === 'collect-roundoff' ? roundOffBalancerAmountRounded : 0));
  const postBalancerCashNetOutflow = roundMoney(totalRefundWithRoundOffBalancer - totalCollectWithRoundOffBalancer);
  const postBalancerDifference = roundMoney(postBalancerCashNetOutflow - roundOffTargetPoolBalance);
  const completedCount = rows.filter((row) => row.finalAction === 'settled' || row.completionStatus === 'refund-paid' || row.completionStatus === 'amount-collected' || row.completionStatus === 'waived').length;
  const pendingCount = rows.length - completedCount;

  return {
    status: storedClosure.status || (pendingCount === 0 && rows.length > 0 ? 'closed' : 'calculated'),
    calculatedAt: storedClosure.calculatedAt || null,
    updatedAt: storedClosure.updatedAt || null,
    currentPoolBalance,
    distributablePoolBalance,
    poolDeficit,
    totalCollected: collectedTotal,
    totalExpectedCollection: expectedTotal,
    totalPendingCollection: budgetCollection.pendingTotal,
    totalSettlementPayable: roundMoney(rows.reduce((sum, row) => sum + row.settlementPayable, 0)),
    totalSettlementReceivable: roundMoney(rows.reduce((sum, row) => sum + row.settlementReceivable, 0)),
    companyClaims,
    companyReimbursementReceived: companyClaims.totalReceived,
    companyPoolReimbursementReceived: companyClaims.poolReceivedTotal,
    companyDirectReimbursementReceived: companyClaims.directParticipantTotal,
    totalRefundDue,
    totalRefundDueRounded,
    totalRefundRoundingAdjustment,
    totalCollectDue,
    totalCollectDueRounded,
    totalCollectRoundingAdjustment,
    totalNetFinal,
    totalNetFinalRounded,
    totalRoundingAdjustment,
    roundedCashNetOutflow,
    roundOffTargetPoolBalance,
    netRoundOffImpact,
    roundOffBalancerAction,
    roundOffBalancerAmount,
    roundOffBalancerAmountRounded,
    totalRefundWithRoundOffBalancer,
    totalCollectWithRoundOffBalancer,
    postBalancerCashNetOutflow,
    postBalancerDifference,
    completedCount,
    pendingCount,
    allClosed: pendingCount === 0 && rows.length > 0,
    rows
  };
}

export function validateExpensePayload(expense) {
  const requiredFields = ['title', 'amount', 'categoryId', 'date', 'paidByParticipantId', 'paymentMethod'];
  const missing = requiredFields.filter((field) => expense[field] === undefined || expense[field] === null || expense[field] === '');

  if (missing.length > 0) {
    throw new Error(`Missing required field(s): ${missing.join(', ')}.`);
  }

  const allowedPaymentSources = ['participant', 'pool'];
  const paymentSource = expense.paymentSource || 'participant';
  if (!allowedPaymentSources.includes(paymentSource)) {
    throw new Error(`Unsupported payment source: ${paymentSource}.`);
  }

  assertPositiveAmount(expense.amount, 'Expense amount');

  if (isPoolExpense(expense)) {
    return true;
  }

  if (!Array.isArray(expense.participantIds) || expense.participantIds.length === 0) {
    throw new Error('Select at least one participant for the expense split.');
  }

  const allowedSplitMethods = ['equal', 'selected', 'custom', 'percentage'];
  if (!allowedSplitMethods.includes(expense.splitMethod)) {
    throw new Error(`Unsupported split method: ${expense.splitMethod}.`);
  }

  return true;
}

export function calculateExpenseShares(expense) {
  validateExpensePayload(expense);

  if (isPoolExpense(expense)) {
    return [];
  }

  const amount = roundMoney(Number(expense.amount));
  const participantIds = [...new Set(expense.participantIds)];

  if (expense.splitMethod === 'equal' || expense.splitMethod === 'selected') {
    const baseShare = Math.floor((amount / participantIds.length) * 100) / 100;
    const rawShares = participantIds.map((participantId) => ({ participantId, amount: baseShare }));
    return normalizeMoneyShares(rawShares, amount);
  }

  if (expense.splitMethod === 'custom') {
    if (!Array.isArray(expense.customSplits) || expense.customSplits.length === 0) {
      throw new Error('Custom split requires at least one participant amount.');
    }

    const rawShares = expense.customSplits.map((split) => ({
      participantId: split.participantId,
      amount: assertPositiveAmount(split.amount, 'Custom split amount')
    }));

    const total = roundMoney(rawShares.reduce((sum, split) => sum + Number(split.amount), 0));
    if (Math.abs(total - amount) > EPSILON) {
      throw new Error(`Custom split total (${total}) must equal expense amount (${amount}).`);
    }

    return normalizeMoneyShares(rawShares, amount);
  }

  if (expense.splitMethod === 'percentage') {
    if (!Array.isArray(expense.percentageSplits) || expense.percentageSplits.length === 0) {
      throw new Error('Percentage split requires participant percentages.');
    }

    const totalPercentage = roundMoney(
      expense.percentageSplits.reduce((sum, split) => sum + Number(split.percentage || 0), 0)
    );

    if (Math.abs(totalPercentage - 100) > EPSILON) {
      throw new Error(`Percentage split total must be 100. Current total: ${totalPercentage}.`);
    }

    const rawShares = expense.percentageSplits.map((split) => ({
      participantId: split.participantId,
      amount: (amount * Number(split.percentage)) / 100
    }));

    return normalizeMoneyShares(rawShares, amount);
  }

  return [];
}

export function calculateDashboard(data, options = {}) {
  const includeSettlementPayments = options.includeSettlementPayments !== false;
  const approvedOrPendingExpenses = data.expenses.filter((expense) => expense.approvalStatus !== 'rejected');
  const budgetedExpenses = approvedOrPendingExpenses.filter((expense) => !isPersonalExpense(expense));
  const plannedBudget = calculatePlannedBudget(data);
  const totalBudget = plannedBudget;
  const totalSpent = roundMoney(budgetedExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0));
  const remainingBudget = roundMoney(totalBudget - totalSpent);

  const categoryMap = new Map(data.categories.map((category) => [category.id, category]));
  const participantMap = new Map(data.participants.map((participant) => [participant.id, participant]));

  const categorySpending = data.categories.map((category) => {
    const actual = budgetedExpenses
      .filter((expense) => expense.categoryId === category.id)
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

    return {
      id: category.id,
      name: category.name,
      estimatedCost: roundMoney(category.estimatedCost || 0),
      actualCost: roundMoney(actual),
      remaining: roundMoney(Number(category.estimatedCost || 0) - actual)
    };
  });

  const paidTotals = new Map();
  const owedTotals = new Map();

  for (const participant of data.participants) {
    paidTotals.set(participant.id, 0);
    owedTotals.set(participant.id, 0);
  }

  for (const expense of approvedOrPendingExpenses) {
    if (!isPoolExpense(expense)) {
      paidTotals.set(
        expense.paidByParticipantId,
        roundMoney((paidTotals.get(expense.paidByParticipantId) || 0) + Number(expense.amount || 0))
      );
    }

    const shares = calculateExpenseShares(expense);
    for (const share of shares) {
      owedTotals.set(share.participantId, roundMoney((owedTotals.get(share.participantId) || 0) + share.amount));
    }
  }

  const settlementPaidTotals = new Map();
  const settlementReceivedTotals = new Map();

  for (const participant of data.participants) {
    settlementPaidTotals.set(participant.id, 0);
    settlementReceivedTotals.set(participant.id, 0);
  }

  if (includeSettlementPayments) {
    for (const settlement of data.settlements || []) {
      const paidAmount = Math.min(
        roundMoney(Number(settlement.paidAmount || 0)),
        roundMoney(Number(settlement.amount || 0))
      );

      if (!Number.isFinite(paidAmount) || paidAmount <= 0) continue;

      settlementPaidTotals.set(
        settlement.fromParticipantId,
        roundMoney((settlementPaidTotals.get(settlement.fromParticipantId) || 0) + paidAmount)
      );
      settlementReceivedTotals.set(
        settlement.toParticipantId,
        roundMoney((settlementReceivedTotals.get(settlement.toParticipantId) || 0) + paidAmount)
      );
    }
  }

  const participantBalances = data.participants.map((participant) => {
    const amountPaid = roundMoney(paidTotals.get(participant.id) || 0);
    const amountOwed = roundMoney(owedTotals.get(participant.id) || 0);
    const settlementPaid = roundMoney(settlementPaidTotals.get(participant.id) || 0);
    const settlementReceived = roundMoney(settlementReceivedTotals.get(participant.id) || 0);
    const netBalanceBeforeSettlement = roundMoney(amountPaid - amountOwed);
    const netBalance = roundMoney(netBalanceBeforeSettlement + settlementPaid - settlementReceived);

    return {
      participantId: participant.id,
      name: participant.name,
      emailOrPhone: participant.emailOrPhone,
      attendanceStatus: participant.attendanceStatus,
      paymentStatus: netBalance === 0 ? 'settled' : participant.paymentStatus,
      amountPaid,
      amountOwed,
      settlementPaid,
      settlementReceived,
      netBalanceBeforeSettlement,
      netBalance,
      role: participantMap.get(participant.id)?.role
    };
  });

  const spendingByPaymentMethod = budgetedExpenses.reduce((acc, expense) => {
    acc[expense.paymentMethod] = roundMoney((acc[expense.paymentMethod] || 0) + Number(expense.amount || 0));
    return acc;
  }, {});

  return {
    event: data.event,
    totalBudget,
    plannedBudget,
    totalSpent,
    remainingBudget,
    isOverBudget: totalSpent > totalBudget,
    categorySpending,
    participantBalances,
    spendingByPaymentMethod,
    budgetCollection: calculateBudgetCollections(data),
    fundPool: calculateFundPool(data),
    companyClaims: calculateCompanyClaims(data),
    itinerarySummary: calculateItinerary(data),
    expenses: approvedOrPendingExpenses.map((expense) => ({
      ...expense,
      categoryName: isPersonalExpense(expense) ? PERSONAL_CATEGORY_NAME : (categoryMap.get(expense.categoryId)?.name || 'Uncategorized'),
      paidByName: isPoolExpense(expense) ? 'Team Fund Pool' : (participantMap.get(expense.paidByParticipantId)?.name || 'Unknown'),
      handledByName: participantMap.get(expense.handledByParticipantId || expense.paidByParticipantId)?.name || 'Unknown'
    }))
  };
}

export function generateSettlementPlan(data) {
  const dashboard = calculateDashboard(data, { includeSettlementPayments: false });
  const existingSettlementMap = new Map(
    (data.settlements || []).map((settlement) => [`${settlement.fromParticipantId}->${settlement.toParticipantId}`, settlement])
  );

  const debtors = dashboard.participantBalances
    .filter((balance) => balance.netBalance < -EPSILON)
    .map((balance) => ({
      participantId: balance.participantId,
      name: balance.name,
      amount: roundMoney(Math.abs(balance.netBalance))
    }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = dashboard.participantBalances
    .filter((balance) => balance.netBalance > EPSILON)
    .map((balance) => ({
      participantId: balance.participantId,
      name: balance.name,
      amount: roundMoney(balance.netBalance)
    }))
    .sort((a, b) => b.amount - a.amount);

  const settlements = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = roundMoney(Math.min(debtor.amount, creditor.amount));
    const key = `${debtor.participantId}->${creditor.participantId}`;
    const existing = existingSettlementMap.get(key);

    if (amount > EPSILON) {
      settlements.push({
        id: existing?.id || `s-${debtor.participantId}-${creditor.participantId}`,
        fromParticipantId: debtor.participantId,
        fromName: debtor.name,
        toParticipantId: creditor.participantId,
        toName: creditor.name,
        amount,
        paidAmount: roundMoney(existing?.paidAmount || 0),
        status: existing?.status || 'pending',
        transactionReference: existing?.transactionReference || '',
        paymentProofUrl: existing?.paymentProofUrl || '',
        updatedAt: existing?.updatedAt || null
      });
    }

    debtor.amount = roundMoney(debtor.amount - amount);
    creditor.amount = roundMoney(creditor.amount - amount);

    if (debtor.amount <= EPSILON) debtorIndex += 1;
    if (creditor.amount <= EPSILON) creditorIndex += 1;
  }

  const allSettled = settlements.every((settlement) => settlement.status === 'completed') && settlements.length > 0;

  return {
    settlements,
    allSettled,
    participantBalances: dashboard.participantBalances
  };
}

export function buildExpenseReport(data) {
  const dashboard = calculateDashboard(data);
  const settlementPlan = generateSettlementPlan(data);

  return {
    generatedAt: new Date().toISOString(),
    event: dashboard.event,
    totals: {
      totalBudget: dashboard.totalBudget,
      plannedBudget: dashboard.plannedBudget,
      totalSpent: dashboard.totalSpent,
      remainingBudget: dashboard.remainingBudget,
      isOverBudget: dashboard.isOverBudget
    },
    budgetCollection: dashboard.budgetCollection,
    fundPool: dashboard.fundPool,
    companyClaims: dashboard.companyClaims,
    finalClosure: calculateFinalClosure(data),
    itinerary: dashboard.itinerarySummary,
    categoryWiseExpenses: dashboard.categorySpending,
    participantWiseContribution: dashboard.participantBalances,
    settlementSummary: settlementPlan.settlements,
    receiptReferences: data.expenses
      .filter((expense) => expense.receipt && !isPersonalExpense(expense))
      .map((expense) => ({
        expenseId: expense.id,
        expenseTitle: expense.title,
        receipt: expense.receipt
      }))
  };
}

export function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value) => {
    if (value === null || value === undefined) return '';
    const text = String(value).replace(/"/g, '""');
    return /[",\n]/.test(text) ? `"${text}"` : text;
  };

  return [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n');
}
