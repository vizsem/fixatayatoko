'use client';

import { useState, useEffect, useMemo } from 'react';
import { OperationalExpense } from '@/lib/types';
import { Plus, Search, Download, Receipt, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import notify from '@/lib/notify';
import * as XLSX from 'xlsx';
import { TableSkeleton } from '@/components/admin/InventorySkeleton';
import * as Sentry from '@sentry/nextjs';

import { ExpensesSummary } from '@/components/admin/expenses/ExpensesSummary';
import { ExpensesTable } from '@/components/admin/expenses/ExpensesTable';
import { getExpenses, deleteExpense } from '@/lib/actions/expense.actions';

const EXPENSE_CATEGORIES = [
  'Listrik',
  'Air',
  'Gaji',
  'Packing',
  'Bensin',
  'Sewa Tempat',
  'Internet/WiFi',
  'Perawatan/Servis',
  'Konsumsi',
  'Pajak',
  'Lainnya',
];

const PAYMENT_METHODS = ['Kas Tunai', 'Transfer Bank', 'QRIS', 'Lainnya'];
const ITEMS_PER_PAGE = 20;

function parseExpenseDate(val: any): Date {
  if (!val) return new Date(0);
  if (typeof val?.toDate === 'function') return val.toDate();
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

export default function OperationalExpensesPage() {
  const [expenses, setExpenses] = useState<OperationalExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Semua');
  const [paymentFilter, setPaymentFilter] = useState('Semua');
  const [dateFilter, setDateFilter] = useState('bulan-ini');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchExpenses = async () => {
      setLoading(true);
      try {
        const data = await getExpenses();
        setExpenses(data as OperationalExpense[]);
      } catch (error) {
        Sentry.captureException(error);
        notify.error('Gagal memuat data biaya operasional');
      } finally {
        setLoading(false);
      }
    };
    fetchExpenses();
  }, []);

  const allCategories = useMemo(() => {
    const set = new Set(EXPENSE_CATEGORIES);
    expenses.forEach((e) => {
      if (e.category) set.add(e.category);
    });
    return Array.from(set);
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    return expenses.filter((expense) => {
      const q = searchTerm.trim().toLowerCase();
      const description = String(expense.description ?? '');
      const category = String(expense.category ?? '');
      const payment = String(expense.paymentMethod || 'Kas Tunai');

      const matchesSearch =
        !q ||
        description.toLowerCase().includes(q) ||
        category.toLowerCase().includes(q) ||
        payment.toLowerCase().includes(q);

      const matchesCategory = categoryFilter === 'Semua' || category === categoryFilter;
      const matchesPayment = paymentFilter === 'Semua' || payment === paymentFilter;

      const d = parseExpenseDate(expense.date);
      let matchesDate = true;
      if (dateFilter === 'hari-ini') {
        matchesDate = d >= todayStart;
      } else if (dateFilter === '7-hari') {
        matchesDate = d >= sevenDaysAgo;
      } else if (dateFilter === 'bulan-ini') {
        matchesDate = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      } else if (dateFilter === 'bulan-lalu') {
        matchesDate =
          d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
      } else if (dateFilter === 'custom') {
        if (customStart) {
          const s = new Date(customStart);
          s.setHours(0, 0, 0, 0);
          if (d < s) matchesDate = false;
        }
        if (customEnd) {
          const e = new Date(customEnd);
          e.setHours(23, 59, 59, 999);
          if (d > e) matchesDate = false;
        }
      }

      return matchesSearch && matchesCategory && matchesPayment && matchesDate;
    });
  }, [expenses, searchTerm, categoryFilter, paymentFilter, dateFilter, customStart, customEnd]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, paymentFilter, dateFilter, customStart, customEnd]);

  const totalAmount = useMemo(
    () => filteredExpenses.reduce((s, i) => s + Number(i.amount || 0), 0),
    [filteredExpenses]
  );

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    filteredExpenses.forEach((e) => {
      const cat = e.category || 'Lainnya';
      map.set(cat, (map.get(cat) || 0) + Number(e.amount || 0));
    });
    return Array.from(map.entries())
      .map(([name, amount]) => ({
        name,
        amount,
        percent: totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses, totalAmount]);

  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE));
  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredExpenses.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredExpenses, currentPage]);

  const periodLabel = useMemo(() => {
    if (dateFilter === 'hari-ini') return 'Hari Ini';
    if (dateFilter === '7-hari') return '7 Hari Terakhir';
    if (dateFilter === 'bulan-ini') return 'Bulan Ini';
    if (dateFilter === 'bulan-lalu') return 'Bulan Lalu';
    if (dateFilter === 'custom') return `${customStart || '...'} s/d ${customEnd || '...'}`;
    return 'Semua Waktu';
  }, [dateFilter, customStart, customEnd]);

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus catatan pengeluaran ini?')) return;
    try {
      const res = await deleteExpense(id);
      if (!res.success) throw new Error(res.error);
      setExpenses((prev) => prev.filter((item) => item.id !== id));
      notify.success('Catatan pengeluaran dihapus');
    } catch (error) {
      Sentry.captureException(error);
      notify.error('Gagal menghapus data');
    }
  };

  const handleExport = () => {
    const rows = filteredExpenses.map((i) => ({
      Tanggal: parseExpenseDate(i.date).toLocaleDateString('id-ID'),
      Kategori: i.category,
      'Sumber Dana': i.paymentMethod || 'Kas Tunai',
      Keterangan: i.description,
      Nominal: Number(i.amount || 0),
      'Bukti Bayar': i.proofOfPayment || '-',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Biaya Operasional');
    XLSX.writeFile(wb, `Biaya_Operasional_${dateFilter}.xlsx`);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <TableSkeleton rows={8} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-3 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <span className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <Receipt size={22} />
              </span>
              Biaya Operasional
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Pencatatan dan pemantauan pengeluaran operasional toko
            </p>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleExport}
              className="flex-1 sm:flex-none justify-center px-4 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Download size={15} /> Ekspor Excel
            </button>
            <Link
              href="/admin/operational-expenses/add"
              className="flex-1 sm:flex-none justify-center px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Plus size={16} /> Catat Pengeluaran
            </Link>
          </div>
        </div>

        {/* Summary KPI */}
        <ExpensesSummary
          totalAmount={totalAmount}
          totalCount={filteredExpenses.length}
          periodLabel={periodLabel}
          topCategory={categoryBreakdown[0] || null}
        />

        {/* Breakdown Kategori */}
        {categoryBreakdown.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-3.5 mb-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              Ringkasan per Kategori
            </p>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setCategoryFilter('Semua')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 border transition-colors ${
                  categoryFilter === 'Semua'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Semua ({filteredExpenses.length})
              </button>
              {categoryBreakdown.map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() =>
                    setCategoryFilter(categoryFilter === cat.name ? 'Semua' : cat.name)
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 border transition-colors tabular-nums ${
                    categoryFilter === cat.name
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cat.name}: Rp{cat.amount.toLocaleString('id-ID')} ({cat.percent}%)
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="bg-white p-3 rounded-2xl shadow-xs border border-slate-200/80 mb-5 space-y-2.5">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
            <div className="relative flex-1">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                type="text"
                placeholder="Cari keterangan, kategori, atau sumber dana..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:bg-white focus:border-emerald-500 transition-colors"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500"
              >
                <option value="Semua">Semua Kategori</option>
                {allCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500"
              >
                <option value="Semua">Semua Sumber Dana</option>
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm} value={pm}>
                    {pm}
                  </option>
                ))}
              </select>

              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500"
              >
                <option value="hari-ini">Hari Ini</option>
                <option value="7-hari">7 Hari Terakhir</option>
                <option value="bulan-ini">Bulan Ini</option>
                <option value="bulan-lalu">Bulan Lalu</option>
                <option value="semua">Semua Waktu</option>
                <option value="custom">Pilih Tanggal</option>
              </select>
            </div>
          </div>

          {dateFilter === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-500">Rentang:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none"
              />
              <span className="text-xs text-slate-400">s/d</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none"
              />
            </div>
          )}
        </div>

        {/* Table / Mobile Cards */}
        <ExpensesTable expenses={paginatedExpenses} onDelete={handleDelete} />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-200/80 shadow-xs">
            <p className="text-xs text-slate-500 tabular-nums">
              Halaman <span className="font-bold text-slate-800">{currentPage}</span> dari{' '}
              <span className="font-bold text-slate-800">{totalPages}</span> ({filteredExpenses.length}{' '}
              data)
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
