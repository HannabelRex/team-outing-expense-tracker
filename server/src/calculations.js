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
