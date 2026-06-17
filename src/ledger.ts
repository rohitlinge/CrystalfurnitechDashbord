import { LedgerEntry } from './types';
import { formatINR } from './credit';

export function formatLedgerDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatLedgerAmount(amount: number): string {
  if (!amount) return '—';
  return formatINR(amount);
}

export function ledgerTypeLabel(type: LedgerEntry['type']): string {
  switch (type) {
    case 'opening':
      return 'Opening';
    case 'payment':
      return 'Payment';
    case 'order':
      return 'Order';
    case 'order_cancel':
      return 'Reversal';
    case 'credit_note':
      return 'Credit Note';
    case 'adjustment':
      return 'Adjustment';
    default:
      return type;
  }
}
