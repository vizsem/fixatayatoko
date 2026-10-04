'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  CreditCard, ArrowDownCircle, ArrowUpCircle, AlertCircle,
  Clock, CheckCircle2, Search, X, Printer, ExternalLink,
  Download, Calendar, Filter, Phone, User, Store
} from 'lucide-react';
import notify from '@/lib/notify';
import { payPurchaseDebt } from '@/lib/actions/purchase.actions';
import * as XLSX from 'xlsx';

export type PurchaseDebtItem = {
  id: string;
  poNumber: string;
  supplierName: string;
  supplierPhone?: string | null;
  totalAmount: number;
  paymentMethod: string;
  createdAt: string;
  dueDate?: string | null;
  notes?: string | null;
  status: string;
};

export type CustomerReceivableItem = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string | null;
  totalAmount: number;
  paymentMethod: string;
  createdAt: string;
  dueDate?: string | null;
  status: string;
  notes?: string | null;
};

interface DebtReceivableTabProps {
  purchasesDebt: PurchaseDebtItem[];
  customersReceivable: CustomerReceivableItem[];
  onRefresh: () => Promise<void>;
}

const idr = (n: number) => `Rp${Math.round(n || 0).toLocaleString('id-ID')}`;

export default function DebtReceivableTab({
  purchasesDebt,
  customersReceivable,
  onRefresh,
}: DebtReceivableTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'payable' | 'receivable'>('all');
  const [search, setSearch] = useState('');
  const [filterDueStatus, setFilterDueStatus] = useState<'all' | 'overdue' | 'upcoming'>('all');

  // Modal Pelunasan Hutang PO
  const [selectedPayable, setSelectedPayable] = useState<PurchaseDebtItem | null>(null);
  const [payMethod, setPayMethod] = useState('CASH');
  const [payNotes, setPayNotes] = useState('');
  const [paying, setPaying] = useState(false);

  const now = new Date();

  // Helper cek jatuh tempo
  const getDueStatus = (dueDateStr?: string | null) => {
    if (!dueDateStr) return { label: 'Tanpa Tempo', color: 'text-gray-500 bg-gray-100', isOverdue: false };
    const due = new Date(dueDateStr);
    due.setHours(23, 59, 59, 999);
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        label: `Lewat ${Math.abs(diffDays)} Hari`,
        color: 'text-red-700 bg-red-100 border border-red-200',
        isOverdue: true
      };
    }
    if (diffDays === 0) {
      return {
        label: 'Jatuh Tempo Hari Ini',
        color: 'text-orange-700 bg-orange-100 border border-orange-200 font-black',
        isOverdue: false
      };
    }
    if (diffDays <= 7) {
      return {
        label: `Sisa ${diffDays} Hari`,
        color: 'text-amber-700 bg-amber-100 border border-amber-200',
        isOverdue: false
      };
    }
    return {
      label: `Tempo: ${due.toLocaleDateString('id-ID')}`,
      color: 'text-blue-700 bg-blue-50 border border-blue-100',
      isOverdue: false
    };
  };

  // Ringkasan
  const totalPayables = useMemo(() => {
    return purchasesDebt.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  }, [purchasesDebt]);

  const totalReceivables = useMemo(() => {
    return customersReceivable.reduce((sum, c) => sum + (c.totalAmount || 0), 0);
  }, [customersReceivable]);

  const overduePayablesCount = useMemo(() => {
    return purchasesDebt.filter(p => getDueStatus(p.dueDate).isOverdue).length;
  }, [purchasesDebt]);

  const overdueReceivablesCount = useMemo(() => {
    return customersReceivable.filter(c => getDueStatus(c.dueDate).isOverdue).length;
  }, [customersReceivable]);

  // Filtered List
  const filteredPayables = useMemo(() => {
    return purchasesDebt.filter(p => {
      const q = search.trim().toLowerCase();
      const matchSearch = !q ||
        p.poNumber.toLowerCase().includes(q) ||
        p.supplierName.toLowerCase().includes(q) ||
        (p.notes || '').toLowerCase().includes(q);

      const dueStatus = getDueStatus(p.dueDate);
      const matchDue = filterDueStatus === 'all'
        || (filterDueStatus === 'overdue' && dueStatus.isOverdue)
        || (filterDueStatus === 'upcoming' && !dueStatus.isOverdue);

      return matchSearch && matchDue;
    });
  }, [purchasesDebt, search, filterDueStatus]);

  const filteredReceivables = useMemo(() => {
    return customersReceivable.filter(c => {
      const q = search.trim().toLowerCase();
      const matchSearch = !q ||
        c.orderNumber.toLowerCase().includes(q) ||
        c.customerName.toLowerCase().includes(q) ||
        (c.customerPhone || '').includes(q) ||
        (c.notes || '').toLowerCase().includes(q);

      const dueStatus = getDueStatus(c.dueDate);
      const matchDue = filterDueStatus === 'all'
        || (filterDueStatus === 'overdue' && dueStatus.isOverdue)
        || (filterDueStatus === 'upcoming' && !dueStatus.isOverdue);

      return matchSearch && matchDue;
    });
  }, [customersReceivable, search, filterDueStatus]);

  // Handle Pelunasan Hutang PO
  const handlePayPO = async () => {
    if (!selectedPayable) return;
    setPaying(true);
    try {
      const res = await payPurchaseDebt(selectedPayable.id, payMethod, payNotes);
      if (res.success) {
        if (res.warning) {
          notify.admin.warning(res.warning);
        } else {
          notify.success(`Hutang PO ${selectedPayable.poNumber} berhasil dilunasi!`);
        }
        setSelectedPayable(null);
        setPayNotes('');
        await onRefresh();
      } else {
        notify.error(res.error || 'Gagal melunasi hutang');
      }
    } catch (err: any) {
      notify.error(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setPaying(false);
    }
  };

  // Export Excel
  const exportDebtReceivableExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Hutang Supplier
    const payRows = purchasesDebt.map(p => ({
      'No. PO': p.poNumber,
      'Supplier': p.supplierName,
      'Telepon': p.supplierPhone || '-',
      'Total Hutang (Rp)': p.totalAmount,
      'Metode': p.paymentMethod,
      'Tgl Transaksi': new Date(p.createdAt).toLocaleDateString('id-ID'),
      'Jatuh Tempo': p.dueDate ? new Date(p.dueDate).toLocaleDateString('id-ID') : 'Tanpa Tempo',
      'Status Tempo': getDueStatus(p.dueDate).label,
      'Catatan': p.notes || '-'
    }));
    const wsPay = XLSX.utils.json_to_sheet(payRows);
    XLSX.utils.book_append_sheet(wb, wsPay, 'Hutang Supplier (Payable)');

    // Sheet 2: Piutang Pelanggan
    const recRows = customersReceivable.map(c => ({
      'No. Pesanan': c.orderNumber,
      'Nama Pembeli': c.customerName,
      'No. Telepon / WA': c.customerPhone || '-',
      'Total Piutang (Rp)': c.totalAmount,
      'Metode': c.paymentMethod,
      'Tgl Order': new Date(c.createdAt).toLocaleDateString('id-ID'),
      'Jatuh Tempo': c.dueDate ? new Date(c.dueDate).toLocaleDateString('id-ID') : 'Tanpa Tempo',
      'Status Tempo': getDueStatus(c.dueDate).label,
      'Catatan': c.notes || '-'
    }));
    const wsRec = XLSX.utils.json_to_sheet(recRows);
    XLSX.utils.book_append_sheet(wb, wsRec, 'Piutang Pelanggan (Receivable)');

    XLSX.writeFile(wb, `Laporan_Hutang_Piutang_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* 4 SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Hutang Usaha (Supplier) */}
        <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">Hutang Usaha (Ke Supplier)</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <ArrowDownCircle size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-black text-rose-700">{idr(totalPayables)}</h3>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span className="font-bold text-gray-700">{purchasesDebt.length} PO Belum Lunas</span>
            {overduePayablesCount > 0 && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 font-black rounded-lg text-[10px]">
                {overduePayablesCount} Overdue
              </span>
            )}
          </div>
        </div>

        {/* Piutang Usaha (Pelanggan) */}
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Piutang Usaha (Uang di Luar)</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <ArrowUpCircle size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-black text-amber-700">{idr(totalReceivables)}</h3>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span className="font-bold text-gray-700">{customersReceivable.length} Transaksi Pembeli</span>
            {overdueReceivablesCount > 0 && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-black rounded-lg text-[10px]">
                {overdueReceivablesCount} Overdue
              </span>
            )}
          </div>
        </div>

        {/* Posisi Tagihan Bersih (Net Position) */}
        <div className={`p-5 rounded-2xl border shadow-sm ${
          totalReceivables >= totalPayables
            ? 'bg-emerald-50/50 border-emerald-200'
            : 'bg-rose-50/50 border-rose-200'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-700">Neraca Tagihan (Piutang - Hutang)</span>
            <div className={`p-2 rounded-xl ${
              totalReceivables >= totalPayables ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
            }`}>
              <CreditCard size={18} />
            </div>
          </div>
          <h3 className={`text-2xl font-black ${
            totalReceivables >= totalPayables ? 'text-emerald-700' : 'text-rose-700'
          }`}>
            {totalReceivables >= totalPayables ? '+' : '-'}{idr(Math.abs(totalReceivables - totalPayables))}
          </h3>
          <p className="text-xs text-gray-600 mt-2 font-medium">
            {totalReceivables >= totalPayables
              ? '✅ Piutang lebih besar dari hutang (Surplus Tagihan)'
              : '⚠️ Kewajiban hutang lebih besar dari piutang (Waspada Kas)'}
          </p>
        </div>

        {/* Quick Action Export */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Unduh Data Tagihan</span>
            <p className="text-xs text-gray-600 mt-1">Ekspor seluruh rekapitulasi hutang & piutang tempo ke file Excel.</p>
          </div>
          <button
            onClick={exportDebtReceivableExcel}
            className="mt-3 w-full py-2.5 px-3 bg-gray-900 hover:bg-black text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <Download size={14} /> Download Rekap Excel
          </button>
        </div>
      </div>

      {/* SUB-TABS & FILTERS */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Sub Tab Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setActiveSubTab('all')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-black transition-all ${
                activeSubTab === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Semua ({purchasesDebt.length + customersReceivable.length})
            </button>
            <button
              onClick={() => setActiveSubTab('payable')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-black transition-all ${
                activeSubTab === 'payable' ? 'bg-rose-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              🔴 Hutang Supplier ({purchasesDebt.length})
            </button>
            <button
              onClick={() => setActiveSubTab('receivable')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-black transition-all ${
                activeSubTab === 'receivable' ? 'bg-amber-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              🟡 Piutang Pembeli ({customersReceivable.length})
            </button>
          </div>

          {/* Filter Status Tempo */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={filterDueStatus}
              onChange={(e: any) => setFilterDueStatus(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-700"
            >
              <option value="all">Semua Status Tempo</option>
              <option value="overdue">🚨 Lewat Jatuh Tempo (Overdue)</option>
              <option value="upcoming">⏳ Belum Jatuh Tempo</option>
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari no PO, no pesanan, nama supplier, nama pembeli, catatan..."
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
      </div>

      {/* BAGIAN 1: TABEL HUTANG SUPPLIER (ACCOUNTS PAYABLE) */}
      {(activeSubTab === 'all' || activeSubTab === 'payable') && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-rose-50/40 border-b border-rose-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
                <Store size={16} />
              </span>
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  Daftar Transaksi Hutang Supplier (PO Tempo)
                </h4>
                <p className="text-xs text-slate-500">
                  Tagihan pembelian barang ke distributor/supplier yang belum dilunasi
                </p>
              </div>
            </div>
            <span className="text-xs font-black text-rose-700 bg-rose-100 px-3 py-1 rounded-full">
              Total Hutang: {idr(filteredPayables.reduce((s, p) => s + p.totalAmount, 0))}
            </span>
          </div>

          {filteredPayables.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs font-medium">
              Tidak ada data transaksi hutang supplier yang cocok.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 text-left">No. PO</th>
                    <th className="py-3 px-4 text-left">Supplier</th>
                    <th className="py-3 px-4 text-left">Tgl Transaksi</th>
                    <th className="py-3 px-4 text-left">Jatuh Tempo</th>
                    <th className="py-3 px-4 text-right">Nilai Hutang</th>
                    <th className="py-3 px-4 text-center">Status Tempo</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayables.map((p) => {
                    const due = getDueStatus(p.dueDate);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-gray-800">
                          {p.poNumber}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-gray-900">{p.supplierName}</p>
                          {p.supplierPhone && (
                            <p className="text-[11px] text-gray-400">{p.supplierPhone}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {new Date(p.createdAt).toLocaleDateString('id-ID')}
                        </td>
                        <td className="py-3 px-4 font-semibold text-gray-700">
                          {p.dueDate ? new Date(p.dueDate).toLocaleDateString('id-ID') : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-rose-700 text-sm">
                          {idr(p.totalAmount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${due.color}`}>
                            {due.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => {
                                setSelectedPayable(p);
                                setPayMethod('CASH');
                                setPayNotes('');
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                              title="Bayar / Lunasi Tagihan Ini"
                            >
                              <CheckCircle2 size={12} /> Lunasi
                            </button>
                            <Link
                              href={`/admin/purchases/print/${p.id}`}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                              title="Cetak PO / Bukti Pembelian"
                            >
                              <Printer size={12} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* BAGIAN 2: TABEL PIUTANG PEMBELI (ACCOUNTS RECEIVABLE) */}
      {(activeSubTab === 'all' || activeSubTab === 'receivable') && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-amber-50/40 border-b border-amber-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                <User size={16} />
              </span>
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  Daftar Transaksi Pembeli yang Hutang (Piutang Pelanggan)
                </h4>
                <p className="text-xs text-slate-500">
                  Pesanan penjualan / kasir dengan status Belum Lunas (Tempo) yang belum tertagih
                </p>
              </div>
            </div>
            <span className="text-xs font-black text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
              Total Piutang: {idr(filteredReceivables.reduce((s, c) => s + c.totalAmount, 0))}
            </span>
          </div>

          {filteredReceivables.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs font-medium">
              Tidak ada data transaksi pembeli yang hutang / belum lunas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 text-left">No. Pesanan</th>
                    <th className="py-3 px-4 text-left">Pembeli / Pelanggan</th>
                    <th className="py-3 px-4 text-left">Tgl Order</th>
                    <th className="py-3 px-4 text-left">Jatuh Tempo</th>
                    <th className="py-3 px-4 text-right">Nilai Piutang</th>
                    <th className="py-3 px-4 text-center">Status Tempo</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReceivables.map((c) => {
                    const due = getDueStatus(c.dueDate);
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-gray-800">
                          #{c.orderNumber.slice(-8).toUpperCase()}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-gray-900">{c.customerName}</p>
                          {c.customerPhone && (
                            <p className="text-[11px] text-gray-500 flex items-center gap-1">
                              <Phone size={10} /> {c.customerPhone}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {new Date(c.createdAt).toLocaleDateString('id-ID')}
                        </td>
                        <td className="py-3 px-4 font-semibold text-gray-700">
                          {c.dueDate ? new Date(c.dueDate).toLocaleDateString('id-ID') : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-amber-700 text-sm">
                          {idr(c.totalAmount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${due.color}`}>
                            {due.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1.5 justify-end">
                            <Link
                              href={`/admin/orders/${c.id}`}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                              title="Buka Detail Order & Tandai Lunas"
                            >
                              <ExternalLink size={12} /> Buka Order
                            </Link>
                            <Link
                              href={`/admin/orders/print/${c.id}`}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                              title="Cetak Struk"
                            >
                              <Printer size={12} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL PELUNASAN HUTANG PO */}
      {selectedPayable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" />
                Pelunasan Hutang PO
              </h3>
              <button
                onClick={() => setSelectedPayable(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-100 mb-4 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">No. PO:</span>
                <span className="font-mono font-bold text-gray-800">{selectedPayable.poNumber}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Supplier:</span>
                <span className="font-bold text-gray-800">{selectedPayable.supplierName}</span>
              </div>
              <div className="flex justify-between text-xs pt-1 border-t border-rose-200">
                <span className="font-bold text-rose-800">Total Tagihan:</span>
                <span className="font-black text-rose-700 text-sm">{idr(selectedPayable.totalAmount)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Metode Pelunasan *
                </label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="CASH">CASH / TUNAI (Kas Toko)</option>
                  <option value="TRANSFER">TRANSFER BANK</option>
                  <option value="GIRO">GIRO / CEK</option>
                  <option value="QRIS">QRIS</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Catatan Pelunasan (Opsional)
                </label>
                <textarea
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  placeholder="Contoh: Dilunasi via transfer BCA rek supplier..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-[11px] text-emerald-800 font-medium">
                💡 Status PO akan otomatis berubah menjadi <strong>LUNAS</strong> dan pengeluaran kas modal toko akan dicatat secara otomatis.
              </div>
            </div>

            <div className="flex gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setSelectedPayable(null)}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handlePayPO}
                disabled={paying}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 transition-all shadow-sm"
              >
                {paying ? 'Memproses...' : 'Konfirmasi Lunas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
