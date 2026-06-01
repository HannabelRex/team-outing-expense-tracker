const MONEY_DECIMALS = 2;
const EPSILON = 0.01;

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
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

export function calculateBudgetCollections(data) {
  const participants = Array.isArray(data.participants) ? data.participants : [];
  const categories = Array.isArray(data.categories) ? data.categories : [];
  const storedCollections = Array.isArray(data.budgetCollections) ? data.budgetCollections : [];
  const collectionMap = new Map(storedCollections.map((item) => [item.participantId, item]));
  const totalBudget = roundMoney(Number(data.event?.estimatedBudget || 0));
  const plannedBudget = roundMoney(categories.reduce((sum, category) => sum + Number(category.estimatedCost || 0), 0));
  const collectionBasis = totalBudget > 0 ? totalBudget : plannedBudget;
  const suggestedPerParticipant = participants.length > 0 ? roundMoney(collectionBasis / participants.length) : 0;

  const participantsCollection = participants.map((participant) => {
    const stored = collectionMap.get(participant.id) || {};
    const rawExpected = Number(stored.expectedAmount);
    const expectedAmount = Number.isFinite(rawExpected) && rawExpected >= 0
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
      isExpectedCustom: Boolean(stored.isExpectedCustom),
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

export function validateExpensePayload(expense) {
  const requiredFields = ['title', 'amount', 'categoryId', 'date', 'paidByParticipantId', 'paymentMethod'];
  const missing = requiredFields.filter((field) => expense[field] === undefined || expense[field] === null || expense[field] === '');

  if (missing.length > 0) {
    throw new Error(`Missing required field(s): ${missing.join(', ')}.`);
  }

  assertPositiveAmount(expense.amount, 'Expense amount');

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
  const totalBudget = roundMoney(Number(data.event.estimatedBudget || 0));
  const plannedBudget = roundMoney(data.categories.reduce((sum, category) => sum + Number(category.estimatedCost || 0), 0));
  const totalSpent = roundMoney(approvedOrPendingExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0));
  const remainingBudget = roundMoney(totalBudget - totalSpent);

  const categoryMap = new Map(data.categories.map((category) => [category.id, category]));
  const participantMap = new Map(data.participants.map((participant) => [participant.id, participant]));

  const categorySpending = data.categories.map((category) => {
    const actual = approvedOrPendingExpenses
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
    paidTotals.set(
      expense.paidByParticipantId,
      roundMoney((paidTotals.get(expense.paidByParticipantId) || 0) + Number(expense.amount || 0))
    );

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

  const spendingByPaymentMethod = approvedOrPendingExpenses.reduce((acc, expense) => {
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
    expenses: approvedOrPendingExpenses.map((expense) => ({
      ...expense,
      categoryName: categoryMap.get(expense.categoryId)?.name || 'Uncategorized',
      paidByName: participantMap.get(expense.paidByParticipantId)?.name || 'Unknown'
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
    categoryWiseExpenses: dashboard.categorySpending,
    participantWiseContribution: dashboard.participantBalances,
    settlementSummary: settlementPlan.settlements,
    receiptReferences: data.expenses
      .filter((expense) => expense.receipt)
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
