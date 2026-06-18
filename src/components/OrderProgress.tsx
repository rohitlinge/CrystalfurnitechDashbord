import {
  ORDER_WORKFLOW,
  normalizeOrderStatus,
  getOrderStepIndex,
  orderStatusLabel,
} from '../orders';

interface OrderProgressProps {
  status: string;
  compact?: boolean;
  className?: string;
}

export default function OrderProgress({ status, compact = false, className = '' }: OrderProgressProps) {
  const normalized = normalizeOrderStatus(status);
  const currentIdx = getOrderStepIndex(status);
  const isCancelled = normalized === 'Cancelled';

  if (isCancelled) {
    return (
      <span className={`text-[10px] font-bold uppercase text-red-400 ${className}`}>Cancelled</span>
    );
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        {ORDER_WORKFLOW.map((step, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          return (
            <span
              key={step}
              title={step}
              className={`h-1.5 rounded-full transition-all ${
                active ? 'w-4 bg-[#d4af37]' : done ? 'w-1.5 bg-green-500/70' : 'w-1.5 bg-white/15'
              }`}
            />
          );
        })}
        <span className="text-[9px] font-semibold text-cf-secondary ml-1 whitespace-nowrap">
          {orderStatusLabel(status)}
        </span>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-1">
        {ORDER_WORKFLOW.map((step, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          return (
            <div key={step} className="flex-1 flex flex-col items-center min-w-0">
              <div
                className={`w-full h-1 rounded-full ${
                  active ? 'bg-[#d4af37]' : done ? 'bg-green-500/60' : 'bg-white/10'
                }`}
              />
              <span
                className={`text-[8px] sm:text-[9px] mt-1 font-semibold uppercase tracking-wide truncate w-full text-center ${
                  active ? 'text-[#d4af37]' : done ? 'text-green-400/80' : 'text-cf-muted'
                }`}
              >
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
