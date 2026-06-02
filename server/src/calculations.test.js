import assert from 'node:assert/strict';
import { calculateBudgetCollections, calculateDashboard, calculateExpenseShares, calculateFundPool, generateSettlementPlan } from './calculations.js';

const equalExpense = {
  title: 'Snacks',
  amount: 100,
  categoryId: 'c-food',
  date: '2026-07-18',
  paidByParticipantId: 'p1',
  participantIds: ['p1', 'p2', 'p3'],
  splitMethod: 'equal',
  customSplits: [],
  percentageSplits: [],
  paymentMethod: 'UPI'
};

assert.deepEqual(calculateExpenseShares(equalExpense), [
  { participantId: 'p1', amount: 33.33 },
  { participantId: 'p2', amount: 33.33 },
  { participantId: 'p3', amount: 33.34 }
]);

const data = {
  event: { estimatedBudget: 1000 },
  participants: [
    { id: 'p1', name: 'A', emailOrPhone: 'a@test.com', attendanceStatus: 'attending', paymentStatus: 'pending' },
    { id: 'p2', name: 'B', emailOrPhone: 'b@test.com', attendanceStatus: 'attending', paymentStatus: 'pending' },
    { id: 'p3', name: 'C', emailOrPhone: 'c@test.com', attendanceStatus: 'attending', paymentStatus: 'pending' }
  ],
  categories: [{ id: 'c-food', name: 'Food', estimatedCost: 1000 }],
  expenses: [equalExpense],
  settlements: []
};

const plan = generateSettlementPlan(data);
assert.equal(plan.settlements.length, 2);
assert.equal(plan.settlements[0].toParticipantId, 'p1');
assert.equal(plan.settlements[0].amount, 33.34);
assert.equal(plan.settlements[1].amount, 33.33);


const partialSettlementData = {
  event: { estimatedBudget: 1000 },
  participants: [
    { id: 'payer', name: 'Payer', emailOrPhone: 'payer@test.com', attendanceStatus: 'attending', paymentStatus: 'pending' },
    { id: 'receiver', name: 'Receiver', emailOrPhone: 'receiver@test.com', attendanceStatus: 'attending', paymentStatus: 'pending' }
  ],
  categories: [{ id: 'c-food', name: 'Food', estimatedCost: 1000 }],
  expenses: [
    {
      title: 'Dinner',
      amount: 100,
      categoryId: 'c-food',
      date: '2026-07-18',
      paidByParticipantId: 'receiver',
      participantIds: ['payer', 'receiver'],
      splitMethod: 'equal',
      customSplits: [],
      percentageSplits: [],
      paymentMethod: 'UPI'
    }
  ],
  settlements: [
    {
      id: 's-payer-receiver',
      fromParticipantId: 'payer',
      toParticipantId: 'receiver',
      amount: 50,
      paidAmount: 20,
      status: 'partially-paid'
    }
  ]
};

const settlementAwareDashboard = calculateDashboard(partialSettlementData);
const payerBalance = settlementAwareDashboard.participantBalances.find((balance) => balance.participantId === 'payer');
const receiverBalance = settlementAwareDashboard.participantBalances.find((balance) => balance.participantId === 'receiver');
assert.equal(payerBalance.netBalanceBeforeSettlement, -50);
assert.equal(payerBalance.settlementPaid, 20);
assert.equal(payerBalance.netBalance, -30);
assert.equal(receiverBalance.netBalanceBeforeSettlement, 50);
assert.equal(receiverBalance.settlementReceived, 20);
assert.equal(receiverBalance.netBalance, 30);

const rawSettlementPlan = generateSettlementPlan(partialSettlementData);
assert.equal(rawSettlementPlan.settlements[0].amount, 50);
assert.equal(rawSettlementPlan.settlements[0].paidAmount, 20);


const budgetCollectionData = {
  event: { estimatedBudget: 0 },
  participants: [
    { id: 'p1', name: 'A', emailOrPhone: 'a@test.com', attendanceStatus: 'attending' },
    { id: 'p2', name: 'B', emailOrPhone: 'b@test.com', attendanceStatus: 'attending' },
    { id: 'p3', name: 'C', emailOrPhone: 'c@test.com', attendanceStatus: 'attending' }
  ],
  categories: [{ id: 'c-travel', name: 'Travel', estimatedCost: 9000 }],
  expenses: [],
  settlements: [],
  budgetCollections: [
    {
      participantId: 'p1',
      expectedAmount: 4000,
      isExpectedCustom: true,
      payments: [
        { id: 'pay1', amount: 1000, mode: 'UPI', reference: 'ref1', paidAt: '2026-07-18' },
        { id: 'pay2', amount: 500, mode: 'Cash', reference: '', paidAt: '2026-07-19' }
      ]
    }
  ]
};

const collectionSummary = calculateBudgetCollections(budgetCollectionData);
assert.equal(collectionSummary.totalBudget, 9000);
assert.equal(collectionSummary.suggestedPerParticipant, 3000);
assert.equal(collectionSummary.expectedTotal, 10000);
assert.equal(collectionSummary.collectedTotal, 1500);
assert.equal(collectionSummary.pendingTotal, 8500);
assert.equal(collectionSummary.participants.find((item) => item.participantId === 'p1').status, 'partially-collected');
assert.equal(collectionSummary.participants.find((item) => item.participantId === 'p2').expectedAmount, 3000);
assert.equal(calculateDashboard(budgetCollectionData).budgetCollection.collectedTotal, 1500);


const roundedCollectionData = {
  event: { estimatedBudget: 0 },
  participants: [
    { id: 'rp1', name: 'Round A', emailOrPhone: 'a@test.com' },
    { id: 'rp2', name: 'Round B', emailOrPhone: 'b@test.com' },
    { id: 'rp3', name: 'Round C', emailOrPhone: 'c@test.com' }
  ],
  categories: [{ id: 'c-round', name: 'Rounded split', estimatedCost: 17307.69 }],
  expenses: [],
  settlements: [],
  budgetCollections: []
};

const roundedCollectionSummary = calculateBudgetCollections(roundedCollectionData);
assert.equal(roundedCollectionSummary.suggestedPerParticipant, 5800);
assert.equal(roundedCollectionSummary.expectedTotal, 17400);
assert.equal(roundedCollectionSummary.participants[0].expectedAmount, 5800);



const fundPoolData = {
  event: { estimatedBudget: 1000 },
  participants: [
    { id: 'p1', name: 'A', emailOrPhone: 'a@test.com', attendanceStatus: 'attending', paymentStatus: 'pending' },
    { id: 'p2', name: 'B', emailOrPhone: 'b@test.com', attendanceStatus: 'attending', paymentStatus: 'pending' }
  ],
  categories: [{ id: 'c-food', name: 'Food', estimatedCost: 1000 }],
  budgetCollections: [
    { participantId: 'p1', expectedAmount: 500, payments: [{ id: 'bc1', amount: 500, paidAt: '2026-07-18', mode: 'UPI' }] },
    { participantId: 'p2', expectedAmount: 500, payments: [{ id: 'bc2', amount: 500, paidAt: '2026-07-18', mode: 'UPI' }] }
  ],
  expenses: [
    {
      title: 'Pool dinner',
      amount: 300,
      categoryId: 'c-food',
      date: '2026-07-18',
      paidByParticipantId: 'p1',
      handledByParticipantId: 'p1',
      paymentSource: 'pool',
      participantIds: ['p1', 'p2'],
      splitMethod: 'equal',
      customSplits: [],
      percentageSplits: [],
      paymentMethod: 'UPI',
      approvalStatus: 'approved'
    },
    {
      title: 'Personal taxi',
      amount: 100,
      categoryId: 'c-food',
      date: '2026-07-19',
      paidByParticipantId: 'p2',
      paymentSource: 'participant',
      participantIds: ['p1', 'p2'],
      splitMethod: 'equal',
      customSplits: [],
      percentageSplits: [],
      paymentMethod: 'Cash',
      approvalStatus: 'approved'
    }
  ],
  fundTransactions: [
    { id: 'ft1', type: 'reimbursement', amount: 50, participantId: 'p2', date: '2026-07-20', mode: 'UPI' }
  ],
  settlements: []
};

const fundSummary = calculateFundPool(fundPoolData);
assert.equal(fundSummary.collectedTotal, 1000);
assert.equal(fundSummary.poolExpenseTotal, 300);
assert.equal(fundSummary.reimbursementTotal, 50);
assert.equal(fundSummary.currentBalance, 650);
const fundDashboard = calculateDashboard(fundPoolData);
const handlerBalance = fundDashboard.participantBalances.find((balance) => balance.participantId === 'p1');
assert.equal(handlerBalance.amountPaid, 0, 'Pool expense handler should not receive personal paid credit');
assert.equal(fundDashboard.fundPool.currentBalance, 650);
assert.deepEqual(calculateExpenseShares({
  title: 'Pool expense without participant split',
  amount: 250,
  categoryId: 'c-food',
  date: '2026-07-21',
  paidByParticipantId: 'p1',
  handledByParticipantId: 'p1',
  paymentSource: 'pool',
  participantIds: [],
  splitMethod: 'pool',
  customSplits: [],
  percentageSplits: [],
  paymentMethod: 'UPI'
}), []);

console.log('Expense calculation tests passed. Tiny mercy for arithmetic.');
