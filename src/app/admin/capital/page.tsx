'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Landmark, Plus, CreditCard, Wallet, RefreshCcw, Save, X, SlidersHorizontal } from 'lucide-react';
import notify from '@/lib/notify';
import { CapitalTransaction, LoanRecord } from '@/types/finance';
import { TableSkeleton } from '@/components/admin/InventorySkeleton';
import {
  getCapitalData,
  addCapitalTransaction,
  recordLoan,
  repayLoan,
  addMarketplaceAccount,
  updateMarketplaceBalance,
  adjustTotalCapital
} from '@/lib/actions/capital.actions';

// Components
import { CapitalSummaryCards } from '@/components/admin/capital/CapitalSummaryCards';
import { MarketplaceWallets } from '@/components/admin/capital/MarketplaceWallets';
import { MarketplaceLogsTable } from '@/components/admin/capital/MarketplaceLogsTable';
import { CapitalTransactionTable } from '@/components/admin/capital/CapitalTransactionTable';
import { LoanSection } from '@/components/admin/capital/LoanSection';

type MarketplaceAccount = {
  id: string;
  name: string;
  storeName?: string;
  activeBalance: number;
  pendingBalance: number;
  lastUpdated?: any;
};

type MarketplaceLog = {
  id: string;
  accountId: string;
  name: string;
  storeName?: string;
  type: 'ADJUST' | 'WITHDRAWAL' | 'DEPOSIT';
  amount?: number;
  activeChange?: number;
  pendingChange?: number;
  date: any;
  recordedBy?: string;
  note?: string;
};

export default function CapitalPage() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<CapitalTransaction[]>([]);
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [cashBalance, setCashBalance] = useState(0);
  const [marketplaceAccounts, setMarketplaceAccounts] = useState<MarketplaceAccount[]>([]);
  const [marketplaceLogs, setMarketplaceLogs] = useState<MarketplaceLog[]>([]);
  const [assetSummary, setAssetSummary] = useState({
    stockValue: 0,
    receivables: 0,
    totalLiabilities: 0
  });

  // Modal & Form States
  const [isCapitalModalOpen, setIsCapitalModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedAccount, setSelectedAccount] = useState<MarketplaceAccount | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<LoanRecord | null>(null);
  const [formData, setFormData] = useState({
    amount: '',
    targetCapital: '',
    adjustReason: '',
    description: '',
    type: 'INJECTION' as 'INJECTION' | 'WITHDRAWAL',
    lenderName: '',
    loanType: 'STANDARD' as 'STANDARD' | 'REKENING_KORAN',
    interestRate: '',
    repayAmount: '',
    interestExpense: '',
    activeBalance: '',
    pendingBalance: '',
    storeName: '',
    newPlatform: 'Shopee',
    newStoreName: ''
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCapitalData();
      if (res.success && res.data) {
        setTransactions(res.data.transactions as unknown as CapitalTransaction[]);
        setLoans(res.data.loans as unknown as LoanRecord[]);
        setMarketplaceAccounts(res.data.marketplaceAccounts as unknown as MarketplaceAccount[]);
        setMarketplaceLogs(res.data.marketplaceLogs as unknown as MarketplaceLog[]);
        setAssetSummary(res.data.assetSummary);
      } else {
        notify.error(res.error || 'Gagal memuat data modal');
      }
    } catch (err: any) {
      console.error(err);
      notify.error('Terjadi kesalahan saat memuat data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totals = useMemo(() => {
    const injected = transactions.filter(t => t.type === 'INJECTION').reduce((s, t) => s + (t.amount || 0), 0);
    const withdrawn = transactions.filter(t => t.type === 'WITHDRAWAL').reduce((s, t) => s + (t.amount || 0), 0);
    const currentCapital = injected - withdrawn;
    const marketplaceAssets = marketplaceAccounts.reduce((s, a) => s + (a.activeBalance || 0) + (a.pendingBalance || 0), 0);
    const totalAssets = assetSummary.stockValue + assetSummary.receivables + cashBalance + marketplaceAssets;
    const netWorth = totalAssets - assetSummary.totalLiabilities;
    return { currentCapital, marketplaceAssets, totalAssets, netWorth, growth: netWorth - currentCapital };
  }, [transactions, marketplaceAccounts, assetSummary, cashBalance]);

  const handleAction = async (type: string, payload?: any) => {
    setIsSubmitting(true);
    try {
      switch (type) {
        case 'ADD_CAPITAL':
          const resCap = await addCapitalTransaction({
            type: formData.type,
            amount: Number(formData.amount),
            description: formData.description,
          });
          if (resCap.success) {
            notify.success('Transaksi modal berhasil dicatat');
            setIsCapitalModalOpen(false);
            loadData();
          } else {
            notify.error(resCap.error || 'Gagal mencatat transaksi');
          }
          break;

        case 'ADJUST_CAPITAL':
          const targetCap = Number(formData.targetCapital);
          if (isNaN(targetCap) || targetCap < 0) {
            notify.error('Nominal modal harus berupa angka valid');
            break;
          }
          const resAdj = await adjustTotalCapital({
            targetCapital: targetCap,
            reason: formData.adjustReason,
          });
          if (resAdj.success) {
            notify.success(resAdj.message || 'Modal total berhasil disesuaikan!');
            setIsAdjustModalOpen(false);
            loadData();
          } else {
            notify.error(resAdj.error || 'Gagal menyesuaikan modal');
          }
          break;

        case 'RECORD_LOAN':
          const resLoan = await recordLoan({
            lenderName: formData.lenderName,
            amount: Number(formData.amount),
            description: formData.description,
            loanType: formData.loanType,
            interestRate: Number(formData.interestRate),
          });
          if (resLoan.success) {
            notify.success('Pinjaman berhasil dicatat');
            setIsLoanModalOpen(false);
            loadData();
          } else {
            notify.error(resLoan.error || 'Gagal mencatat pinjaman');
          }
          break;

        case 'REPAY_LOAN':
          if (!selectedLoan) return;
          const resRepay = await repayLoan(
            selectedLoan.id,
            Number(formData.repayAmount),
            Number(formData.interestExpense) || 0
          );
          if (resRepay.success) {
            notify.success('Pembayaran pinjaman diproses');
            setIsRepayModalOpen(false);
            loadData();
          } else {
            notify.error(resRepay.error || 'Gagal memproses pembayaran');
          }
          break;

        case 'ADD_MARKETPLACE_ACCOUNT':
          const resAddAcc = await addMarketplaceAccount(formData.newPlatform, formData.newStoreName);
          if (resAddAcc.success) {
            notify.success('Akun marketplace ditambahkan');
            setIsAddAccountModalOpen(false);
            loadData();
          } else {
            notify.error(resAddAcc.error || 'Gagal menambahkan akun');
          }
          break;

        case 'UPDATE_MARKETPLACE_ACCOUNT':
          if (!selectedAccount) return;
          const resUpd = await updateMarketplaceBalance({
            accountId: selectedAccount.id,
            activeBalance: Number(formData.activeBalance),
            pendingBalance: Number(formData.pendingBalance),
            note: formData.storeName ? `Update ${formData.storeName}` : 'Update saldo',
          });
          if (resUpd.success) {
            notify.success('Saldo marketplace diperbarui');
            setIsAccountModalOpen(false);
            loadData();
          } else {
            notify.error(resUpd.error || 'Gagal memperbarui saldo');
          }
          break;

        case 'WITHDRAW_MARKETPLACE':
          const acc = payload as MarketplaceAccount;
          const amount = Number(prompt(`Tarik dari ${acc.name}:`, acc.activeBalance.toString())?.replace(/\D/g, '') || 0);
          if (amount <= 0 || amount > acc.activeBalance) {
            notify.error('Nominal tidak valid');
            break;
          }
          await updateMarketplaceBalance({
            accountId: acc.id,
            activeBalance: acc.activeBalance - amount,
            pendingBalance: acc.pendingBalance,
            note: `Penarikan dari ${acc.name}`,
          });
          await addCapitalTransaction({
            type: 'INJECTION',
            amount,
            description: `Penarikan Marketplace ${acc.name}`,
          });
          notify.success('Dana berhasil ditarik ke kas');
          loadData();
          break;
      }
    } catch (err: any) {
      console.error(err);
      notify.error(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <TableSkeleton />;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Landmark className="w-7 h-7 text-indigo-600" />
            Manajemen Modal & Pendanaan ERP
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pantau arus modal ekuitas, portofolio liabilitas, dan saldo marketplace PostgreSQL.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData()}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
            title="Refresh Data"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setFormData({ ...formData, targetCapital: totals.currentCapital.toString(), adjustReason: '' });
              setIsAdjustModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-sm text-sm font-medium transition cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Penyesuaian Modal Total
          </button>
          <button
            onClick={() => {
              setFormData({ ...formData, amount: '', description: '', type: 'INJECTION' });
              setIsCapitalModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm text-sm font-medium transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Catat Mutasi Modal
          </button>
          <button
            onClick={() => {
              setFormData({ ...formData, lenderName: '', amount: '', description: '', interestRate: '' });
              setIsLoanModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm text-sm font-medium transition cursor-pointer"
          >
            <CreditCard className="w-4 h-4" />
            Tambah Pinjaman
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <CapitalSummaryCards
        currentCapital={totals.currentCapital}
        stockValue={assetSummary.stockValue}
        receivables={assetSummary.receivables}
        totalLiabilities={assetSummary.totalLiabilities}
        growth={totals.growth}
      />

      {/* Marketplace Wallets */}
      <MarketplaceWallets
        accounts={marketplaceAccounts}
        totalAssets={totals.marketplaceAssets}
        onAddAccount={() => {
          setFormData({ ...formData, newPlatform: 'Shopee', newStoreName: '' });
          setIsAddAccountModalOpen(true);
        }}
        onImport={() => loadData()}
        onEdit={(acc: MarketplaceAccount) => {
          setSelectedAccount(acc);
          setFormData({
            ...formData,
            storeName: acc.storeName || '',
            activeBalance: acc.activeBalance.toString(),
            pendingBalance: acc.pendingBalance.toString()
          });
          setIsAccountModalOpen(true);
        }}
        onWithdraw={(acc: MarketplaceAccount) => handleAction('WITHDRAW_MARKETPLACE', acc)}
      />

      {/* Marketplace Logs */}
      {marketplaceLogs.length > 0 && <MarketplaceLogsTable logs={marketplaceLogs} />}

      {/* Grid Layout: Transactions & Loans */}
      <div className="grid grid-cols-1 gap-8">
        <CapitalTransactionTable
          transactions={transactions}
          onDelete={(id: string) => handleAction('DELETE_TX', id)}
        />
        <LoanSection
          loans={loans}
          onRepay={(loan: LoanRecord) => {
            setSelectedLoan(loan);
            setFormData({ ...formData, repayAmount: '', interestExpense: '0' });
            setIsRepayModalOpen(true);
          }}
          onRecord={() => {
            setFormData({ ...formData, lenderName: '', amount: '', description: '', interestRate: '' });
            setIsLoanModalOpen(true);
          }}
        />
      </div>

      {/* Modal: Tambah Modal */}
      {isCapitalModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800">Catat Mutasi Modal</h3>
              <button onClick={() => setIsCapitalModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Jenis Mutasi</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                >
                  <option value="INJECTION">Injeksi Modal (Uang Masuk)</option>
                  <option value="WITHDRAWAL">Prive / Penarikan (Uang Keluar)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nominal (Rp)</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="Contoh: 10000000"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Keterangan</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Keterangan transaksi"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <button
                disabled={isSubmitting}
                onClick={() => handleAction('ADD_CAPITAL')}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Transaksi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Penyesuaian Modal Total */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-purple-600" /> Penyesuaian Modal Total
              </h3>
              <button onClick={() => setIsAdjustModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 mb-4 text-xs text-purple-800">
              <p className="font-bold mb-1">Modal Total Saat Ini: Rp {totals.currentCapital.toLocaleString('id-ID')}</p>
              <p className="text-[11px] text-purple-600">
                Masukkan nilai modal total yang sebenarnya. Sistem akan otomatis menghitung selisih dan mencatat transaksi penyesuaian secara rapi.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Target Total Modal Baru (Rp)</label>
                <input
                  type="number"
                  value={formData.targetCapital}
                  onChange={(e) => setFormData({ ...formData, targetCapital: e.target.value })}
                  placeholder="Contoh: 150000000"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Alasan Penyesuaian / Catatan</label>
                <input
                  type="text"
                  value={formData.adjustReason}
                  onChange={(e) => setFormData({ ...formData, adjustReason: e.target.value })}
                  placeholder="Contoh: Opname Modal Triwulan / Audit Kas"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <button
                disabled={isSubmitting}
                onClick={() => handleAction('ADJUST_CAPITAL')}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium text-sm transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Memproses...' : 'Simpan Penyesuaian Modal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tambah Pinjaman */}
      {isLoanModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800">Catat Pinjaman Baru</h3>
              <button onClick={() => setIsLoanModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Kreditur / Bank</label>
                <input
                  type="text"
                  value={formData.lenderName}
                  onChange={(e) => setFormData({ ...formData, lenderName: e.target.value })}
                  placeholder="Contoh: Bank BCA / Modal Ventura"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Jumlah Pinjaman (Rp)</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="Contoh: 50000000"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Bunga (% per tahun)</label>
                <input
                  type="number"
                  value={formData.interestRate}
                  onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                  placeholder="Contoh: 8"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Keterangan / Tujuan</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Tujuan pinjaman"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <button
                disabled={isSubmitting}
                onClick={() => handleAction('RECORD_LOAN')}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-medium text-sm transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Pinjaman'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Bayar Pinjaman */}
      {isRepayModalOpen && selectedLoan && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800">Bayar Pokok / Cicilan: {selectedLoan.lenderName}</h3>
              <button onClick={() => setIsRepayModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600">
                Sisa Pokok Hutang: <strong className="text-slate-800">Rp {(selectedLoan.remainingAmount || 0).toLocaleString('id-ID')}</strong>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nominal Pembayaran Pokok (Rp)</label>
                <input
                  type="number"
                  value={formData.repayAmount}
                  onChange={(e) => setFormData({ ...formData, repayAmount: e.target.value })}
                  placeholder="Contoh: 5000000"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Biaya Bunga / Administrasi (Rp, opsional)</label>
                <input
                  type="number"
                  value={formData.interestExpense}
                  onChange={(e) => setFormData({ ...formData, interestExpense: e.target.value })}
                  placeholder="Contoh: 250000"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <button
                disabled={isSubmitting}
                onClick={() => handleAction('REPAY_LOAN')}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-sm transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Memproses...' : 'Konfirmasi Pembayaran'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tambah Akun Marketplace */}
      {isAddAccountModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800">Tambah Akun Marketplace</h3>
              <button onClick={() => setIsAddAccountModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Platform</label>
                <select
                  value={formData.newPlatform}
                  onChange={(e) => setFormData({ ...formData, newPlatform: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                >
                  <option value="Shopee">Shopee</option>
                  <option value="TikTok">TikTok Shop</option>
                  <option value="Tokopedia">Tokopedia</option>
                  <option value="Lazada">Lazada</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Toko</label>
                <input
                  type="text"
                  value={formData.newStoreName}
                  onChange={(e) => setFormData({ ...formData, newStoreName: e.target.value })}
                  placeholder="Contoh: Toko Ataya Official"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <button
                disabled={isSubmitting}
                onClick={() => handleAction('ADD_MARKETPLACE_ACCOUNT')}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Menyimpan...' : 'Tambahkan Akun'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Update Saldo Marketplace */}
      {isAccountModalOpen && selectedAccount && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800">Update Saldo: {selectedAccount.name}</h3>
              <button onClick={() => setIsAccountModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Toko</label>
                <input
                  type="text"
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Saldo Aktif (Bisa Ditarik) Rp</label>
                <input
                  type="number"
                  value={formData.activeBalance}
                  onChange={(e) => setFormData({ ...formData, activeBalance: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Saldo Tertunda (Escrow / Pending) Rp</label>
                <input
                  type="number"
                  value={formData.pendingBalance}
                  onChange={(e) => setFormData({ ...formData, pendingBalance: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <button
                disabled={isSubmitting}
                onClick={() => handleAction('UPDATE_MARKETPLACE_ACCOUNT')}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Memperbarui...' : 'Simpan Saldo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
