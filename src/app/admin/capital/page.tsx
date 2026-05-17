'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { db, auth } from '@/lib/firebase';
import {
  collection, query, orderBy, onSnapshot, addDoc, serverTimestamp,
  where, getDocs, doc, setDoc, getDoc, Timestamp, deleteDoc, limit
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Landmark, Plus, CreditCard, Wallet, RefreshCcw, Save, X } from 'lucide-react';
import notify from '@/lib/notify';
import { CapitalTransaction, LoanRecord } from '@/types/finance';
import { postJournal } from '@/lib/ledger';
import * as Sentry from '@sentry/nextjs';
import { TableSkeleton } from '@/components/admin/InventorySkeleton';

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
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedAccount, setSelectedAccount] = useState<MarketplaceAccount | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<LoanRecord | null>(null);
  const [formData, setFormData] = useState({
    amount: '',
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

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.data()?.role !== 'admin') {
        notify.aksesDitolakAdmin();
      }
    });

    const unsubTx = onSnapshot(query(collection(db, 'capital_transactions'), orderBy('date', 'desc')), (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as CapitalTransaction)));
      setLoading(false);
    });

    const unsubLoans = onSnapshot(query(collection(db, 'loans'), orderBy('startDate', 'desc')), (snap) => {
      const loanList = snap.docs.map(d => ({ id: d.id, ...d.data() } as LoanRecord));
      setLoans(loanList);
      const liabilities = loanList.filter(l => l.status === 'ACTIVE').reduce((s, l) => s + (l.remainingAmount || 0), 0);
      setAssetSummary(p => ({ ...p, totalLiabilities: liabilities }));
    });

    const unsubMarketplace = onSnapshot(collection(db, 'marketplace_accounts'), (snap) => {
      setMarketplaceAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketplaceAccount)));
    });

    const unsubLogs = onSnapshot(query(collection(db, 'marketplace_transactions'), orderBy('date', 'desc'), limit(50)), (snap) => {
      setMarketplaceLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketplaceLog)));
    });

    // Asset Calculations
    const syncAssets = async () => {
      try {
        const [pSnap, oSnap, fSnap] = await Promise.all([
          getDocs(query(collection(db, 'products'), where('isActive', '==', true))),
          getDocs(query(collection(db, 'orders'), where('paymentMethod', '==', 'TEMPO'), where('status', '!=', 'LUNAS'))),
          getDoc(doc(db, 'store_settings', 'finance'))
        ]);

        let stockValue = 0;
        pSnap.forEach(d => {
          const data = d.data();
          stockValue += (Number(data.stock || 0) * Number(data.cost || data.Modal || 0));
        });

        let receivables = 0;
        oSnap.forEach(d => {
          const data = d.data();
          if (data.status !== 'DIBATALKAN') {
            receivables += (Number(data.total || 0) - Number(data.payAmount || 0));
          }
        });

        setAssetSummary(p => ({ ...p, stockValue, receivables }));
        if (fSnap.exists()) setCashBalance(Number(fSnap.data().cashBalance || 0));
      } catch (err) { Sentry.captureException(err); }
    };

    syncAssets();

    return () => {
      unsubAuth(); unsubTx(); unsubLoans(); unsubMarketplace(); unsubLogs();
    };
  }, []);

  const totals = useMemo(() => {
    const injected = transactions.filter(t => t.type === 'INJECTION').reduce((s, t) => s + t.amount, 0);
    const withdrawn = transactions.filter(t => t.type === 'WITHDRAWAL').reduce((s, t) => s + t.amount, 0);
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
          await addDoc(collection(db, 'capital_transactions'), {
            date: serverTimestamp(),
            type: formData.type,
            amount: Number(formData.amount),
            description: formData.description,
            recordedBy: auth.currentUser?.uid || 'system'
          });
          notify.success('Transaction recorded');
          setIsCapitalModalOpen(false);
          break;

        case 'RECORD_LOAN':
          await addDoc(collection(db, 'loans'), {
            lenderName: formData.lenderName,
            amount: Number(formData.amount),
            remainingAmount: Number(formData.amount),
            description: formData.description,
            loanType: formData.loanType,
            interestRate: Number(formData.interestRate),
            startDate: serverTimestamp(),
            status: 'ACTIVE'
          });
          notify.success('Loan recorded');
          setIsLoanModalOpen(false);
          break;

        case 'REPAY_LOAN':
          if (!selectedLoan) return;
          const pay = Number(formData.repayAmount);
          const exp = Number(formData.interestExpense);
          const rem = (selectedLoan.remainingAmount || 0) - pay;
          await setDoc(doc(db, 'loans', selectedLoan.id), { remainingAmount: rem, status: rem <= 0 ? 'PAID' : 'ACTIVE' }, { merge: true });
          if (exp > 0) {
            await addDoc(collection(db, 'operational_expenses'), {
              description: `Interest: ${selectedLoan.lenderName}`,
              category: 'Finance Costs',
              amount: exp,
              date: serverTimestamp()
            });
          }
          notify.success('Repayment processed');
          setIsRepayModalOpen(false);
          break;

        case 'ADD_MARKETPLACE_ACCOUNT':
          await addDoc(collection(db, 'marketplace_accounts'), {
            name: formData.newPlatform,
            storeName: formData.newStoreName,
            activeBalance: 0,
            pendingBalance: 0,
            lastUpdated: serverTimestamp()
          });
          notify.success('Account added');
          setIsAddAccountModalOpen(false);
          break;

        case 'UPDATE_MARKETPLACE_ACCOUNT':
          if (!selectedAccount) return;
          await setDoc(doc(db, 'marketplace_accounts', selectedAccount.id), {
            storeName: formData.storeName,
            activeBalance: Number(formData.activeBalance),
            pendingBalance: Number(formData.pendingBalance),
            lastUpdated: serverTimestamp()
          }, { merge: true });
          notify.success('Account updated');
          setIsAccountModalOpen(false);
          break;

        case 'WITHDRAW_MARKETPLACE':
          const acc = payload as MarketplaceAccount;
          const amount = Number(prompt(`Withdraw from ${acc.name}:`, acc.activeBalance.toString())?.replace(/\D/g, '') || 0);
          if (amount <= 0 || amount > acc.activeBalance) throw new Error('Invalid amount');
          
          await setDoc(doc(db, 'marketplace_accounts', acc.id), { activeBalance: acc.activeBalance - amount, lastUpdated: serverTimestamp() }, { merge: true });
          const cashRef = doc(db, 'store_settings', 'finance');
          const currentCash = (await getDoc(cashRef)).data()?.cashBalance || 0;
          await setDoc(cashRef, { cashBalance: currentCash + amount }, { merge: true });
          
          await addDoc(collection(db, 'capital_transactions'), {
             date: serverTimestamp(), type: 'INJECTION', amount, description: `Withdrawal ${acc.name}`, source: 'MARKETPLACE'
          });
          await postJournal({ debitAccount: 'Cash', creditAccount: 'MarketplaceBalance', amount, memo: `WD ${acc.name}` });
          notify.success('Withdrawn to cash');
          break;

        case 'DELETE_TX':
          if (confirm('Delete this record?')) await deleteDoc(doc(db, 'capital_transactions', payload));
          break;
      }
    } catch (err: any) {
      notify.error(err.message || 'Action failed');
      Sentry.captureException(err);
    } finally { setIsSubmitting(false); }
  };

  if (loading) return <div className="p-6"><TableSkeleton rows={15} /></div>;

  return (
    <div className="p-3 md:p-6 bg-[#F8FAFC] min-h-screen pb-32">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-10 gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Landmark className="text-blue-600" size={32} /> Aset & Permodalan
          </h1>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Pemantauan arus modal & aset bersih</p>
        </div>
        <div className="flex gap-3">
           <button onClick={() => setIsLoanModalOpen(true)} className="px-6 py-4 bg-white text-rose-600 border border-rose-100 rounded-2xl text-[10px] font-black tracking-widest flex items-center gap-2 hover:bg-rose-50 shadow-sm transition-all">
              <CreditCard size={18} /> CATAT HUTANG
           </button>
           <button onClick={() => { setFormData({ ...formData, type: 'INJECTION' }); setIsCapitalModalOpen(true); }} className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black tracking-widest flex items-center gap-2 hover:bg-black shadow-xl transition-all">
              <Plus size={18} /> SUNTIKAN MODAL
           </button>
        </div>
      </div>

      <CapitalSummaryCards 
        currentCapital={totals.currentCapital}
        stockValue={assetSummary.stockValue}
        receivables={assetSummary.receivables}
        totalLiabilities={assetSummary.totalLiabilities}
        growth={totals.growth}
      />

      <div className="mt-12">
        <MarketplaceWallets 
          accounts={marketplaceAccounts}
          totalAssets={totals.marketplaceAssets}
          onAddAccount={() => setIsAddAccountModalOpen(true)}
          onImport={() => notify.info('Import feature coming soon')}
          onEdit={(acc) => { setSelectedAccount(acc); setFormData({...formData, activeBalance: acc.activeBalance.toString(), pendingBalance: acc.pendingBalance.toString(), storeName: acc.storeName || ''}); setIsAccountModalOpen(true); }}
          onWithdraw={(acc) => handleAction('WITHDRAW_MARKETPLACE', acc)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-12">
         <MarketplaceLogsTable logs={marketplaceLogs} />
         <CapitalTransactionTable transactions={transactions} onDelete={(id) => handleAction('DELETE_TX', id)} />
      </div>

      <LoanSection 
        loans={loans}
        onRecord={() => setIsLoanModalOpen(true)}
        onRepay={(loan) => { setSelectedLoan(loan); setIsRepayModalOpen(true); }}
      />

      {/* Modal Overlay Components would go here - simplified for this refactor pass */}
      {isCapitalModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-xl font-black text-slate-900">Suntikan Modal</h2>
                 <button onClick={() => setIsCapitalModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl transition-all"><X size={20}/></button>
              </div>
              <div className="space-y-6">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nilai (Rp)</label>
                    <input type="number" className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50" placeholder="0" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Catatan</label>
                    <textarea className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 h-32" placeholder="Jelaskan penambahan modal ini..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                 </div>
                 <button onClick={() => handleAction('ADD_CAPITAL')} disabled={isSubmitting} className="w-full py-5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all">
                    {isSubmitting ? 'MEMPROSES...' : 'SIMPAN TRANSAKSI'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {isLoanModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-xl font-black text-slate-900">Catat Pinjaman Baru</h2>
                 <button onClick={() => setIsLoanModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl transition-all"><X size={20}/></button>
              </div>
              <div className="space-y-4">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nama Pemberi Pinjaman</label>
                    <input type="text" className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-rose-50" placeholder="Bank, Individu, dll." value={formData.lenderName} onChange={e => setFormData({...formData, lenderName: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Pokok Pinjaman (Rp)</label>
                    <input type="number" className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-rose-50" placeholder="0" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Suku Bunga (%)</label>
                    <input type="number" className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-rose-50" placeholder="0" value={formData.interestRate} onChange={e => setFormData({...formData, interestRate: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tipe Pinjaman</label>
                    <select className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-rose-50" value={formData.loanType} onChange={e => setFormData({...formData, loanType: e.target.value as 'STANDARD' | 'REKENING_KORAN'})}>
                      <option value="STANDARD">STANDARD</option>
                      <option value="REKENING_KORAN">REKENING KORAN</option>
                    </select>
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Keterangan</label>
                    <input type="text" className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-rose-50" placeholder="Catatan..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                 </div>
                 <button onClick={() => handleAction('RECORD_LOAN')} disabled={isSubmitting} className="w-full py-4 mt-2 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 shadow-xl transition-all">
                    {isSubmitting ? 'MEMPROSES...' : 'SIMPAN PINJAMAN'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {isRepayModalOpen && selectedLoan && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-8">
                 <div>
                   <h2 className="text-xl font-black text-slate-900">Bayar Cicilan</h2>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedLoan.lenderName}</p>
                 </div>
                 <button onClick={() => setIsRepayModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl transition-all"><X size={20}/></button>
              </div>
              <div className="space-y-4">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Bayar Pokok Pinjaman (Rp)</label>
                    <input type="number" className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-slate-100" placeholder="0" value={formData.repayAmount} onChange={e => setFormData({...formData, repayAmount: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Bayar Bunga / Biaya (Rp)</label>
                    <input type="number" className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-slate-100" placeholder="0" value={formData.interestExpense} onChange={e => setFormData({...formData, interestExpense: e.target.value})} />
                 </div>
                 <button onClick={() => handleAction('REPAY_LOAN')} disabled={isSubmitting} className="w-full py-4 mt-2 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black shadow-xl transition-all">
                    {isSubmitting ? 'MEMPROSES...' : 'KONFIRMASI PEMBAYARAN'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {isAddAccountModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-xl font-black text-slate-900">Tambah Akun</h2>
                 <button onClick={() => setIsAddAccountModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl transition-all"><X size={20}/></button>
              </div>
              <div className="space-y-4">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Platform</label>
                    <select className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-orange-50" value={formData.newPlatform} onChange={e => setFormData({...formData, newPlatform: e.target.value})}>
                      <option value="Shopee">Shopee</option>
                      <option value="Tokopedia">Tokopedia</option>
                      <option value="TikTok">TikTok</option>
                      <option value="Lazada">Lazada</option>
                    </select>
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nama Toko</label>
                    <input type="text" className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-orange-50" placeholder="Nama Toko" value={formData.newStoreName} onChange={e => setFormData({...formData, newStoreName: e.target.value})} />
                 </div>
                 <button onClick={() => handleAction('ADD_MARKETPLACE_ACCOUNT')} disabled={isSubmitting} className="w-full py-4 mt-2 bg-orange-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 shadow-xl transition-all">
                    {isSubmitting ? 'MEMPROSES...' : 'SIMPAN AKUN'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {isAccountModalOpen && selectedAccount && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-xl font-black text-slate-900">Edit {selectedAccount.name}</h2>
                 <button onClick={() => setIsAccountModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl transition-all"><X size={20}/></button>
              </div>
              <div className="space-y-4">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nama Toko</label>
                    <input type="text" className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-orange-50" value={formData.storeName} onChange={e => setFormData({...formData, storeName: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Saldo Aktif</label>
                    <input type="number" className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-orange-50" value={formData.activeBalance} onChange={e => setFormData({...formData, activeBalance: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Saldo Tertahan</label>
                    <input type="number" className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-orange-50" value={formData.pendingBalance} onChange={e => setFormData({...formData, pendingBalance: e.target.value})} />
                 </div>
                 <button onClick={() => handleAction('UPDATE_MARKETPLACE_ACCOUNT')} disabled={isSubmitting} className="w-full py-4 mt-2 bg-orange-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 shadow-xl transition-all">
                    {isSubmitting ? 'MEMPROSES...' : 'UPDATE AKUN'}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
