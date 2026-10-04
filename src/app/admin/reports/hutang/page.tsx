'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, AlertTriangle, TrendingDown, TrendingUp, CheckCircle2,
  Clock, CreditCard, Building2, User, Calendar, RefreshCcw,
  ChevronRight, X, DollarSign, Loader2, FileText, Search
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getUserAndRole } from '@/lib/supabase-helpers';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';
import { getDebtReport, markCustomerDebtPaid, DebtSummary, SupplierDebt, CustomerDebt } from '@/lib/actions/debt-report.actions';
import { payPurchaseDebt } from '@/lib/actions/purchase.actions';
import * as XLSX from 'xlsx';

const fmtCurrency = (n: number) =>
  `Rp${Number(n || 0).toLocaleString('id-ID')}`;

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
};

export default function HutangReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DebtSummary | null>(null);
  const [activeTab, setActiveTab] = useState<'supplier' | 'customer'>('supplier');
  const [search, setSearch] = useState('');

  // Supplier debt pay modal
  const [payModal, setPayModal] = useState<SupplierDebt | null>(null);
  const [payMethod, setPayMethod] = useState('CASH');
  const [payNotes, setPayNotes] = useState('');
  const [paying, setPaying] = useState(false);

  // Customer debt pay modal
  const [custPayModal, setCustPayModal] = useState<CustomerDebt | null>(null);
  const [custPayMethod, setCustPayMethod] = useState('CASH');
  const [custPayNotes, setCustPayNotes] = useState('');
  const [custPaying, setCustPaying] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getDebtReport();
      setData(result);
    } catch (err) {
      console.error(err);
      notify.admin.error('Gagal memuat data hutang');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const { isAdmin, isStaff } = await getUserAndRole();
      if (!isAdmin && !isStaff) {
        router.push('/profil/login');
        return;
      }
      loadData();
    };
    checkAuth();
  }, [router, loadData]);

  // Pay supplier debt
  const handlePaySupplier = async () => {
    if (!payModal) return;
    setPaying(true);
    try {
      const res = await payPurchaseDebt(payModal.id, payMethod, payNotes || undefined);
      if (res.success) {
        notify.admin.success(`Hutang ${payModal.poNumber} berhasil dilunasi`);
        if (res.warning) notify.admin.warning(res.warning);
        setPayModal(null);
        setPayNotes('');
        await loadData();
      } else {
        notify.admin.error(res.error || 'Gagal melunasi');
      }
    } finally {
      setPaying(false);
    }
  };

  // Pay customer debt
  const handlePayCustomer = async () => {
    if (!custPayModal) return;
    setCustPaying(true);
    try {
      const res = await markCustomerDebtPaid(custPayModal.id, custPayMethod, custPayNotes || undefined);
      if (res.success) {
        notify.admin.success(`Piutang ${custPayModal.customerName} berhasil dilunasi`);
        setCustPayModal(null);
        setCustPayNotes('');
        await loadData();
      } else {
        notify.admin.error(res.error || 'Gagal melunasi');
      }
    } finally {
      setCustPaying(false);
    }
  };

  const handleExport = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();

    // Sheet 1: Hutang Supplier
    const supplierRows = data.supplierDebts.map(d => ({
      'No. PO': d.poNumber,
      'Supplier': d.supplierName,
      'Total': d.totalAmount,
      'Metode': d.paymentMethod,
      'Jatuh Tempo': fmtDate(d.dueDate),
      'Status': d.isOverdue ? 'JATUH TEMPO' : 'BELUM LUNAS',
      'Tanggal PO': fmtDate(d.createdAt),
      'Catatan': d.notes || '',
    }));
    const ws1 = XLSX.utils.json_to_sheet(supplierRows);
    XLSX.utils.book_append_sheet(wb, ws1, 'Hutang Supplier');

    // Sheet 2: Piutang Pelanggan
    const customerRows = data.customerDebts.map(d => ({
      'No. Order': d.orderId,
      'Pelanggan': d.customerName,
      'Telepon': d.customerPhone || '',
      'Total': d.totalAmount,
      'Metode': d.paymentMethod,
      'Jatuh Tempo': fmtDate(d.dueDate),
      'Status': d.isOverdue ? 'JATUH TEMPO' : 'BELUM LUNAS',
      'Tanggal Order': fmtDate(d.createdAt),
      'Channel': d.channel || '',
    }));
    const ws2 = XLSX.utils.json_to_sheet(customerRows);
    XLSX.utils.book_append_sheet(wb, ws2, 'Piutang Pelanggan');

    XLSX.writeFile(wb, `laporan-hutang-${new Date().toISOString().slice(0, 10)}.xlsx`);
    notify.admin.success('File Excel berhasil diunduh');
  };

  // Filtered lists
  const filteredSupplier = (data?.supplierDebts || []).filter(d =>
    !search ||
    d.poNumber.toLowerCase().includes(search.toLowerCase()) ||
    d.supplierName.toLowerCase().includes(search.toLowerCase())
  );
  const filteredCustomer = (data?.customerDebts || []).filter(d =>
    !search ||
    d.customerName.toLowerCase().includes(search.toLowerCase()) ||
    d.orderId.toLowerCase().includes(search.toLowerCase()) ||
    (d.customerPhone || '').includes(search)
  );

  return (
    <div className="p-3 md:p-6 bg-gray-50/50 min-h-screen">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/reports" className="p-2 rounded-xl bg-white border border-gray-100 shadow-sm hover:bg-gray-50 transition">
          <ArrowLeft size={18} className="text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">
            Laporan Hutang & Piutang
          </h1>
          <p className="text-xs text-gray-400 font-medium mt-0.5">
            Monitoring hutang ke supplier & piutang dari pelanggan
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={loading || !data}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-800 transition shadow-lg shadow-gray-200 disabled:opacity-50"
        >
          <FileText size={14} />
          Export Excel
        </button>
        <button
          onClick={loadData}
          disabled={loading}
          className="p-2.5 bg-white border border-gray-100 rounded-xl shadow-sm hover:bg-gray-50 transition"
        >
          <RefreshCcw size={16} className={`text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-gray-400" size={32} />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <SummaryCard
              label="Total Hutang Supplier"
              value={fmtCurrency(data?.totalSupplierDebt || 0)}
              icon={TrendingDown}
              color="text-red-600"
              bg="bg-red-50"
              border="border-red-100"
              sub={`${data?.supplierDebts.length || 0} PO belum lunas`}
            />
            <SummaryCard
              label="Total Piutang Pelanggan"
              value={fmtCurrency(data?.totalCustomerDebt || 0)}
              icon={TrendingUp}
              color="text-orange-600"
              bg="bg-orange-50"
              border="border-orange-100"
              sub={`${data?.customerDebts.length || 0} order belum lunas`}
            />
            <SummaryCard
              label="Hutang Jatuh Tempo"
              value={`${data?.overdueSupplierCount || 0} PO`}
              icon={AlertTriangle}
              color="text-rose-600"
              bg="bg-rose-50"
              border="border-rose-100"
              urgent={!!data?.overdueSupplierCount}
            />
            <SummaryCard
              label="Piutang Jatuh Tempo"
              value={`${data?.overdueCustomerCount || 0} Order`}
              icon={Clock}
              color="text-amber-600"
              bg="bg-amber-50"
              border="border-amber-100"
              urgent={!!data?.overdueCustomerCount}
            />
          </div>

          {/* Net Position */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Posisi Bersih</p>
                <p className="text-2xl md:text-3xl font-black text-gray-900">
                  {(data?.totalCustomerDebt || 0) >= (data?.totalSupplierDebt || 0) ? '+' : '-'}
                  {fmtCurrency(Math.abs((data?.totalCustomerDebt || 0) - (data?.totalSupplierDebt || 0)))}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {(data?.totalCustomerDebt || 0) >= (data?.totalSupplierDebt || 0)
                    ? '✅ Piutang lebih besar dari hutang — posisi menguntungkan'
                    : '⚠️ Hutang lebih besar dari piutang — perlu perhatian'}
                </p>
              </div>
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="text-xs font-bold text-red-500 uppercase tracking-wider">Hutang</p>
                  <p className="text-lg font-black text-red-600">{fmtCurrency(data?.totalSupplierDebt || 0)}</p>
                </div>
                <div className="text-2xl font-black text-gray-200">vs</div>
                <div className="text-center">
                  <p className="text-xs font-bold text-orange-500 uppercase tracking-wider">Piutang</p>
                  <p className="text-lg font-black text-orange-600">{fmtCurrency(data?.totalCustomerDebt || 0)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setActiveTab('supplier')}
                className={`flex-1 py-4 px-6 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'supplier'
                    ? 'bg-red-50 text-red-600 border-b-2 border-red-500'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Building2 size={16} />
                Hutang ke Supplier
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'supplier' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {data?.supplierDebts.length || 0}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('customer')}
                className={`flex-1 py-4 px-6 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'customer'
                    ? 'bg-orange-50 text-orange-600 border-b-2 border-orange-500'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
              >
                <User size={16} />
                Piutang dari Pelanggan
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'customer' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {data?.customerDebts.length || 0}
                </span>
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-gray-50">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={activeTab === 'supplier' ? 'Cari no. PO atau nama supplier...' : 'Cari nama pelanggan atau no. order...'}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-200"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X size={14} className="text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
            </div>

            {/* Supplier Debts Tab */}
            {activeTab === 'supplier' && (
              <div>
                {filteredSupplier.length === 0 ? (
                  <div className="text-center py-16">
                    <CheckCircle2 size={48} className="text-green-300 mx-auto mb-3" />
                    <p className="text-gray-400 font-bold">
                      {search ? 'Tidak ada hasil pencarian' : '🎉 Tidak ada hutang ke supplier!'}
                    </p>
                    <p className="text-xs text-gray-300 mt-1">Semua PO sudah terbayar lunas</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {filteredSupplier.map((d) => (
                      <div key={d.id} className={`p-5 hover:bg-gray-50/50 transition-colors ${d.isOverdue ? 'bg-red-50/30' : ''}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-black text-gray-900 text-sm">{d.poNumber}</span>
                              {d.isOverdue && (
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                                  <AlertTriangle size={10} /> JATUH TEMPO
                                </span>
                              )}
                              {!d.isOverdue && (
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">
                                  BELUM LUNAS
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                              <Building2 size={11} />
                              <span className="font-semibold">{d.supplierName}</span>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                              <span className="flex items-center gap-1">
                                <CreditCard size={11} /> {d.paymentMethod}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar size={11} /> PO: {fmtDate(d.createdAt)}
                              </span>
                              {d.dueDate && (
                                <span className={`flex items-center gap-1 font-bold ${d.isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
                                  <Clock size={11} /> Jatuh Tempo: {fmtDate(d.dueDate)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className="text-base font-black text-gray-900">
                              {fmtCurrency(d.totalAmount)}
                            </span>
                            <div className="flex gap-2">
                              <Link
                                href={`/admin/purchases`}
                                className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 transition"
                              >
                                <ChevronRight size={12} /> Detail
                              </Link>
                              <button
                                onClick={() => { setPayModal(d); setPayMethod('CASH'); setPayNotes(''); }}
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition shadow-sm shadow-green-200"
                              >
                                <CheckCircle2 size={12} /> Lunasi
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Customer Debts Tab */}
            {activeTab === 'customer' && (
              <div>
                {filteredCustomer.length === 0 ? (
                  <div className="text-center py-16">
                    <CheckCircle2 size={48} className="text-green-300 mx-auto mb-3" />
                    <p className="text-gray-400 font-bold">
                      {search ? 'Tidak ada hasil pencarian' : '🎉 Tidak ada piutang dari pelanggan!'}
                    </p>
                    <p className="text-xs text-gray-300 mt-1">Semua transaksi sudah terbayar lunas</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {filteredCustomer.map((d) => (
                      <div key={d.id} className={`p-5 hover:bg-gray-50/50 transition-colors ${d.isOverdue ? 'bg-orange-50/30' : ''}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-black text-gray-900 text-sm">{d.customerName}</span>
                              {d.isOverdue && (
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                                  <AlertTriangle size={10} /> JATUH TEMPO
                                </span>
                              )}
                              {!d.isOverdue && (
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">
                                  BELUM LUNAS
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                              <span className="font-mono text-gray-400">{d.orderId.slice(0, 16)}...</span>
                              {d.customerPhone && <span className="text-gray-400">• {d.customerPhone}</span>}
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                              <span className="flex items-center gap-1">
                                <CreditCard size={11} /> {d.paymentMethod}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar size={11} /> Order: {fmtDate(d.createdAt)}
                              </span>
                              {d.dueDate && (
                                <span className={`flex items-center gap-1 font-bold ${d.isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
                                  <Clock size={11} /> Jatuh Tempo: {fmtDate(d.dueDate)}
                                </span>
                              )}
                              {d.channel && (
                                <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-xs font-bold">
                                  {d.channel}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className="text-base font-black text-gray-900">
                              {fmtCurrency(d.totalAmount)}
                            </span>
                            <div className="flex gap-2">
                              <Link
                                href={`/admin/orders/${d.id}`}
                                className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 transition"
                              >
                                <ChevronRight size={12} /> Detail
                              </Link>
                              <button
                                onClick={() => { setCustPayModal(d); setCustPayMethod('CASH'); setCustPayNotes(''); }}
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition shadow-sm shadow-green-200"
                              >
                                <CheckCircle2 size={12} /> Tandai Lunas
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== Pay Supplier Modal ===== */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-black text-gray-900 text-lg">Lunasi Hutang Supplier</h3>
                <p className="text-xs text-gray-400 mt-0.5">{payModal.poNumber} — {payModal.supplierName}</p>
              </div>
              <button onClick={() => setPayModal(null)} className="p-2 rounded-xl hover:bg-gray-100 transition">
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            <div className="bg-red-50 rounded-2xl p-4 mb-5">
              <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1">Total yang akan dibayar</p>
              <p className="text-2xl font-black text-red-700">{fmtCurrency(payModal.totalAmount)}</p>
              {payModal.dueDate && (
                <p className={`text-xs mt-1 font-semibold ${payModal.isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
                  Jatuh Tempo: {fmtDate(payModal.dueDate)}
                  {payModal.isOverdue && ' (Sudah lewat jatuh tempo)'}
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">
                  Metode Pembayaran
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-100"
                >
                  {['CASH', 'TRANSFER', 'QRIS', 'GIRO', 'KREDIT'].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">
                  Catatan (opsional)
                </label>
                <textarea
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  rows={2}
                  placeholder="No. transfer, bukti pembayaran, dll..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-100 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setPayModal(null)}
                className="flex-1 py-3 border border-gray-200 rounded-2xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition"
              >
                Batal
              </button>
              <button
                onClick={handlePaySupplier}
                disabled={paying}
                className="flex-1 py-3 bg-green-600 text-white rounded-2xl text-sm font-bold hover:bg-green-700 transition shadow-lg shadow-green-200 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {paying ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {paying ? 'Memproses...' : 'Konfirmasi Pelunasan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Pay Customer Modal ===== */}
      {custPayModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-black text-gray-900 text-lg">Terima Pelunasan Piutang</h3>
                <p className="text-xs text-gray-400 mt-0.5">{custPayModal.customerName}</p>
              </div>
              <button onClick={() => setCustPayModal(null)} className="p-2 rounded-xl hover:bg-gray-100 transition">
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            <div className="bg-orange-50 rounded-2xl p-4 mb-5">
              <p className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-1">Total piutang yang diterima</p>
              <p className="text-2xl font-black text-orange-700">{fmtCurrency(custPayModal.totalAmount)}</p>
              {custPayModal.dueDate && (
                <p className={`text-xs mt-1 font-semibold ${custPayModal.isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
                  Jatuh Tempo: {fmtDate(custPayModal.dueDate)}
                  {custPayModal.isOverdue && ' (Sudah lewat jatuh tempo)'}
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">
                  Metode Pembayaran Masuk
                </label>
                <select
                  value={custPayMethod}
                  onChange={(e) => setCustPayMethod(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-100"
                >
                  {['CASH', 'TRANSFER', 'QRIS', 'DEBIT', 'KREDIT'].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">
                  Catatan (opsional)
                </label>
                <textarea
                  value={custPayNotes}
                  onChange={(e) => setCustPayNotes(e.target.value)}
                  rows={2}
                  placeholder="No. transfer, bukti pembayaran, dll..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-100 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setCustPayModal(null)}
                className="flex-1 py-3 border border-gray-200 rounded-2xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition"
              >
                Batal
              </button>
              <button
                onClick={handlePayCustomer}
                disabled={custPaying}
                className="flex-1 py-3 bg-green-600 text-white rounded-2xl text-sm font-bold hover:bg-green-700 transition shadow-lg shadow-green-200 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {custPaying ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {custPaying ? 'Memproses...' : 'Konfirmasi Diterima'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label, value, icon: Icon, color, bg, border, sub, urgent
}: {
  label: string; value: string; icon: any; color: string; bg: string; border: string; sub?: string; urgent?: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl border p-4 md:p-5 shadow-sm ${urgent ? 'ring-2 ring-red-200 border-red-100' : border} relative overflow-hidden`}>
      {urgent && (
        <div className="absolute top-0 right-0 w-16 h-16 bg-red-50 rounded-bl-3xl opacity-60" />
      )}
      <div className={`${bg} ${color} p-2.5 rounded-xl w-fit mb-3 border ${border}`}>
        <Icon size={18} />
      </div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl md:text-2xl font-black tracking-tight ${urgent ? 'text-red-600' : 'text-gray-900'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}
