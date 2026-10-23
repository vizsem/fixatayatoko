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
  Phone,
  MapPin,
  Mail,
  Search,
  X,
  Building2,
  Receipt,
  Tag,
  CreditCard,
  Copy,
  Check,
  Download,
  ExternalLink,
  MessageSquare,
  Clock,
  ArrowRight,
  Filter,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  SupplierEntity
} from '@/lib/actions/supplier.actions';
import ErrorBoundary from '@/components/ErrorBoundary';

const CATEGORY_OPTIONS = [
  'Semua Kategori',
  'Sembako & Pangan',
  'Makanan & Minuman',
  'Bahan Baku',
  'Kemasan & Plastik',
  'Perlengkapan Toko',
  'Lainnya'
];

const PAYMENT_TERMS_OPTIONS = [
  'COD (Tunai saat datang)',
  'Tempo 7 Hari',
  'Tempo 14 Hari',
  'Tempo 30 Hari',
  'Konsinyasi (Titip Jual)',
  'Transfer Dimuka (Pre-Order)'
];

const emptyForm = {
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  category: 'Sembako & Pangan',
  bankName: 'BCA',
  bankAccount: '',
  bankAccountName: '',
  paymentTerms: 'COD (Tunai saat datang)',
  notes: ''
};

export default function AdminSuppliers() {
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<SupplierEntity[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua Kategori');
  const [sortBy, setSortBy] = useState<'latest' | 'name' | 'orders'>('latest');

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSuppliers();
      setSuppliers(data);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
      notify.admin.error('Gagal memuat data supplier');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Search & Filter & Sort Logic
  const filtered = useMemo(() => {
    let result = suppliers.filter((s) => {
      const query = search.toLowerCase();
      const matchSearch =
        s.name.toLowerCase().includes(query) ||
        (s.contactPerson || '').toLowerCase().includes(query) ||
        (s.phone || '').includes(query) ||
        (s.email || '').toLowerCase().includes(query) ||
        (s.bankAccount || '').includes(query) ||
        (s.address || '').toLowerCase().includes(query);

      const matchCategory =
        selectedCategory === 'Semua Kategori' ||
        (s.category || 'Lainnya') === selectedCategory;

      return matchSearch && matchCategory;
    });

    if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'orders') {
      result.sort((a, b) => (b._count?.purchaseOrders || 0) - (a._count?.purchaseOrders || 0));
    } else {
      // Latest
      result.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    return result;
  }, [suppliers, search, selectedCategory, sortBy]);

  // Mini KPI Stats
  const totalSuppliers = suppliers.length;
  const activeSuppliers = suppliers.filter((s) => (s._count?.purchaseOrders || 0) > 0).length;
  const totalOrdersCount = suppliers.reduce((acc, s) => acc + (s._count?.purchaseOrders || 0), 0);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (s: SupplierEntity) => {
    setEditId(s.id);
    setForm({
      name: s.name,
      contactPerson: s.contactPerson || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      category: s.category || 'Sembako & Pangan',
      bankName: s.bankName || 'BCA',
      bankAccount: s.bankAccount || '',
      bankAccountName: s.bankAccountName || '',
      paymentTerms: s.paymentTerms || 'COD (Tunai saat datang)',
      notes: s.notes || ''
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      notify.error('Nama supplier wajib diisi');
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      contactPerson: form.contactPerson.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      category: form.category || undefined,
      bankName: form.bankName.trim() || undefined,
      bankAccount: form.bankAccount.trim() || undefined,
      bankAccountName: form.bankAccountName.trim() || undefined,
      paymentTerms: form.paymentTerms || undefined,
      notes: form.notes.trim() || undefined
    };

    const result = editId
      ? await updateSupplier(editId, payload)
      : await createSupplier(payload);

    if (result.success) {
      notify.success(editId ? 'Supplier berhasil diperbarui' : 'Supplier berhasil ditambahkan');
      setModalOpen(false);
      await load();
    } else {
      notify.error(result.error || 'Gagal menyimpan supplier');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const result = await deleteSupplier(id);
    if (result.success) {
      notify.success('Supplier berhasil dihapus');
      setDeleteId(null);
      await load();
    } else {
      notify.error(result.error || 'Gagal menghapus supplier');
    }
  };

  const handleCopyToClipboard = (text: string, id: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      notify.success('Nomor rekening berhasil disalin!');
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleExportExcel = () => {
    try {
      const data = suppliers.map((s, idx) => ({
        No: idx + 1,
        'Nama Supplier': s.name,
        'Kontak Person (PIC)': s.contactPerson || '-',
        'No Telepon/WA': s.phone || '-',
        Email: s.email || '-',
        Alamat: s.address || '-',
        Kategori: s.category || 'Umum',
        'Termin Pembayaran': s.paymentTerms || '-',
        'Bank': s.bankName || '-',
        'No Rekening': s.bankAccount || '-',
        'Atas Nama Rekening': s.bankAccountName || '-',
        'Total Riwayat PO': s._count?.purchaseOrders || 0,
        Catatan: s.notes || '-'
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Daftar Supplier');
      XLSX.writeFile(
        workbook,
        `Data_Supplier_AtayaToko_${new Date().toISOString().split('T')[0]}.xlsx`
      );
      notify.success('Data supplier berhasil diekspor ke Excel!');
    } catch {
      notify.error('Gagal mengekspor data supplier');
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
      `Halo ${name || 'Supplier'}, kami dari AtayaToko ingin menanyakan informasi stok dan pemesanan barang.`
    );
    return `https://wa.me/${international}?text=${text}`;
  };

  return (
    <ErrorBoundary>
      <Toaster position="top-right" />
      <div className="space-y-5 md:space-y-6 max-w-7xl mx-auto">
        {/* HEADER SECTION */}
        <div className="bg-white rounded-2xl md:rounded-3xl p-4 sm:p-6 border border-gray-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                <Building2 size={12} />
                Manajemen Rantai Pasok (Supply Chain)
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
              Supplier & Pemasok
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
              Direktori mitra pemasok barang, PIC, rekening transfer, dan riwayat pesanan stok toko.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportExcel}
              disabled={suppliers.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs sm:text-sm font-bold shadow-2xs transition-all active:scale-95 disabled:opacity-50"
              title="Unduh Data Excel"
            >
              <Download size={15} />
              <span className="hidden sm:inline">Ekspor</span>
            </button>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-95"
            >
              <Plus size={16} />
              <span>Tambah Supplier</span>
            </button>
          </div>
        </div>

        {/* MINI KPI STATS */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-100 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Building2 size={18} className="sm:size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider truncate">
                Total Pemasok
              </p>
              <p className="text-base sm:text-xl font-black text-gray-900 tracking-tight">
                {totalSuppliers} <span className="text-xs font-semibold text-gray-400">Mitra</span>
              </p>
            </div>
          </div>

          <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-100 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Receipt size={18} className="sm:size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider truncate">
                Supplier Aktif PO
              </p>
              <p className="text-base sm:text-xl font-black text-gray-900 tracking-tight">
                {activeSuppliers} <span className="text-xs font-semibold text-gray-400">Aktif</span>
              </p>
            </div>
          </div>

          <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-100 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
              <CreditCard size={18} className="sm:size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider truncate">
                Total Riwayat PO
              </p>
              <p className="text-base sm:text-xl font-black text-gray-900 tracking-tight">
                {totalOrdersCount} <span className="text-xs font-semibold text-gray-400">Order</span>
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
                placeholder="Cari nama supplier, PIC, no telepon, no rekening..."
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
                <option value="latest">Terbaru Ditambahkan</option>
                <option value="name">Nama (A - Z)</option>
                <option value="orders">Riwayat PO Terbanyak</option>
              </select>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-1 border-t border-gray-100">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Filter size={11} /> Kategori:
            </span>
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* SUPPLIERS LIST */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100">
            <RefreshCw size={28} className="animate-spin text-emerald-600 mb-3" />
            <p className="text-xs font-bold text-gray-500">Memuat data supplier...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-10 sm:p-14 text-center">
            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-gray-400">
              <Building2 size={28} />
            </div>
            <h3 className="text-base font-bold text-gray-900">
              {search || selectedCategory !== 'Semua Kategori'
                ? 'Tidak ada supplier yang sesuai filter'
                : 'Belum ada data supplier'}
            </h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              {search || selectedCategory !== 'Semua Kategori'
                ? 'Coba ganti kata kunci pencarian atau reset filter kategori di atas.'
                : 'Daftarkan mitra distributor atau supplier toko Anda untuk kemudahan restock barang.'}
            </p>
            {search || selectedCategory !== 'Semua Kategori' ? (
              <button
                onClick={() => {
                  setSearch('');
                  setSelectedCategory('Semua Kategori');
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
                <Plus size={14} /> Tambah Supplier Pertama
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {filtered.map((s) => {
              const waUrl = formatWaLink(s.phone, s.name);
              const hasBank = Boolean(s.bankAccount);

              return (
                <div
                  key={s.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-2xs hover:shadow-md hover:border-emerald-200 transition-all p-4 sm:p-5 flex flex-col justify-between group"
                >
                  <div>
                    {/* Top Row: Icon, Name & Always-visible Action Buttons */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0 font-black text-sm">
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-900 text-sm leading-tight truncate">
                            {s.name}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
                              {s.category || 'Umum'}
                            </span>
                            {s.paymentTerms && (
                              <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                                {s.paymentTerms.split(' ')[0]}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons: ALWAYS VISIBLE & ACCESSIBLE ON MOBILE */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEdit(s)}
                          className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Edit Supplier"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteId(s.id)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Hapus Supplier"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* PIC & CONTACT INFO */}
                    <div className="space-y-1.5 text-xs text-gray-600 my-3">
                      {s.contactPerson && (
                        <div className="flex items-center gap-2 font-medium">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 w-12 shrink-0">
                            PIC
                          </span>
                          <span className="text-gray-800 font-semibold truncate">
                            {s.contactPerson}
                          </span>
                        </div>
                      )}

                      {/* Phone / WhatsApp with Direct Links */}
                      {s.phone ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 w-12 shrink-0">
                            Kontak
                          </span>
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <a
                              href={`tel:${s.phone}`}
                              className="text-gray-800 hover:text-emerald-700 font-medium flex items-center gap-1 hover:underline"
                            >
                              <Phone size={11} className="text-gray-400" />
                              <span>{s.phone}</span>
                            </a>
                            {waUrl && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                                title="Chat WhatsApp"
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
                            Kontak
                          </span>
                          <span className="text-[11px] italic">Belum ada no telepon</span>
                        </div>
                      )}

                      {s.email && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 w-12 shrink-0">
                            Email
                          </span>
                          <a
                            href={`mailto:${s.email}`}
                            className="text-gray-700 hover:text-emerald-600 truncate hover:underline"
                          >
                            {s.email}
                          </a>
                        </div>
                      )}

                      {s.address && (
                        <div className="flex items-start gap-2 pt-0.5">
                          <MapPin size={12} className="text-gray-400 shrink-0 mt-0.5" />
                          <span className="text-gray-500 text-[11px] line-clamp-1 leading-snug">
                            {s.address}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* BANK ACCOUNT CARD (FOR QUICK TRANSFER) */}
                    {hasBank && (
                      <div className="bg-gray-50 rounded-xl p-2.5 my-3 border border-gray-100 text-xs">
                        <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                          <span className="font-bold flex items-center gap-1 text-gray-600">
                            <CreditCard size={12} />
                            {s.bankName || 'Bank'}: {s.bankAccount}
                          </span>
                          <button
                            onClick={() =>
                              handleCopyToClipboard(s.bankAccount || '', s.id)
                            }
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 transition-colors"
                            title="Salin No Rekening"
                          >
                            {copiedId === s.id ? (
                              <>
                                <Check size={10} className="text-emerald-600" />
                                <span className="text-emerald-600">Disalin</span>
                              </>
                            ) : (
                              <>
                                <Copy size={10} />
                                <span>Salin</span>
                              </>
                            )}
                          </button>
                        </div>
                        {s.bankAccountName && (
                          <p className="text-[11px] text-gray-400 truncate">
                            a.n. {s.bankAccountName}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* BOTTOM ACTION & PO STATS */}
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2 mt-2">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Receipt size={13} className="text-gray-400" />
                      <span className="font-bold text-gray-800">
                        {s._count?.purchaseOrders || 0}
                      </span>
                      <span className="text-[11px] text-gray-400">PO dibuat</span>
                    </div>

                    <Link
                      href={`/admin/purchases?supplierId=${s.id}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline transition-colors group/link"
                    >
                      <span>Order Stok</span>
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
                    <Building2 size={18} />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-gray-900">
                      {editId ? 'Edit Data Supplier' : 'Tambah Supplier Baru'}
                    </h2>
                    <p className="text-xs text-gray-400">
                      Lengkapi identitas mitra distributor & pembayaran
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
                {/* 1. INFORMASI UMUM */}
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-2 flex items-center gap-1">
                    <Building2 size={12} /> 1. Identitas Perusahaan
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Nama Supplier / Distributor <span className="text-rose-500">*</span>
                      </label>
                      <input
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Contoh: PT. Sumber Makmur Pangan"
                        className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Nama PIC / Sales
                        </label>
                        <input
                          value={form.contactPerson}
                          onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                          placeholder="Nama penanggung jawab"
                          className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Kategori Pasokan
                        </label>
                        <select
                          value={form.category}
                          onChange={(e) => setForm({ ...form, category: e.target.value })}
                          className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50"
                        >
                          {CATEGORY_OPTIONS.filter((c) => c !== 'Semua Kategori').map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. KONTAK & ALAMAT */}
                <div className="pt-2 border-t border-gray-100">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-2 flex items-center gap-1">
                    <Phone size={12} /> 2. Kontak & Alamat
                  </h4>
                  <div className="space-y-3">
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
                          placeholder="sales@supplier.com"
                          className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Alamat Gudang / Kantor
                      </label>
                      <textarea
                        rows={2}
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        placeholder="Jl. Pergudangan No. 8..."
                        className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. REKENING & TERMIN PEMBAYARAN */}
                <div className="pt-2 border-t border-gray-100">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-2 flex items-center gap-1">
                    <CreditCard size={12} /> 3. Rekening & Termin Pembayaran
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Termin Pembayaran (Terms)
                      </label>
                      <select
                        value={form.paymentTerms}
                        onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                        className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50"
                      >
                        {PAYMENT_TERMS_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Bank</label>
                        <input
                          value={form.bankName}
                          onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                          placeholder="BCA / Mandiri / BRI"
                          className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Nomor Rekening
                        </label>
                        <input
                          value={form.bankAccount}
                          onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
                          placeholder="Contoh: 1234567890"
                          className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Atas Nama Rekening
                      </label>
                      <input
                        value={form.bankAccountName}
                        onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })}
                        placeholder="Nama pemilik rekening sesuai buku tabungan"
                        className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. CATATAN TAMBAHAN */}
                <div className="pt-2 border-t border-gray-100">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Catatan Tambahan (Opsional)
                  </label>
                  <input
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Minimal order, jadwal pengiriman rutin, dll."
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
              <h3 className="text-base font-black text-gray-900 mb-1">Hapus Supplier?</h3>
              <p className="text-xs text-gray-500 mb-5">
                Data pemasok akan dihapus dari daftar. Riwayat transaksi PO lama akan tetap tercatat di sistem.
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
