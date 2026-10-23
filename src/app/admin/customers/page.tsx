'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  X,
  UserCheck,
  Phone,
  Mail,
  MapPin,
  ShoppingBag,
  Download,
  Filter,
  MessageSquare,
  Sparkles,
  Wallet,
  ArrowRight,
  RefreshCw,
  Coins,
  ShieldAlert,
  Users
} from 'lucide-react';
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  CustomerSummary
} from '@/lib/actions/customer.actions';
import ErrorBoundary from '@/components/ErrorBoundary';

const CUSTOMER_TYPES = ['Semua Tipe', 'Retail', 'Grosir', 'Semi-Grosir'];

const TYPE_BADGE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  Retail: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100' },
  Grosir: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100' },
  'Semi-Grosir': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
};

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  type: 'Retail',
  creditLimit: 0,
  notes: ''
};

export default function AdminCustomers() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('Semua Tipe');
  const [sortBy, setSortBy] = useState<'latest' | 'name' | 'spent' | 'points' | 'orders'>('latest');

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCustomers();
      setCustomers(data);
    } catch (err) {
      console.error('Failed to load customers:', err);
      notify.admin.error('Gagal memuat data pelanggan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Search & Filter & Sort
  const filtered = useMemo(() => {
    let result = customers.filter((c) => {
      const query = search.toLowerCase();
      const matchSearch =
        c.name.toLowerCase().includes(query) ||
        (c.phone || '').includes(query) ||
        (c.email || '').toLowerCase().includes(query) ||
        (c.address || '').toLowerCase().includes(query);

      const matchType =
        typeFilter === 'Semua Tipe' ||
        c.type.toLowerCase() === typeFilter.toLowerCase();

      return matchSearch && matchType;
    });

    if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'spent') {
      result.sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
    } else if (sortBy === 'points') {
      result.sort((a, b) => (b.points || 0) - (a.points || 0));
    } else if (sortBy === 'orders') {
      result.sort((a, b) => (b.totalOrders || 0) - (a.totalOrders || 0));
    } else {
      // Latest
      result.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    return result;
  }, [customers, search, typeFilter, sortBy]);

  // Mini KPI Stats
  const totalCustomers = customers.length;
  const wholesaleCustomers = customers.filter(
    (c) => c.type === 'Grosir' || c.type === 'Semi-Grosir'
  ).length;
  const totalCirculatingPoints = customers.reduce((acc, c) => acc + (c.points || 0), 0);
  const totalWalletDeposit = customers.reduce((acc, c) => acc + (c.walletBalance || 0), 0);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (c: CustomerSummary) => {
    setEditId(c.id);
    setForm({
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      type: c.type || 'Retail',
      creditLimit: c.creditLimit || 0,
      notes: c.notes || ''
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      notify.error('Nama pelanggan wajib diisi');
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      type: form.type,
      creditLimit: Number(form.creditLimit || 0),
      notes: form.notes.trim() || undefined
    };

    const result = editId
      ? await updateCustomer(editId, payload)
      : await createCustomer(payload);

    if (result.success) {
      notify.success(editId ? 'Pelanggan berhasil diperbarui' : 'Pelanggan berhasil ditambahkan');
      setModalOpen(false);
      await load();
    } else {
      notify.error(result.error || 'Gagal menyimpan pelanggan');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const result = await deleteCustomer(id);
    if (result.success) {
      notify.success('Pelanggan berhasil dihapus');
      setDeleteId(null);
      await load();
    } else {
      notify.error(result.error || 'Gagal menghapus');
    }
  };

  const handleExportExcel = () => {
    try {
      const data = customers.map((c, idx) => ({
        No: idx + 1,
        'Nama Pelanggan': c.name,
        'Tipe Member': c.type,
        'No Telepon/WA': c.phone || '-',
        Email: c.email || '-',
        Alamat: c.address || '-',
        'Total Transaksi': c.totalOrders,
        'Total Belanja (IDR)': c.totalSpent,
        'Poin Loyalitas': c.points,
        'Saldo Dompet (IDR)': c.walletBalance,
        'Limit Kredit': c.creditLimit || 0,
        Catatan: c.notes || '-'
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Pelanggan');
      XLSX.writeFile(
        workbook,
        `Data_Pelanggan_AtayaToko_${new Date().toISOString().split('T')[0]}.xlsx`
      );
      notify.success('Data pelanggan berhasil diekspor ke Excel!');
    } catch {
      notify.error('Gagal mengekspor data');
    }
  };

  const formatWaLink = (phone?: string | null, name?: string) => {
    if (!phone) return null;
    const cleaned = phone.replace(/[^0-9]/g, '');
    if (!cleaned) return null;
    const international = cleaned.startsWith('0')
      ? '62' + cleaned.slice(1)
      : cleaned.startsWith('62')
      ? cleaned
      : '62' + cleaned;
    const text = encodeURIComponent(
      `Halo Kak ${name || 'Pelanggan'}, terima kasih telah menjadi pelanggan setia AtayaToko. Ada yang bisa kami bantu hari ini?`
    );
    return `https://wa.me/${international}?text=${text}`;
  };

  return (
    <ErrorBoundary>
      <Toaster position="top-right" />
      <div className="space-y-5 md:space-y-6 max-w-7xl mx-auto">
        {/* HEADER SECTION */}
        <div className="bg-white rounded-2xl md:rounded-3xl p-4 sm:p-6 border border-gray-100 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                <Users size={12} />
                CRM & Manajemen Pelanggan
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
              Pelanggan & Member
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
              Kelola data pembeli, keanggotaan grosir, poin loyalitas, serta limit tempo toko.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportExcel}
              disabled={customers.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs sm:text-sm font-bold shadow-2xs transition-all active:scale-95 disabled:opacity-50"
              title="Unduh Kontak Excel"
            >
              <Download size={15} />
              <span className="hidden sm:inline">Ekspor Excel</span>
            </button>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-95"
            >
              <Plus size={16} />
              <span>Tambah Pelanggan</span>
            </button>
          </div>
        </div>

        {/* MINI KPI STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-100 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Users size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider truncate">
                Total Pelanggan
              </p>
              <p className="text-base sm:text-xl font-black text-gray-900 tracking-tight">
                {totalCustomers} <span className="text-xs font-semibold text-gray-400">Member</span>
              </p>
            </div>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-100 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <UserCheck size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider truncate">
                Mitra Grosir
              </p>
              <p className="text-base sm:text-xl font-black text-gray-900 tracking-tight">
                {wholesaleCustomers} <span className="text-xs font-semibold text-gray-400">Toko</span>
              </p>
            </div>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-100 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Coins size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider truncate">
                Poin Beredar
              </p>
              <p className="text-base sm:text-xl font-black text-gray-900 tracking-tight">
                {totalCirculatingPoints.toLocaleString('id-ID')}{' '}
                <span className="text-xs font-semibold text-gray-400">Pts</span>
              </p>
            </div>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-100 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Wallet size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider truncate">
                Total Saldo Dompet
              </p>
              <p className="text-base sm:text-xl font-black text-gray-900 tracking-tight truncate">
                Rp{totalWalletDeposit.toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        </div>

        {/* SEARCH & FILTER CONTROLS */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-2xs p-3 sm:p-4 space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama pelanggan, nomor telepon, alamat..."
                className="w-full pl-9 pr-4 py-2.5 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all placeholder:text-gray-400"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Sort Select */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold text-gray-400 hidden sm:inline">Urutkan:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-gray-700 cursor-pointer"
              >
                <option value="latest">Terbaru Terdaftar</option>
                <option value="name">Nama (A - Z)</option>
                <option value="spent">Total Belanja Tertinggi</option>
                <option value="points">Poin Terbanyak</option>
                <option value="orders">Pesanan Terbanyak</option>
              </select>
            </div>
          </div>

          {/* Filter Tipe Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-1 border-t border-gray-100">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Filter size={11} /> Tipe:
            </span>
            {CUSTOMER_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
                  typeFilter === t
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* CUSTOMER CARDS GRID */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100">
            <RefreshCw size={28} className="animate-spin text-emerald-600 mb-3" />
            <p className="text-xs font-bold text-gray-500">Memuat data pelanggan...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-10 sm:p-14 text-center">
            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-gray-400">
              <Users size={28} />
            </div>
            <h3 className="text-base font-bold text-gray-900">
              {search || typeFilter !== 'Semua Tipe'
                ? 'Tidak ada pelanggan yang cocok'
                : 'Belum ada data pelanggan'}
            </h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              {search || typeFilter !== 'Semua Tipe'
                ? 'Coba ganti kata kunci pencarian atau ubah filter tipe member di atas.'
                : 'Mulai catat pelanggan toko Anda untuk memudahkan program loyalitas dan nota belanja.'}
            </p>
            {search || typeFilter !== 'Semua Tipe' ? (
              <button
                onClick={() => {
                  setSearch('');
                  setTypeFilter('Semua Tipe');
                }}
                className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors"
              >
                Reset Filter
              </button>
            ) : (
              <button
                onClick={openAdd}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
              >
                <Plus size={14} /> Tambah Pelanggan Pertama
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {filtered.map((c) => {
              const waUrl = formatWaLink(c.phone, c.name);
              const typeStyle = TYPE_BADGE_STYLE[c.type] || TYPE_BADGE_STYLE.Retail;

              return (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-2xs hover:shadow-md hover:border-emerald-200 transition-all p-4 sm:p-5 flex flex-col justify-between group"
                >
                  <div>
                    {/* Top Row: Avatar Initial, Name, Type, & Accessible Action Buttons */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-2xs">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-900 text-sm leading-tight truncate">
                            {c.name}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span
                              className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}
                            >
                              {c.type}
                            </span>
                            {c.creditLimit > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100">
                                <ShieldAlert size={10} />
                                Limit: Rp{(c.creditLimit / 1000).toLocaleString('id-ID')}k
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons: ALWAYS VISIBLE & EASY TO TAP ON PHONES */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Edit Pelanggan"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteId(c.id)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Hapus Pelanggan"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* CONTACT & ADDRESS */}
                    <div className="space-y-1.5 text-xs text-gray-600 my-3">
                      {c.phone ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 w-12 shrink-0">
                            Telepon
                          </span>
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <a
                              href={`tel:${c.phone}`}
                              className="text-gray-800 hover:text-emerald-700 font-medium flex items-center gap-1 hover:underline"
                            >
                              <Phone size={11} className="text-gray-400" />
                              <span>{c.phone}</span>
                            </a>
                            {waUrl && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                                title="Chat WhatsApp Pelanggan"
                              >
                                <MessageSquare size={10} />
                                WA
                              </a>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-gray-400">
                          <span className="text-[10px] font-bold uppercase tracking-wider w-12 shrink-0">
                            Telepon
                          </span>
                          <span className="text-[11px] italic">Tidak ada nomor</span>
                        </div>
                      )}

                      {c.email && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 w-12 shrink-0">
                            Email
                          </span>
                          <a
                            href={`mailto:${c.email}`}
                            className="text-gray-700 hover:text-emerald-600 truncate hover:underline"
                          >
                            {c.email}
                          </a>
                        </div>
                      )}

                      {c.address && (
                        <div className="flex items-start gap-2 pt-0.5">
                          <MapPin size={12} className="text-gray-400 shrink-0 mt-0.5" />
                          <span className="text-gray-500 text-[11px] line-clamp-1 leading-snug">
                            {c.address}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* LOYALTY & BALANCE STRIP */}
                    <div className="bg-gray-50/80 rounded-xl p-2.5 my-3 border border-gray-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <Sparkles size={13} className="text-amber-500 shrink-0" />
                        <div>
                          <span className="text-[10px] font-semibold text-gray-400 block leading-none">
                            Poin Member
                          </span>
                          <span className="font-extrabold text-gray-900 text-xs">
                            {c.points.toLocaleString('id-ID')} pts
                          </span>
                        </div>
                      </div>

                      <div className="h-6 w-px bg-gray-200" />

                      <div className="flex items-center gap-1.5">
                        <Wallet size={13} className="text-emerald-600 shrink-0" />
                        <div>
                          <span className="text-[10px] font-semibold text-gray-400 block leading-none">
                            Saldo Deposit
                          </span>
                          <span className="font-extrabold text-gray-900 text-xs">
                            Rp{c.walletBalance.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* BOTTOM FOOTER: ORDERS & LINK */}
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2 mt-1">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <ShoppingBag size={12} className="text-gray-400" />
                      <span className="font-bold text-gray-800">{c.totalOrders}</span>
                      <span className="text-[11px] text-gray-400">Order</span>
                      {c.totalSpent > 0 && (
                        <span className="text-[11px] font-semibold text-gray-500 ml-1">
                          (Rp{(c.totalSpent / 1000).toLocaleString('id-ID')}k)
                        </span>
                      )}
                    </div>

                    <Link
                      href={`/admin/orders?search=${encodeURIComponent(c.name)}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline transition-colors group/link"
                    >
                      <span>Riwayat Order</span>
                      <ArrowRight
                        size={12}
                        className="group-hover/link:translate-x-0.5 transition-transform"
                      />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ADD / EDIT MODAL */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
              onClick={() => setModalOpen(false)}
            />
            <div className="relative bg-white rounded-2xl md:rounded-3xl shadow-xl w-full max-w-lg p-5 sm:p-6 my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                    <Users size={18} />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-gray-900">
                      {editId ? 'Edit Data Pelanggan' : 'Tambah Pelanggan Baru'}
                    </h2>
                    <p className="text-xs text-gray-400">
                      Lengkapi identitas, kontak, dan pengaturan tipe member
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                {/* 1. Identitas Pelanggan */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Nama Lengkap Pelanggan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Contoh: Ibu Rina / Toko Berkah"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      No. Telepon / WhatsApp
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="08xxxxxxxxxx"
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="pelanggan@email.com"
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Alamat Pengiriman / Domisili
                  </label>
                  <textarea
                    rows={2}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Jl. Merdeka No. 12..."
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50"
                  />
                </div>

                {/* 2. Pengaturan Member & Finansial */}
                <div className="pt-2 border-t border-gray-100">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-2">
                    Pengaturan Member & Kredit
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Tipe Pelanggan
                      </label>
                      <select
                        value={form.type}
                        onChange={(e) => setForm({ ...form, type: e.target.value })}
                        className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50"
                      >
                        <option value="Retail">Retail (Eceran)</option>
                        <option value="Grosir">Grosir (Kulakan)</option>
                        <option value="Semi-Grosir">Semi-Grosir</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Limit Kredit / Bon (IDR)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={form.creditLimit}
                        onChange={(e) =>
                          setForm({ ...form, creditLimit: Number(e.target.value) })
                        }
                        placeholder="0 (jika harus tunai)"
                        className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Catatan Khusus */}
                <div className="pt-1">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Catatan Khusus (Opsional)
                  </label>
                  <input
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Preferensi pengiriman, jam buka toko langganan, dll."
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50"
                  />
                </div>

                <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs sm:text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Tambahkan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* DELETE CONFIRM MODAL */}
        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
              onClick={() => setDeleteId(null)}
            />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Trash2 size={22} />
              </div>
              <h3 className="text-base font-black text-gray-900 mb-1">Hapus Pelanggan?</h3>
              <p className="text-xs text-gray-500 mb-5">
                Data pelanggan akan dihapus dari daftar master. Riwayat transaksi sebelumnya tetap aman di sistem.
              </p>
              <div className="flex gap-2.5">
                <button
                  onClick={() => setDeleteId(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleDelete(deleteId)}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-2xs"
                >
                  Ya, Hapus
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
