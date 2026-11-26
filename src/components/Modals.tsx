import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileDown,
  KeyRound,
  Printer,
  ShieldCheck,
  X,
} from 'lucide-react';

interface ModalShellProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

const ModalShell: React.FC<ModalShellProps> = ({ open, title, subtitle, onClose, children }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-[#C7D6E8] dark:border-slate-800 bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-100 shadow-xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#C7D6E8] dark:border-slate-800 bg-[#EEF4FB]/80 dark:bg-slate-900">
          <div>
            <h2 id="modal-title" className="text-base font-bold font-display text-[#083578] dark:text-slate-100">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-xs font-medium text-[#334155] dark:text-slate-400">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại"
            className="p-1.5 rounded-lg text-[#334155] hover:text-[#0F172A] hover:bg-[#DCEBFF] dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

/* ===== 1. Xác nhận bỏ chọn ca ===== */
interface UncheckConfirmModalProps {
  target: {
    machineName: string;
    stt: number;
    sessionLabel: string;
    startTime: string;
    endTime: string;
  } | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export const UncheckConfirmModal: React.FC<UncheckConfirmModalProps> = ({
  target,
  onCancel,
  onConfirm,
}) => {
  return (
    <ModalShell
      open={Boolean(target)}
      title="Xác nhận bỏ chọn ca chụp"
      subtitle="Thao tác này sẽ cập nhật trực tiếp lên máy chủ"
      onClose={onCancel}
    >
      {target && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-lg border border-amber-300 bg-amber-50/90 dark:border-amber-800/60 dark:bg-amber-950/30">
            <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm font-medium leading-relaxed text-[#0F172A] dark:text-slate-200">
              Bạn có chắc chắn muốn bỏ chọn khung giờ{' '}
              <span className="font-mono font-bold tabular-nums text-[#083578] dark:text-sky-300">
                {target.startTime} – {target.endTime}
              </span>{' '}
              (STT <span className="font-mono font-bold">{target.stt}</span> · {target.sessionLabel}) của máy{' '}
              <span className="font-bold">{target.machineName}</span> không?
            </div>
          </div>
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-[#C7D6E8] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#0F172A] dark:text-slate-200 hover:bg-[#EEF4FB] dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Giữ nguyên
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer"
            >
              Bỏ chọn ca
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
};

/* ===== 1b. Xác nhận chọn nhanh ca chụp trống gần nhất (Phím T) ===== */
interface QuickPickConfirmModalProps {
  target: {
    machineName: string;
    stt: number;
    sessionLabel: string;
    startTime: string;
    endTime: string;
    relativeNote: string;
  } | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export const QuickPickConfirmModal: React.FC<QuickPickConfirmModalProps> = ({
  target,
  onCancel,
  onConfirm,
}) => {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!target) return;
    const t = window.setTimeout(() => confirmBtnRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [target]);

  return (
    <ModalShell
      open={Boolean(target)}
      title="Xác nhận chọn nhanh ca chụp"
      subtitle="Giờ bắt đầu trống gần nhất với thời gian hiện tại (Phím tắt T)"
      onClose={onCancel}
    >
      {target && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-lg border border-[#93BCEB] bg-[#F2F7FF] dark:border-sky-800/70 dark:bg-sky-950/40">
            <Clock3 className="w-5 h-5 text-[#0D4EA6] dark:text-sky-400 shrink-0 mt-0.5" />
            <div className="text-sm font-medium leading-relaxed text-[#0F172A] dark:text-slate-200">
              Bạn muốn chọn ca chụp khung giờ{' '}
              <span className="font-mono font-extrabold tabular-nums text-[#083578] dark:text-sky-300">
                {target.startTime} – {target.endTime}
              </span>{' '}
              (STT <span className="font-mono font-bold">{target.stt}</span> · {target.sessionLabel})
              của máy <span className="font-bold">{target.machineName}</span>?
              <div className="mt-1 text-xs font-semibold text-[#0D4EA6] dark:text-sky-300">
                {target.relativeNote}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-[#C7D6E8] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#0F172A] dark:text-slate-200 hover:bg-[#EEF4FB] dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              ref={confirmBtnRef}
              type="button"
              onClick={onConfirm}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-[#0D4EA6] hover:bg-[#083578] text-white transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Xác nhận chọn</span>
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
};

/* ===== 2. Xác thực mật khẩu quản trị (Mở Cài đặt / Thiết lập lần đầu) ===== */
interface AuthModalProps {
  open: boolean;
  mode: 'open-settings' | 'reset' | 'switch-machine';
  authConfigured: boolean;
  machineName: string;
  dateLabel: string;
  submitting: boolean;
  errorMsg: string | null;
  onClose: () => void;
  onSetupAndContinue: (newPassword: string) => void;
  onSubmitPassword: (password: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  mode,
  authConfigured,
  machineName,
  dateLabel,
  submitting,
  errorMsg,
  onClose,
  onSetupAndContinue,
  onSubmitPassword,
}) => {
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [localErr, setLocalErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPassword('');
      setConfirmPwd('');
      setLocalErr(null);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  const title = !authConfigured
    ? 'Thiết lập mật khẩu quản trị lần đầu'
    : mode === 'open-settings'
    ? 'Xác thực mở Menu Cài đặt'
    : mode === 'reset'
    ? 'Xác nhận Reset lịch chụp'
    : 'Xác thực đổi máy theo thiết bị';

  const subtitle = !authConfigured
    ? 'Máy chủ chưa có mật khẩu quản trị. Tạo mật khẩu mới để bảo vệ Menu Cài đặt, Đổi máy và Reset dữ liệu.'
    : mode === 'open-settings'
    ? 'Nhập mật khẩu quản trị để mở cài đặt lịch chụp, đổi máy trạm, chỉnh sửa máy/người phụ trách hoặc reset dữ liệu.'
    : mode === 'reset'
    ? `Chỉ xóa dữ liệu máy ${machineName} trong ngày ${dateLabel}`
    : 'Nhập mật khẩu quản trị để mở khóa chọn lại máy cho trình duyệt này';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr(null);
    if (!authConfigured) {
      if (password.length < 6) {
        setLocalErr('Mật khẩu quản trị phải có tối thiểu 6 ký tự.');
        return;
      }
      if (password !== confirmPwd) {
        setLocalErr('Mật khẩu xác nhận không khớp.');
        return;
      }
      onSetupAndContinue(password);
      return;
    }
    if (!password) {
      setLocalErr('Vui lòng nhập mật khẩu quản trị.');
      return;
    }
    onSubmitPassword(password);
  };

  const displayError = localErr || errorMsg;

  return (
    <ModalShell open={open} title={title} subtitle={subtitle} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'reset' && authConfigured && (
          <div className="p-3.5 rounded-lg border border-red-300 bg-red-50/90 dark:border-red-900/60 dark:bg-red-950/30 text-sm font-medium text-red-950 dark:text-red-200">
            Thao tác này sẽ xóa toàn bộ các ca đã tích của máy{' '}
            <strong className="font-bold">{machineName}</strong> trong ngày{' '}
            <strong className="font-mono tabular-nums">{dateLabel}</strong>. Dữ liệu của máy khác và
            các ngày khác vẫn được giữ nguyên.
          </div>
        )}

        {!authConfigured && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-[#93BCEB] bg-[#DCEBFF] dark:border-sky-800/60 dark:bg-sky-950/30 text-xs font-medium text-[#0F172A] dark:text-slate-300">
            <ShieldCheck className="w-4 h-4 text-[#0D4EA6] dark:text-sky-400 shrink-0 mt-0.5" />
            <span>
              Mật khẩu được mã hóa (hash + salt) và lưu trên máy chủ, không lưu trong mã nguồn hay
              trình duyệt.
            </span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-300 mb-1.5">
            {authConfigured ? 'Mật khẩu quản trị' : 'Mật khẩu quản trị mới (tối thiểu 6 ký tự)'}
          </label>
          <div className="relative">
            <KeyRound className="w-4 h-4 text-[#475569] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={inputRef}
              type="password"
              value={password ?? ''}
              onChange={(e) => setPassword(e.target.value ?? '')}
              placeholder="Nhập mật khẩu..."
              autoComplete="current-password"
              className="w-full pl-10 pr-3.5 py-2.5 text-sm font-medium rounded-lg border border-[#C7D6E8] dark:border-slate-700 bg-white dark:bg-slate-950 text-[#0F172A] dark:text-slate-100 focus:outline-none focus:border-[#0D4EA6] focus:ring-2 focus:ring-[#0D4EA6]/25"
            />
          </div>
        </div>

        {!authConfigured && (
          <div>
            <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-300 mb-1.5">
              Xác nhận mật khẩu mới
            </label>
            <input
              type="password"
              value={confirmPwd ?? ''}
              onChange={(e) => setConfirmPwd(e.target.value ?? '')}
              placeholder="Nhập lại mật khẩu..."
              autoComplete="new-password"
              className="w-full px-3.5 py-2.5 text-sm font-medium rounded-lg border border-[#C7D6E8] dark:border-slate-700 bg-white dark:bg-slate-950 text-[#0F172A] dark:text-slate-100 focus:outline-none focus:border-[#0D4EA6] focus:ring-2 focus:ring-[#0D4EA6]/25"
            />
          </div>
        )}

        {displayError && (
          <p className="text-xs font-bold text-red-700 dark:text-red-400">{displayError}</p>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-[#C7D6E8] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#0F172A] dark:text-slate-200 hover:bg-[#EEF4FB] dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting}
            className={`px-4 py-2 text-sm font-semibold rounded-lg text-white transition-colors cursor-pointer disabled:opacity-60 ${
              mode === 'reset' && authConfigured
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#0D4EA6] hover:bg-[#083578]'
            }`}
          >
            {submitting
              ? 'Đang xử lý...'
              : !authConfigured
              ? 'Lưu mật khẩu & Mở Cài đặt'
              : mode === 'reset'
              ? 'Xác nhận Reset'
              : mode === 'open-settings'
              ? 'Mở Menu Cài đặt'
              : 'Xác thực'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

/* ===== 3. Đổi mật khẩu quản trị ===== */
interface ChangePasswordModalProps {
  open: boolean;
  submitting: boolean;
  errorMsg: string | null;
  onClose: () => void;
  onSubmit: (currentPassword: string, newPassword: string) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  open,
  submitting,
  errorMsg,
  onClose,
  onSubmit,
}) => {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCur('');
      setNext('');
      setConfirm('');
      setLocalErr(null);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr(null);
    if (!cur) {
      setLocalErr('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (next.length < 6) {
      setLocalErr('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }
    if (next !== confirm) {
      setLocalErr('Mật khẩu xác nhận không khớp.');
      return;
    }
    onSubmit(cur, next);
  };

  return (
    <ModalShell
      open={open}
      title="Đổi mật khẩu quản trị"
      subtitle="Mật khẩu mới được lưu an toàn dưới dạng hash trên máy chủ"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-300 mb-1">
            Mật khẩu hiện tại
          </label>
          <input
            type="password"
            value={cur ?? ''}
            onChange={(e) => setCur(e.target.value ?? '')}
            className="w-full px-3.5 py-2.5 text-sm font-medium rounded-lg border border-[#C7D6E8] dark:border-slate-700 bg-white dark:bg-slate-950 text-[#0F172A] dark:text-slate-100 focus:outline-none focus:border-[#0D4EA6] focus:ring-2 focus:ring-[#0D4EA6]/25"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-300 mb-1">
            Mật khẩu mới (tối thiểu 6 ký tự)
          </label>
          <input
            type="password"
            value={next ?? ''}
            onChange={(e) => setNext(e.target.value ?? '')}
            className="w-full px-3.5 py-2.5 text-sm font-medium rounded-lg border border-[#C7D6E8] dark:border-slate-700 bg-white dark:bg-slate-950 text-[#0F172A] dark:text-slate-100 focus:outline-none focus:border-[#0D4EA6] focus:ring-2 focus:ring-[#0D4EA6]/25"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-300 mb-1">
            Xác nhận mật khẩu mới
          </label>
          <input
            type="password"
            value={confirm ?? ''}
            onChange={(e) => setConfirm(e.target.value ?? '')}
            className="w-full px-3.5 py-2.5 text-sm font-medium rounded-lg border border-[#C7D6E8] dark:border-slate-700 bg-white dark:bg-slate-950 text-[#0F172A] dark:text-slate-100 focus:outline-none focus:border-[#0D4EA6] focus:ring-2 focus:ring-[#0D4EA6]/25"
          />
        </div>

        {(localErr || errorMsg) && (
          <p className="text-xs font-bold text-red-700 dark:text-red-400">
            {localErr || errorMsg}
          </p>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-[#C7D6E8] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#0F172A] dark:text-slate-200 hover:bg-[#EEF4FB] dark:hover:bg-slate-700 cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#0D4EA6] hover:bg-[#083578] text-white cursor-pointer disabled:opacity-60"
          >
            {submitting ? 'Đang lưu...' : 'Cập nhật mật khẩu'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

/* ===== 5. Xuất PDF & In lịch A4 ===== */
interface PrintPdfModalProps {
  open: boolean;
  machineName: string;
  supervisor: string;
  dateLabel: string;
  totalRows: number;
  totalSlotsCount?: number;
  checkedCount: number;
  exporting: boolean;
  onClose: () => void;
  onDownloadPdf: () => void;
  onDirectPrint: () => void;
}

export const PrintPdfModal: React.FC<PrintPdfModalProps> = ({
  open,
  machineName,
  supervisor,
  dateLabel,
  totalRows,
  totalSlotsCount,
  checkedCount,
  exporting,
  onClose,
  onDownloadPdf,
  onDirectPrint,
}) => {
  const effectiveTotalSlots = totalSlotsCount ?? totalRows * 2;
  return (
    <ModalShell
      open={open}
      title="In lịch & Xuất file PDF (A4)"
      subtitle={`Máy ${machineName} · Ngày ${dateLabel}`}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="p-3.5 rounded-lg border border-[#C7D6E8] dark:border-slate-700 bg-[#EEF4FB] dark:bg-slate-800/70 space-y-1.5 text-xs sm:text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#334155] dark:text-slate-400 font-medium">Thiết bị:</span>
            <span className="font-bold text-[#083578] dark:text-sky-300">{machineName}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#334155] dark:text-slate-400 font-medium">Phụ trách:</span>
            <span className="font-semibold text-[#0F172A] dark:text-slate-200">{supervisor}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#334155] dark:text-slate-400 font-medium">Số lượng lịch:</span>
            <span className="font-mono font-bold tabular-nums text-[#0F172A] dark:text-slate-200">
              {totalRows} khung giờ · Đã chọn {checkedCount}/{effectiveTotalSlots} ca
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={exporting}
            onClick={onDownloadPdf}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg bg-[#0D4EA6] hover:bg-[#083578] text-white transition-colors cursor-pointer disabled:opacity-60"
          >
            <FileDown className="w-4 h-4 shrink-0" />
            <span>{exporting ? 'Đang tạo PDF...' : 'Tải file PDF (A4)'}</span>
          </button>

          <button
            type="button"
            disabled={exporting}
            onClick={onDirectPrint}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg border border-[#B6CBE3] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#0F172A] dark:text-slate-200 hover:bg-[#DCEBFF] dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-60"
          >
            <Printer className="w-4 h-4 text-[#0D4EA6] dark:text-sky-400 shrink-0" />
            <span>In trực tiếp</span>
          </button>
        </div>

        <p className="text-[11.5px] leading-relaxed text-[#334155] dark:text-slate-400">
          Khuyến nghị dùng <strong>Tải file PDF (A4)</strong> để lưu hoặc in bảng lịch đầy đủ 2 trang A4
          khi chạy trong cửa sổ nhúng trình duyệt.
        </p>
      </div>
    </ModalShell>
  );
};

