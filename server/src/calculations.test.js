import assert from 'node:assert/strict';
import { calculateDashboard, calculateExpenseShares, generateSettlementPlan } from './calculations.js';

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

console.log('Expense calculation tests passed. Tiny mercy for arithmetic.');
