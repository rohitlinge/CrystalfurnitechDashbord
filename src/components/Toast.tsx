import React, { useEffect } from 'react';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';

export type ToastType = 'error' | 'success' | 'info';

export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export default function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const styles = {
    error: 'bg-red-500/15 border-red-500/40 text-red-300',
    success: 'bg-green-500/15 border-green-500/40 text-green-300',
    info: 'bg-[#b65200]/15 border-[#d4af37]/40 text-[#d4af37]',
  };

  const Icon = toast.type === 'success' ? CheckCircle : AlertTriangle;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-md animate-fade-in">
      <div className={`flex items-start gap-2 px-4 py-3 rounded-xl border text-sm shadow-lg ${styles[toast.type]}`}>
        <Icon className="w-4 h-4 shrink-0 mt-0.5" />
        <p className="flex-1 font-medium">{toast.message}</p>
        <button type="button" onClick={onDismiss} className="opacity-70 hover:opacity-100">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
