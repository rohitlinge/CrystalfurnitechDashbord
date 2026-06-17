import { DealerProfile } from './types';

export const DEFAULT_CREDIT_LIMIT = 500_000;
export const DEFAULT_CREDIT_DAYS = 30;

export const DEFAULT_DEALER_CREDIT = {
  creditLimit: DEFAULT_CREDIT_LIMIT,
  outstandingBalance: 0,
  creditDays: DEFAULT_CREDIT_DAYS,
} as const;

export function getDealerCreditInfo(dealer: Partial<DealerProfile>) {
  const creditLimit = dealer.creditLimit ?? DEFAULT_CREDIT_LIMIT;
  const outstandingBalance = dealer.outstandingBalance ?? 0;
  const creditDays = dealer.creditDays ?? DEFAULT_CREDIT_DAYS;
  const usedCredit = outstandingBalance;
  const availableCredit = Math.max(0, creditLimit - outstandingBalance);
  return { creditLimit, outstandingBalance, usedCredit, availableCredit, creditDays };
}

export function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}
