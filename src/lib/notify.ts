import toast, { ToastOptions } from 'react-hot-toast';

const base: ToastOptions = { position: 'top-center', style: { borderRadius: '1rem', padding: '12px', fontWeight: 800, fontSize: '12px', letterSpacing: '0.08em' } };
const adminBase: ToastOptions = { position: 'top-right', style: { borderRadius: '1rem', padding: '12px', fontWeight: 900, fontSize: '11px', letterSpacing: '0.1em', background: '#fff', border: '1px solid #eee' } };
const userBase: ToastOptions = { position: 'top-center', style: { borderRadius: '1rem', padding: '12px', fontWeight: 800, fontSize: '12px', letterSpacing: '0.08em', background: '#fff', border: '1px solid #eee' } };

// Default warna dan ikon per tipe untuk admin
const adminTheme = {
  success: { icon: '✅', style: { color: '#059669', borderColor: '#10b981' } },
  error: { icon: '❌', style: { color: '#dc2626', borderColor: '#ef4444' } },
  info: { icon: 'ℹ️', style: { color: '#2563eb', borderColor: '#3b82f6' } },
  loading: { icon: '⏳', style: { color: '#4b5563', borderColor: '#6b7280' } }
};

// Default warna dan ikon per tipe untuk user
const userTheme = {
  success: { icon: '✅', style: { color: '#059669', borderColor: '#10b981' } },
  error: { icon: '❌', style: { color: '#dc2626', borderColor: '#ef4444' } },
  info: { icon: 'ℹ️', style: { color: '#2563eb', borderColor: '#3b82f6' } },
  loading: { icon: '⏳', style: { color: '#4b5563', borderColor: '#6b7280' } }
};

const merge = (opts?: ToastOptions): ToastOptions => ({ ...base, ...(opts || {}) });
const mergeAdmin = (type: keyof typeof adminTheme, opts?: ToastOptions): ToastOptions => ({
  ...adminBase,
  ...adminTheme[type],
  style: { ...adminBase.style, ...adminTheme[type].style, ...opts?.style },
  ...opts
});
const mergeUser = (type: keyof typeof userTheme, opts?: ToastOptions): ToastOptions => ({
  ...userBase,
  ...userTheme[type],
  style: { ...userBase.style, ...userTheme[type].style, ...opts?.style },
  ...opts
});

type ToastContent = Parameters<typeof toast>[0];

export const notify = {
  success: (message: string, opts?: ToastOptions) => toast.success(message, merge(opts)),
  error: (message: string, opts?: ToastOptions) => toast.error(message, merge(opts)),
  info: (message: string, opts?: ToastOptions) => toast(message, merge(opts)),
  loading: (message: string, opts?: ToastOptions) => toast.loading(message, merge(opts)),
  aksesDitolakAdmin: (opts?: ToastOptions) => toast.error('Akses ditolak! Anda bukan admin.', merge(opts)),
  berhasilDisimpan: (entity?: string, opts?: ToastOptions) =>
    toast.success(`${entity ? entity + ' ' : ''}berhasil disimpan!`.trim(), merge(opts)),
  gagalDisimpan: (entity?: string, opts?: ToastOptions) =>
    toast.error(`Gagal menyimpan${entity ? ' ' + entity : ''}.`, merge(opts)),
  dismiss: (id?: string) => toast.dismiss(id),
  custom: (content: ToastContent, opts?: ToastOptions) => toast(content, merge(opts)),
  admin: {
    success: (message: string, opts?: ToastOptions) => toast.success(message, mergeAdmin('success', opts)),
    error: (message: string, opts?: ToastOptions) => toast.error(message, mergeAdmin('error', opts)),
    info: (message: string, opts?: ToastOptions) => toast(message, mergeAdmin('info', opts)),
    loading: (message: string, opts?: ToastOptions) => toast.loading(message, mergeAdmin('loading', opts)),
    custom: (content: ToastContent, opts?: ToastOptions) => toast(content, mergeAdmin('info', opts)),
  },
  user: {
    success: (message: string, opts?: ToastOptions) => toast.success(message, mergeUser('success', opts)),
    error: (message: string, opts?: ToastOptions) => toast.error(message, mergeUser('error', opts)),
    info: (message: string, opts?: ToastOptions) => toast(message, mergeUser('info', opts)),
    loading: (message: string, opts?: ToastOptions) => toast.loading(message, mergeUser('loading', opts)),
    custom: (content: ToastContent, opts?: ToastOptions) => toast(content, mergeUser('info', opts)),
  },
};

export default notify;
