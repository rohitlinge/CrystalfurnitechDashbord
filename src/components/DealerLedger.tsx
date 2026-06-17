import React from 'react';
import { LedgerEntry } from '../types';
import { formatLedgerAmount, formatLedgerDate } from '../ledger';
import { BookOpen } from 'lucide-react';

interface DealerLedgerProps {
  entries: LedgerEntry[];
  loading?: boolean;
  emptyMessage?: string;
}

export default function DealerLedger({
  entries,
  loading = false,
  emptyMessage = 'No ledger entries yet.',
}: DealerLedgerProps) {
  if (loading) {
    return (
      <div className="py-8 text-center text-neutral-500 text-sm">Loading ledger...</div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="py-8 text-center text-neutral-500 text-sm flex flex-col items-center gap-2">
        <BookOpen className="w-8 h-8 text-neutral-600" />
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="min-w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-white/10 text-neutral-500 uppercase tracking-wider">
            <th className="py-2.5 px-2 font-bold whitespace-nowrap">Date</th>
            <th className="py-2.5 px-2 font-bold">Description</th>
            <th className="py-2.5 px-2 font-bold text-right whitespace-nowrap">Debit</th>
            <th className="py-2.5 px-2 font-bold text-right whitespace-nowrap">Credit</th>
            <th className="py-2.5 px-2 font-bold text-right whitespace-nowrap">Balance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {entries.map((entry) => (
            <tr key={entry.id} className="hover:bg-white/[0.02]">
              <td className="py-2.5 px-2 text-neutral-400 whitespace-nowrap align-top">
                {formatLedgerDate(entry.date)}
              </td>
              <td className="py-2.5 px-2 text-white align-top max-w-[140px] sm:max-w-none">
                <span className="block">{entry.description}</span>
              </td>
              <td className="py-2.5 px-2 text-right text-red-400 font-mono whitespace-nowrap align-top">
                {Number(entry.debit) > 0 ? formatLedgerAmount(Number(entry.debit)) : '—'}
              </td>
              <td className="py-2.5 px-2 text-right text-green-400 font-mono whitespace-nowrap align-top">
                {Number(entry.credit) > 0 ? formatLedgerAmount(Number(entry.credit)) : '—'}
              </td>
              <td className="py-2.5 px-2 text-right text-[#d4af37] font-mono font-semibold whitespace-nowrap align-top">
                {formatLedgerAmount(Number(entry.balance) || 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
