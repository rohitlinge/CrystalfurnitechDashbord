export const ORDER_WORKFLOW = [
  'Pending',
  'Approved',
  'Production',
  'Packed',
  'Dispatched',
  'Delivered',
] as const;

export type OrderWorkflowStatus = (typeof ORDER_WORKFLOW)[number];
export type OrderStatus = OrderWorkflowStatus | 'Cancelled';

/** @deprecated Legacy status stored in older documents */
export type LegacyOrderStatus = 'Fulfilled';

export function normalizeOrderStatus(status: string | undefined | null): OrderStatus {
  if (!status) return 'Pending';
  if (status === 'Fulfilled') return 'Delivered';
  if (status === 'Cancelled') return 'Cancelled';
  if ((ORDER_WORKFLOW as readonly string[]).includes(status)) {
    return status as OrderWorkflowStatus;
  }
  return 'Pending';
}

export function getNextOrderStatus(current: string): OrderWorkflowStatus | null {
  const normalized = normalizeOrderStatus(current);
  if (normalized === 'Cancelled' || normalized === 'Delivered') return null;
  const idx = ORDER_WORKFLOW.indexOf(normalized as OrderWorkflowStatus);
  if (idx === -1 || idx >= ORDER_WORKFLOW.length - 1) return null;
  return ORDER_WORKFLOW[idx + 1];
}

export function getOrderStepIndex(status: string): number {
  const normalized = normalizeOrderStatus(status);
  if (normalized === 'Cancelled') return -1;
  return ORDER_WORKFLOW.indexOf(normalized as OrderWorkflowStatus);
}

export function canDealerCancel(status: string): boolean {
  return normalizeOrderStatus(status) === 'Pending';
}

export function canAdminCancel(status: string): boolean {
  const normalized = normalizeOrderStatus(status);
  return normalized !== 'Cancelled' && normalized !== 'Delivered';
}

export function isActiveOrder(status: string): boolean {
  const normalized = normalizeOrderStatus(status);
  return normalized !== 'Cancelled' && normalized !== 'Delivered';
}

export function isStockAllocated(status: string): boolean {
  const normalized = normalizeOrderStatus(status);
  return ['Packed', 'Dispatched', 'Delivered'].includes(normalized);
}

export function isValidOrderTransition(fromStatus: string, toStatus: OrderStatus): boolean {
  const from = normalizeOrderStatus(fromStatus);
  if (toStatus === 'Cancelled') {
    return from !== 'Cancelled' && from !== 'Delivered';
  }
  if (from === 'Cancelled' || from === 'Delivered') return false;
  return getNextOrderStatus(from) === toStatus;
}

export function orderStatusLabel(status: string): string {
  return normalizeOrderStatus(status);
}

export function orderAdvanceLabel(status: string): string | null {
  const next = getNextOrderStatus(status);
  if (!next) return null;
  const actionLabels: Partial<Record<OrderWorkflowStatus, string>> = {
    Approved: 'Approve Order',
    Production: 'Start Production',
    Packed: 'Mark Packed',
    Dispatched: 'Dispatch',
    Delivered: 'Confirm Delivered',
  };
  return actionLabels[next] || `Move to ${next}`;
}

export function orderStatusBadgeClass(status: string): string {
  const normalized = normalizeOrderStatus(status);
  switch (normalized) {
    case 'Pending':
      return 'bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30';
    case 'Approved':
      return 'bg-blue-500/15 text-blue-400 border border-blue-500/30';
    case 'Production':
      return 'bg-purple-500/15 text-purple-400 border border-purple-500/30';
    case 'Packed':
      return 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30';
    case 'Dispatched':
      return 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30';
    case 'Delivered':
      return 'bg-green-500/15 text-green-400 border border-green-500/30';
    case 'Cancelled':
      return 'bg-red-500/15 text-red-400 border border-red-500/30';
    default:
      return 'bg-white/10 text-cf-muted border border-white/10';
  }
}
