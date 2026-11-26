import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export interface ToastItem {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (!toasts.length) return null;

  return (
    <div
      className="no-print fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)]"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const Icon =
          t.type === 'success' ? CheckCircle2 : t.type === 'error' ? AlertCircle : Info;
        const tone =
          t.type === 'success'
            ? 'border-[#86EFAC] bg-white text-[#0F172A] dark:border-emerald-800 dark:bg-slate-900 dark:text-slate-100'
            : t.type === 'error'
            ? 'border-[#FCA5A5] bg-white text-[#0F172A] dark:border-red-800 dark:bg-slate-900 dark:text-slate-100'
            : 'border-[#B6CBE3] bg-white text-[#0F172A] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
        const iconColor =
          t.type === 'success'
            ? 'text-[#15803D] dark:text-emerald-400'
            : t.type === 'error'
            ? 'text-[#B91C1C] dark:text-red-400'
            : 'text-[#0D4EA6] dark:text-sky-400';

        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg transition-all ${tone}`}
          >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
            <p className="text-sm font-semibold leading-snug flex-1">{t.message}</p>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label="Đóng thông báo"
              className="p-1 rounded-lg text-[#475569] hover:text-[#0F172A] dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
