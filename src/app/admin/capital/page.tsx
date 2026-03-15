'use client';

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  where,
  getDocs,
  Timestamp,
  deleteDoc,
  doc,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import {
  Wallet,
  TrendingUp,
  ArrowUpCircle,
  ArrowDownCircle,
  Package,
  History,
  Plus,
  Minus,
  Trash2,
  Landmark,
  CreditCard,
  DollarSign,
  Save,
  Store,
  RefreshCcw,
  ExternalLink
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { CapitalTransaction, LoanRecord } from '@/types/finance';
import { postJournal } from '@/lib/ledger';

type MarketplaceAccount = {
  id: string;
  name: string;
  storeName?: string;
  activeBalance: number;
  pendingBalance: number;
  lastUpdated: any;
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
  balanceAfter?: number;
};

export default function CapitalPage() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<CapitalTransaction[]>([]);
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [assetSummary, setAssetSummary] = useState({
    stockValue: 0,
    receivables: 0,
    capitalInjected: 0,
    capitalWithdrawn: 0,
    totalLiabilities: 0
  });
  const [cashBalance, setCashBalance] = useState(0);
  const [isEditingCash, setIsEditingCash] = useState(false);
  const [tempCash, setTempCash] = useState('');
  const [marketplaceAccounts, setMarketplaceAccounts] = useState<MarketplaceAccount[]>([]);
  const [isMarketplaceModalOpen, setIsMarketplaceModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<MarketplaceAccount | null>(null);
  const [activeBalance, setActiveBalance] = useState('');
  const [pendingBalance, setPendingBalance] = useState('');
  const [storeName, setStoreName] = useState('');
  const [isAddMarketplaceModalOpen, setIsAddMarketplaceModalOpen] = useState(false);
  const [newPlatform, setNewPlatform] = useState('Shopee');
  const [newStoreName, setNewStoreName] = useState('');
  const [marketplaceLogs, setMarketplaceLogs] = useState<MarketplaceLog[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<LoanRecord | null>(null);

  const [txType, setTxType] = useState<'INJECTION' | 'WITHDRAWAL'>('INJECTION');
  
  // Loan Form State
  const [lenderName, setLenderName] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanDesc, setLoanDesc] = useState('');
  const [loanType, setLoanType] = useState<'STANDARD' | 'REKENING_KORAN'>('STANDARD');
  const [interestRate, setInterestRate] = useState('');
  const [repayAmount, setRepayAmount] = useState('');
  const [interestExpense, setInterestExpense] = useState('');

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // Handle redirect if needed
      }
    });

    // 1. Listen to Capital Transactions
    const q = query(collection(db, 'capital_transactions'), orderBy('date', 'desc'));
    const unsubTx = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CapitalTransaction));
      setTransactions(txs);
      
      const injected = txs
        .filter(t => t.type === 'INJECTION')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const withdrawn = txs
        .filter(t => t.type === 'WITHDRAWAL')
        .reduce((sum, t) => sum + t.amount, 0);

      setAssetSummary(prev => ({
        ...prev,
        capitalInjected: injected,
        capitalWithdrawn: withdrawn
      }));
      setLoading(false);
    });

    // 1.5 Listen to Loans
    const qLoans = query(collection(db, 'loans'), orderBy('startDate', 'desc'));
    const unsubLoans = onSnapshot(qLoans, (snapshot) => {
      const loanList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LoanRecord));
      setLoans(loanList);
      
      const liabilities = loanList
        .filter(l => l.status === 'ACTIVE')
        .reduce((sum, l) => sum + (l.remainingAmount || 0), 0);
        
      setAssetSummary(prev => ({ ...prev, totalLiabilities: liabilities }));
    });

    // 2. Calculate Stock Assets (Real-time is expensive, maybe fetch once or slow interval)
    const fetchStockAssets = async () => {
      try {
        // Only count assets from ACTIVE products
        const q = query(collection(db, 'products'), where('isActive', '==', true));
        const pSnapshot = await getDocs(q);
        let totalStockValue = 0;
        pSnapshot.forEach(doc => {
          const data = doc.data();
          const stock = Number(data.stock || 0);
          const cost = Number(data.cost || data.Modal || 0); // Use cost/Modal
          if (stock > 0) {
            totalStockValue += stock * cost;
          }
        });
        setAssetSummary(prev => ({ ...prev, stockValue: totalStockValue }));
      } catch (error) {
        console.error("Error fetching stock assets:", error);
      }
    };

    // 3. Calculate Receivables (Piutang)
    const fetchReceivables = async () => {
      try {
        const rSnapshot = await getDocs(query(
          collection(db, 'orders'),
          where('paymentMethod', '==', 'TEMPO'),
          where('status', '!=', 'LUNAS') // Assuming 'LUNAS' is the status for paid tempo
        ));
        
        let totalReceivables = 0;
        rSnapshot.docs.forEach(doc => {
          const data = doc.data();
          // Filter out cancelled if needed, though status check might cover it
          if (data.status === 'DIBATALKAN') return;
          
          // Logic: PayAmount is what has been paid. Total - PayAmount = Remaining
          // But usually for Tempo, payAmount might be 0 initially.
          const total = Number(data.total || 0);
          const paid = Number(data.payAmount || 0);
          const remaining = total - paid;
          if (remaining > 0) totalReceivables += remaining;
        });
        setAssetSummary(prev => ({ ...prev, receivables: totalReceivables }));
      } catch (error) {
        console.error("Error fetching receivables:", error);
      }
    };

    fetchStockAssets();
    fetchReceivables();
    
    // 4. Fetch Last Recorded Cash Balance
    getDoc(doc(db, 'store_settings', 'finance')).then(snap => {
      if (snap.exists()) {
        setCashBalance(Number(snap.data().cashBalance || 0));
      }
    });

    // 5. Fetch Marketplace Accounts
    const unsubMarketplace = onSnapshot(collection(db, 'marketplace_accounts'), (snap) => {
      if (snap.empty) {
        // Initialize if empty
        const defaults = [
          { id: 'shopee', name: 'Shopee', activeBalance: 0, pendingBalance: 0, lastUpdated: serverTimestamp() },
          { id: 'tiktok', name: 'TikTok Shop', activeBalance: 0, pendingBalance: 0, lastUpdated: serverTimestamp() },
          { id: 'tokopedia', name: 'Tokopedia', activeBalance: 0, pendingBalance: 0, lastUpdated: serverTimestamp() },
          { id: 'lazada', name: 'Lazada', activeBalance: 0, pendingBalance: 0, lastUpdated: serverTimestamp() }
        ];
        defaults.forEach(d => setDoc(doc(db, 'marketplace_accounts', d.id), d));
      } else {
        const accounts = snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketplaceAccount));
        setMarketplaceAccounts(accounts);
      }
    });
    const unsubMarketplaceLogs = onSnapshot(query(collection(db, 'marketplace_transactions'), orderBy('date', 'desc')), (snap) => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketplaceLog));
      setMarketplaceLogs(logs);
    });

    return () => {
      unsubAuth();
      unsubTx();
      unsubLoans();
      unsubMarketplace();
      unsubMarketplaceLogs();
    };
  }, []);

  const handleUpdateMarketplace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;

    setIsSubmitting(true);
    try {
      const active = Number(activeBalance.replace(/\D/g, ''));
      const pending = Number(pendingBalance.replace(/\D/g, ''));
      const activeDiff = active - (selectedAccount.activeBalance || 0);
      const pendingDiff = pending - (selectedAccount.pendingBalance || 0);
      
      await setDoc(doc(db, 'marketplace_accounts', selectedAccount.id), {
        activeBalance: active,
        pendingBalance: pending,
        storeName: storeName,
        lastUpdated: serverTimestamp()
      }, { merge: true });

      if (activeDiff !== 0 || pendingDiff !== 0) {
        await addDoc(collection(db, 'marketplace_transactions'), {
          accountId: selectedAccount.id,
          name: selectedAccount.name,
          storeName: storeName || selectedAccount.storeName || null,
          type: 'ADJUST',
          activeChange: activeDiff,
          pendingChange: pendingDiff,
          date: serverTimestamp(),
          recordedBy: auth.currentUser?.uid || 'unknown',
          note: 'Update saldo'
        });
      }

      toast.success('Saldo & Nama Toko diperbarui');
      setIsMarketplaceModalOpen(false);
      setSelectedAccount(null);
      setActiveBalance('');
      setPendingBalance('');
      setStoreName('');
    } catch (error) {
      toast.error('Gagal update data');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMarketplaceAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlatform || !newStoreName) {
      toast.error('Pilih platform dan isi nama toko');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'marketplace_accounts'), {
        name: newPlatform,
        storeName: newStoreName,
        activeBalance: 0,
        pendingBalance: 0,
        lastUpdated: serverTimestamp()
      });
      toast.success('Akun Marketplace ditambahkan');
      setIsAddMarketplaceModalOpen(false);
      setNewStoreName('');
      setNewPlatform('Shopee');
    } catch (error) {
      toast.error('Gagal menambahkan akun');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdrawMarketplace = async (acc: MarketplaceAccount) => {
    const amountStr = prompt(`Masukkan jumlah penarikan dari ${acc.name}:`, acc.activeBalance.toString());
    if (!amountStr) return;
    
    const amount = Number(amountStr.replace(/\D/g, ''));
    if (amount <= 0 || amount > acc.activeBalance) {
      toast.error('Jumlah tidak valid atau melebihi saldo');
      return;
    }

    try {
      // 1. Decrease Marketplace Balance
      await setDoc(doc(db, 'marketplace_accounts', acc.id), {
        activeBalance: acc.activeBalance - amount,
        lastUpdated: serverTimestamp()
      }, { merge: true });

      // 2. Increase Cash Balance
      // Re-fetch current cash balance first to be safe? Or rely on state?
      // State is reactive from store_settings, but let's just increment
      const currentCashRef = doc(db, 'store_settings', 'finance');
      const currentCashSnap = await getDoc(currentCashRef);
      const currentCash = currentCashSnap.exists() ? (currentCashSnap.data().cashBalance || 0) : 0;
      
      await setDoc(currentCashRef, {
        cashBalance: currentCash + amount
      }, { merge: true });

      // 3. Log Transaction
      await addDoc(collection(db, 'capital_transactions'), {
        date: serverTimestamp(),
        type: 'INJECTION', // Using INJECTION as it adds to Cash Flow (Internal Transfer)
        amount: amount,
        description: `Penarikan Saldo ${acc.name}`,
        recordedBy: auth.currentUser?.uid || 'unknown',
        source: 'MARKETPLACE_WITHDRAWAL',
        marketplaceId: acc.id
      });

      await addDoc(collection(db, 'marketplace_transactions'), {
        accountId: acc.id,
        name: acc.name,
        storeName: acc.storeName || null,
        type: 'WITHDRAWAL',
        amount: amount,
        balanceAfter: acc.activeBalance - amount,
        date: serverTimestamp(),
        recordedBy: auth.currentUser?.uid || 'unknown',
        note: 'Tarik ke Kas'
      });
      // Double-entry: Debit Cash, Credit MarketplaceBalance
      await postJournal({
        debitAccount: 'Cash',
        creditAccount: 'MarketplaceBalance',
        amount,
        memo: `Withdrawal ${acc.name}`,
        refType: 'MARKETPLACE_WITHDRAWAL',
        refId: acc.id
      });

      toast.success(`Berhasil menarik Rp${amount.toLocaleString()} ke Kas`);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memproses penarikan');
    }
  };

  const handleRecordLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lenderName || !loanAmount) return;

    setIsSubmitting(true);
    try {
      const amount = Number(loanAmount.replace(/\D/g, ''));
      await addDoc(collection(db, 'loans'), {
        lenderName,
        amount,
        remainingAmount: amount,
        description: loanDesc,
        loanType,
        interestRate: interestRate ? Number(interestRate) : 0,
        interestPeriod: 'MONTHLY', // Default monthly for now
        startDate: serverTimestamp(),
        status: 'ACTIVE'
      });
      
      // Also increase Cash Balance?
      // Optional: Maybe user wants to manually adjust cash, but logically loan increases cash.
      // Let's ask user or just do it automatically? 
      // User manual adjustment is safer for now as per previous implementation logic.
      
      toast.success('Pinjaman berhasil dicatat');
      setIsLoanModalOpen(false);
      setLenderName('');
      setLoanAmount('');
      setLoanDesc('');
      setLoanType('STANDARD');
      setInterestRate('');
    } catch (e) {
      toast.error('Gagal mencatat pinjaman');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRepayLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;
    
    setIsSubmitting(true);
    try {
      const pay = Number(repayAmount.replace(/\D/g, ''));
      const expense = Number(interestExpense.replace(/\D/g, ''));
      const newRemaining = (selectedLoan.remainingAmount || 0) - pay;
      
      if (newRemaining < 0) {
        toast.error('Jumlah bayar melebihi sisa hutang');
        setIsSubmitting(false);
        return;
      }

      const batch = setDoc(doc(db, 'loans', selectedLoan.id), {
        remainingAmount: newRemaining,
        status: newRemaining <= 0 ? 'PAID' : 'ACTIVE'
      }, { merge: true });

      // Log Expense if any
      if (expense > 0) {
        await addDoc(collection(db, 'operational_expenses'), {
          description: `Bunga Pinjaman ${selectedLoan.lenderName}`,
          category: 'Beban Bunga',
          amount: expense,
          date: serverTimestamp(),
          source: 'LOAN_INTEREST'
        });
      }
      
      await batch;

      toast.success('Pembayaran berhasil');
      setIsRepayModalOpen(false);
      setRepayAmount('');
      setInterestExpense('');
      setSelectedLoan(null);
    } catch (e) {
      toast.error('Gagal update pembayaran');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateCash = async () => {
    const val = Number(tempCash.replace(/\D/g, ''));
    try {
      await setDoc(doc(db, 'store_settings', 'finance'), { cashBalance: val }, { merge: true });
      setCashBalance(val);
      setIsEditingCash(false);
      toast.success('Saldo kas diperbarui');
    } catch (e) {
      toast.error('Gagal update kas');
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) return;
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'capital_transactions'), {
        date: serverTimestamp(),
        type: txType,
        amount: Number(amount),
        description,
        recordedBy: auth.currentUser?.uid || 'unknown'
      });
      toast.success('Transaksi berhasil dicatat');
      setIsModalOpen(false);
      setAmount('');
      setDescription('');
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyimpan data');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus riwayat modal ini?')) return;
    try {
      await deleteDoc(doc(db, 'capital_transactions', id));
      toast.success('Data dihapus');
    } catch (error) {
      toast.error('Gagal menghapus');
    }
  };

  const currentCapital = assetSummary.capitalInjected - assetSummary.capitalWithdrawn;
  const totalMarketplaceAssets = marketplaceAccounts.reduce((sum, acc) => sum + (acc.activeBalance || 0) + (acc.pendingBalance || 0), 0);
  const totalAssets = assetSummary.stockValue + assetSummary.receivables + cashBalance + totalMarketplaceAssets;
  const netWorth = totalAssets - (assetSummary.totalLiabilities || 0);
  const growth = netWorth - currentCapital;

  if (loading) return <div className="p-8 text-center">Memuat Data Modal...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Modal & Aset</h1>
          <p className="text-sm text-slate-500 font-medium">Monitoring perputaran modal dan valuasi aset toko.</p>
        </div>
        <button
          onClick={() => setIsLoanModalOpen(true)}
          className="bg-rose-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-rose-700 transition-all flex items-center gap-2 shadow-lg shadow-rose-200"
        >
          <CreditCard size={18} /> Catat Hutang
        </button>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg shadow-slate-200"
        >
          <Plus size={18} /> Catat Modal
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Modal Bersih */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Landmark size={80} />
          </div>
          <div className="flex items-center gap-3 mb-4 relative z-10">
            <div className="p-2.5 bg-slate-100 text-slate-600 rounded-2xl">
              <Landmark size={20} />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Modal Disetor</span>
          </div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight relative z-10">
            Rp{currentCapital.toLocaleString('id-ID')}
          </h3>
        </div>

        {/* Aset Stok */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Package size={80} />
          </div>
          <div className="flex items-center gap-3 mb-4 relative z-10">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
              <Package size={20} />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Aset Stok</span>
          </div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight relative z-10">
            Rp{assetSummary.stockValue.toLocaleString('id-ID')}
          </h3>
        </div>

        {/* Piutang */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <CreditCard size={80} />
          </div>
          <div className="flex items-center gap-3 mb-4 relative z-10">
            <div className="p-2.5 bg-orange-50 text-orange-600 rounded-2xl">
              <CreditCard size={20} />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Piutang</span>
          </div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight relative z-10">
            Rp{assetSummary.receivables.toLocaleString('id-ID')}
          </h3>
        </div>

        {/* Hutang (Liabilitas) */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <ArrowDownCircle size={80} className="text-rose-200" />
          </div>
          <div className="flex items-center gap-3 mb-4 relative z-10">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-2xl">
              <ArrowDownCircle size={20} />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Hutang</span>
          </div>
          <h3 className="text-2xl font-black text-rose-600 tracking-tight relative z-10">
            Rp{assetSummary.totalLiabilities?.toLocaleString('id-ID') || 0}
          </h3>
        </div>

        {/* Pertumbuhan / Growth */}
        <div className={`p-6 rounded-[2rem] border shadow-sm relative overflow-hidden group hover:shadow-md transition-all ${growth >= 0 ? 'bg-emerald-600 border-emerald-500' : 'bg-rose-600 border-rose-500'}`}>
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp size={80} className="text-white" />
          </div>
          <div className="flex items-center gap-3 mb-4 relative z-10">
            <div className="p-2.5 bg-white/20 text-white rounded-2xl backdrop-blur-sm">
              <TrendingUp size={20} />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-white/80">Valuasi & Profit</span>
          </div>
          <h3 className="text-2xl font-black text-white tracking-tight relative z-10">
            {growth >= 0 ? '+' : ''}Rp{growth.toLocaleString('id-ID')}
          </h3>
          <p className="text-xs font-medium text-white/80 mt-1 relative z-10">
            Net Worth - Modal
          </p>
        </div>
      </div>

      {/* Marketplace & E-Wallets Section */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
           <div className="flex items-center gap-3">
             <div className="p-2.5 bg-purple-50 text-purple-600 rounded-2xl">
               <Store size={20} />
             </div>
             <div>
               <h3 className="text-lg font-bold text-slate-800">Dompet Marketplace</h3>
               <p className="text-xs text-slate-500 font-medium">Monitoring saldo aktif dan tertahan di e-commerce.</p>
             </div>
           </div>
           <div className="text-right flex flex-col items-end gap-2">
             <div>
               <p className="text-xs font-black uppercase tracking-widest text-slate-400">Total Aset Digital</p>
               <p className="text-xl font-black text-purple-600">Rp{totalMarketplaceAssets.toLocaleString('id-ID')}</p>
             </div>
             <button
               onClick={() => setIsAddMarketplaceModalOpen(true)}
               className="bg-purple-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-700 transition-all flex items-center gap-2 shadow-lg shadow-purple-200"
             >
               <Plus size={14} /> Tambah Akun
             </button>
             <button
               onClick={() => setIsImportModalOpen(true)}
               className="bg-white text-purple-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-50 transition-all flex items-center gap-2 border border-purple-200"
             >
               Import Settlement
             </button>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {marketplaceAccounts.map((acc) => (
            <div key={acc.id} className="border border-slate-100 rounded-2xl p-5 hover:shadow-md transition-all group relative overflow-hidden bg-white">
               <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                 <Store size={60} />
               </div>
               
               <div className="flex justify-between items-start mb-4 relative z-10">
                 <div>
                    <h4 className="font-bold text-slate-800 text-sm">{acc.name}</h4>
                    {acc.storeName && (
                      <p className="text-[10px] font-black text-purple-600 uppercase tracking-wide mt-0.5">{acc.storeName}</p>
                    )}
                 </div>
                 <button 
                   onClick={() => {
                     setSelectedAccount(acc);
                     setActiveBalance(acc.activeBalance.toString());
                     setPendingBalance(acc.pendingBalance.toString());
                     setStoreName(acc.storeName || '');
                     setIsMarketplaceModalOpen(true);
                   }}
                   className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all"
                 >
                   <RefreshCcw size={14} />
                 </button>
               </div>

               <div className="space-y-3 relative z-10">
                 <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Saldo Aktif (Siap Tarik)</p>
                   <div className="flex items-center justify-between">
                     <p className="text-lg font-black text-emerald-600">Rp{acc.activeBalance.toLocaleString('id-ID')}</p>
                     {acc.activeBalance > 0 && (
                       <button 
                         onClick={() => handleWithdrawMarketplace(acc)}
                         className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1"
                       >
                         <ExternalLink size={10} /> Tarik
                       </button>
                     )}
                   </div>
                 </div>
                 
                 <div className="pt-3 border-t border-dashed border-slate-100">
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Dana Tertahan (Pending)</p>
                   <p className="text-sm font-black text-slate-600">Rp{acc.pendingBalance.toLocaleString('id-ID')}</p>
                 </div>
               </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden h-fit">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                <Store size={18} />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Riwayat Dompet Marketplace</h3>
            </div>
          </div>
          <div className="flex-1 overflow-auto max-h-[500px]">
            {marketplaceLogs.length === 0 ? (
              <div className="p-10 text-center text-slate-400">Belum ada riwayat.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/50 sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Tanggal</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Akun</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Tipe</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Jumlah</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Ket</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {marketplaceLogs.map((lg) => {
                    const dateObj = lg.date ? (lg.date instanceof Timestamp ? lg.date.toDate() : new Date(lg.date)) : null;
                    const isAdjust = lg.type === 'ADJUST';
                    const adjustText =
                      isAdjust
                        ? `Aktif: ${((lg.activeChange || 0) >= 0 ? '+' : '') + (lg.activeChange || 0).toLocaleString('id-ID')} | Pending: ${((lg.pendingChange || 0) >= 0 ? '+' : '') + (lg.pendingChange || 0).toLocaleString('id-ID')}`
                        : '';
                    const amountText = !isAdjust ? (lg.amount || 0).toLocaleString('id-ID') : '';
                    const amountClass = lg.type === 'WITHDRAWAL' ? 'text-rose-600' : 'text-emerald-600';
                    return (
                      <tr key={lg.id} className="group hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-slate-700">
                            {dateObj ? dateObj.toLocaleDateString('id-ID') : '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-800">{lg.name}</span>
                            {lg.storeName && <span className="text-[10px] font-black text-purple-600 uppercase">{lg.storeName}</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{lg.type}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`text-xs font-black ${amountClass}`}>{lg.type === 'WITHDRAWAL' ? '-' : '+'} {amountText}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-bold text-slate-600">{isAdjust ? adjustText : (lg.note || '')}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
        
        {/* Left: Transaction History */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden h-fit">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 text-slate-600 rounded-xl">
                <History size={18} />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Riwayat Transaksi Modal</h3>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto max-h-[500px]">
            {transactions.length === 0 ? (
              <div className="p-10 text-center text-slate-400">Belum ada riwayat modal.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/50 sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Tanggal</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Ket</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Jumlah</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="group hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-700">
                             {tx.date ? (tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date)).toLocaleDateString('id-ID') : '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                           <div className={`p-1.5 rounded-lg ${tx.type === 'INJECTION' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                             {tx.type === 'INJECTION' ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}
                           </div>
                           <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]" title={tx.description}>{tx.description}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`text-xs font-black ${tx.type === 'INJECTION' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {tx.type === 'INJECTION' ? '+' : '-'} {tx.amount.toLocaleString('id-ID')}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button 
                          onClick={() => handleDelete(tx.id)}
                          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Loan Management */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden h-fit">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <CreditCard size={18} />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Daftar Hutang Aktif</h3>
            </div>
          </div>

          <div className="flex-1 overflow-auto max-h-[500px]">
            {loans.length === 0 ? (
              <div className="p-10 text-center text-slate-400">Tidak ada hutang aktif.</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {loans.map((loan) => (
                  <div key={loan.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center group">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                         <h4 className="font-bold text-sm text-slate-800">{loan.lenderName}</h4>
                         {loan.status === 'PAID' && <span className="bg-green-100 text-green-600 text-[10px] px-2 py-0.5 rounded-full font-bold">LUNAS</span>}
                         {loan.loanType === 'REKENING_KORAN' && <span className="bg-blue-100 text-blue-600 text-[10px] px-2 py-0.5 rounded-full font-bold">KUR/RK</span>}
                      </div>
                      <p className="text-xs text-slate-500">{loan.description || 'Pinjaman Dana'}</p>
                      <span className="text-[10px] text-slate-400">
                        {loan.startDate ? (loan.startDate instanceof Timestamp ? loan.startDate.toDate() : new Date(loan.startDate)).toLocaleDateString('id-ID') : '-'}
                      </span>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-400 line-through decoration-rose-500/50">
                        Rp{loan.amount.toLocaleString('id-ID')}
                      </p>
                      <p className="text-sm font-black text-rose-600">
                        Rp{loan.remainingAmount.toLocaleString('id-ID')}
                      </p>
                      {loan.status === 'ACTIVE' && (
                        <button
                          onClick={() => { setSelectedLoan(loan); setIsRepayModalOpen(true); }}
                          className="mt-2 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Bayar Cicilan
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom: Info / Helper (Full Width) */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="bg-indigo-600 text-white p-6 rounded-[2rem] shadow-xl shadow-indigo-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Landmark size={100} />
              </div>
              <h3 className="text-lg font-black mb-2 relative z-10">Tips Kelola Modal</h3>
              <p className="text-xs font-medium text-indigo-100 leading-relaxed relative z-10 mb-4">
                Catat setiap penambahan modal (dari investor/pribadi) dan penarikan modal (prive/dividen) agar perhitungan profitabilitas akurat.
              </p>
              <div className="space-y-2 relative z-10">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-50 bg-indigo-500/50 p-2 rounded-xl">
                  <ArrowUpCircle size={14} />
                  <span>Injection: Tambah uang ke kas toko</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-50 bg-indigo-500/50 p-2 rounded-xl">
                  <ArrowDownCircle size={14} />
                  <span>Withdrawal: Ambil uang untuk pribadi</span>
                </div>
              </div>
           </div>

           <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
             <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
               <DollarSign size={16} className="text-slate-400"/>
               Estimasi Kekayaan Bersih
             </h3>
             <div className="space-y-3">
               <div className="flex justify-between text-xs items-center">
                 <span className="text-slate-500">Saldo Kas & Bank (Manual)</span>
                 {isEditingCash ? (
                   <div className="flex items-center gap-1">
                     <input 
                       autoFocus
                       type="text" 
                       className="w-24 text-right border-b border-slate-300 outline-none text-xs font-bold"
                       value={tempCash}
                       onChange={e => setTempCash(e.target.value)}
                       placeholder="Rp0"
                     />
                     <button onClick={handleUpdateCash} className="text-emerald-600"><Save size={14} /></button>
                   </div>
                 ) : (
                   <span 
                     onClick={() => { setTempCash(cashBalance.toString()); setIsEditingCash(true); }}
                     className="font-bold text-slate-800 border-b border-dashed border-slate-300 cursor-pointer hover:text-blue-600"
                   >
                     Rp{cashBalance.toLocaleString()}
                   </span>
                 )}
               </div>
               <div className="flex justify-between text-xs">
                 <span className="text-slate-500">Total Aset (Stok + Piutang + Kas)</span>
                 <span className="font-bold text-slate-800">Rp{totalAssets.toLocaleString()}</span>
               </div>
               <div className="flex justify-between text-xs">
                 <span className="text-slate-500">Total Liabilitas (Hutang)</span>
                 <span className="font-bold text-rose-600">- Rp{(assetSummary.totalLiabilities || 0).toLocaleString()}</span>
               </div>
               <div className="flex justify-between text-xs">
                 <span className="text-slate-500">Modal Disetor</span>
                 <span className="font-bold text-slate-800">- Rp{currentCapital.toLocaleString()}</span>
               </div>
               <div className="h-px bg-slate-100 my-2"></div>
               <div className="flex justify-between text-sm font-black">
                 <span className="text-slate-600">Selisih (Profit Akumulasi)</span>
                 <span className={growth >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                   {growth >= 0 ? '+' : ''}Rp{growth.toLocaleString()}
                 </span>
               </div>
               <p className="text-[10px] text-slate-400 mt-2 italic">
                 *Pastikan update Saldo Kas & Bank secara berkala agar perhitungan akurat.
               </p>
             </div>
           </div>
        </div>

      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
              <Landmark className="text-slate-400" />
              Catat Transaksi Modal
            </h2>
            
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTxType('INJECTION')}
                  className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all ${txType === 'INJECTION' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Tambah Modal
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('WITHDRAWAL')}
                  className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all ${txType === 'WITHDRAWAL' ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Tarik Modal
                </button>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jumlah (Rp)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full text-2xl font-black text-slate-800 border-b-2 border-slate-100 focus:border-slate-800 outline-none py-2 bg-transparent placeholder:text-slate-200"
                  placeholder="0"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Keterangan</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Contoh: Setoran Awal, Prive Bulan Ini..."
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !amount || !description}
                  className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Loan Modal Form */}
      {isLoanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
              <CreditCard className="text-slate-400" />
              Catat Hutang Baru
            </h2>
            
            <form onSubmit={handleRecordLoan} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jenis Pinjaman</label>
                <div className="flex bg-slate-100 p-1 rounded-xl mb-2">
                  <button
                    type="button"
                    onClick={() => setLoanType('STANDARD')}
                    className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all ${loanType === 'STANDARD' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Pinjaman Biasa
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoanType('REKENING_KORAN')}
                    className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all ${loanType === 'REKENING_KORAN' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Rekening Koran (KUR)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pemberi Pinjaman (Bank/Perorangan)</label>
                <input
                  type="text"
                  value={lenderName}
                  onChange={e => setLenderName(e.target.value)}
                  className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Contoh: Bank BRI, Bpk. Budi"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Limit / Jumlah (Rp)</label>
                  <input
                    type="number"
                    value={loanAmount}
                    onChange={e => setLoanAmount(e.target.value)}
                    className="w-full text-xl font-black text-slate-800 border-b-2 border-slate-100 focus:border-slate-800 outline-none py-2 bg-transparent"
                    placeholder="0"
                  />
                </div>
                {loanType === 'REKENING_KORAN' && (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bunga (% per Tahun)</label>
                    <input
                      type="number"
                      value={interestRate}
                      onChange={e => setInterestRate(e.target.value)}
                      className="w-full text-xl font-black text-blue-600 border-b-2 border-slate-100 focus:border-blue-600 outline-none py-2 bg-transparent"
                      placeholder="0"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Keterangan (Opsional)</label>
                <input
                  type="text"
                  value={loanDesc}
                  onChange={e => setLoanDesc(e.target.value)}
                  className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Contoh: Modal Usaha Tambahan"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsLoanModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !lenderName || !loanAmount}
                  className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Repay Modal Form */}
      {isRepayModalOpen && selectedLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-slate-800 mb-2 flex items-center gap-2">
              <CreditCard className="text-slate-400" />
              Bayar Cicilan Hutang
            </h2>
            <p className="text-xs text-slate-500 mb-6 font-bold uppercase tracking-widest">
              {selectedLoan.lenderName} • Sisa: Rp{selectedLoan.remainingAmount.toLocaleString()}
              {selectedLoan.loanType === 'REKENING_KORAN' && selectedLoan.interestRate && (
                <span className="block text-blue-600 normal-case mt-1">Bunga {selectedLoan.interestRate}% / Tahun</span>
              )}
            </p>
            
            <form onSubmit={handleRepayLoan} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bayar Pokok (Rp)</label>
                  <input
                    type="number"
                    value={repayAmount}
                    onChange={e => setRepayAmount(e.target.value)}
                    className="w-full text-xl font-black text-slate-800 border-b-2 border-slate-100 focus:border-slate-800 outline-none py-2 bg-transparent"
                    placeholder="0"
                    autoFocus
                  />
                </div>
                {selectedLoan.loanType === 'REKENING_KORAN' && (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bayar Bunga (Rp)</label>
                    <input
                      type="number"
                      value={interestExpense}
                      onChange={e => setInterestExpense(e.target.value)}
                      className="w-full text-xl font-black text-rose-600 border-b-2 border-slate-100 focus:border-rose-600 outline-none py-2 bg-transparent"
                      placeholder="0"
                    />
                  </div>
                )}
              </div>

              <div className="bg-blue-50 p-3 rounded-xl text-xs text-blue-700 font-medium">
                 {selectedLoan.loanType === 'REKENING_KORAN' 
                   ? 'Pembayaran Bunga akan dicatat sebagai Pengeluaran Operasional (Beban Bunga) dan mengurangi kas, namun tidak mengurangi pokok hutang.' 
                   : 'Pembayaran akan mengurangi saldo sisa hutang dan dianggap sebagai pengeluaran kas.'}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsRepayModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !repayAmount}
                  className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 disabled:opacity-50"
                >
                  {isSubmitting ? 'Memproses...' : 'Bayar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Marketplace Modal Form */}
      {isMarketplaceModalOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
              <Store className="text-slate-400" />
              Update Saldo {selectedAccount.name}
            </h2>
            
            <form onSubmit={handleUpdateMarketplace} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Toko (Opsional)</label>
                <input
                  type="text"
                  value={storeName}
                  onChange={e => setStoreName(e.target.value)}
                  className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Contoh: Toko Cabang 1"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Saldo Aktif (Siap Tarik)</label>
                <input
                  type="number"
                  value={activeBalance}
                  onChange={e => setActiveBalance(e.target.value)}
                  className="w-full text-2xl font-black text-emerald-600 border-b-2 border-slate-100 focus:border-emerald-600 outline-none py-2 bg-transparent placeholder:text-slate-200"
                  placeholder="0"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Saldo Tertahan (Pending)</label>
                <input
                  type="number"
                  value={pendingBalance}
                  onChange={e => setPendingBalance(e.target.value)}
                  className="w-full text-xl font-black text-slate-600 border-b-2 border-slate-100 focus:border-slate-600 outline-none py-2 bg-transparent placeholder:text-slate-200"
                  placeholder="0"
                />
              </div>

              <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-500 font-medium">
                <p>Update saldo sesuai dengan yang tertera di aplikasi marketplace. Perubahan ini akan mempengaruhi Total Aset Digital.</p>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsMarketplaceModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Update Saldo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Add Marketplace Modal Form */}
      {isAddMarketplaceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
              <Plus className="text-slate-400" />
              Tambah Akun Marketplace
            </h2>
            
            <form onSubmit={handleAddMarketplaceAccount} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Platform</label>
                <select
                  value={newPlatform}
                  onChange={e => setNewPlatform(e.target.value)}
                  className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <option value="Shopee">Shopee</option>
                  <option value="TikTok Shop">TikTok Shop</option>
                  <option value="Tokopedia">Tokopedia</option>
                  <option value="Lazada">Lazada</option>
                  <option value="Blibli">Blibli</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Toko</label>
                <input
                  type="text"
                  value={newStoreName}
                  onChange={e => setNewStoreName(e.target.value)}
                  className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Contoh: Toko Cabang 2"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsAddMarketplaceModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newStoreName}
                  className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Tambah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
  {/* Import Settlement Modal */}
  {isImportModalOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl p-6">
        <h2 className="text-xl font-black text-slate-800 mb-4">Import Settlement Marketplace (CSV)</h2>
        <p className="text-xs text-slate-500 mb-4">Format kolom: accountId,name,storeName,active_change,pending_change,fee,payout</p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setImportFile(e.target.files?.[0] || null)}
          className="w-full p-3 bg-slate-50 rounded-xl mb-4"
        />
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setIsImportModalOpen(false)}
            className="py-2 px-4 bg-slate-100 text-slate-600 font-bold rounded-xl"
          >
            Batal
          </button>
          <button
            onClick={async () => {
              if (!importFile) { toast.error('Pilih file CSV dulu'); return; }
              setIsSubmitting(true);
              try {
                const text = await importFile.text();
                const lines = text.split(/\\r?\\n/).filter(l => l.trim().length > 0);
                const [header, ...rows] = lines;
                const cols = header.split(',').map(c => c.trim().toLowerCase());
                const idx: Record<string, number> = {
                  accountId: cols.indexOf('accountid'),
                  name: cols.indexOf('name'),
                  storeName: cols.indexOf('storename'),
                  active: cols.indexOf('active_change'),
                  pending: cols.indexOf('pending_change'),
                  fee: cols.indexOf('fee'),
                  payout: cols.indexOf('payout'),
                } as any;
                for (const row of rows) {
                  const cells = row.split(',').map(c => c.trim());
                  const accountId = idx.accountId >= 0 ? cells[idx.accountId] : '';
                  const name = idx.name >= 0 ? cells[idx.name] : '';
                  const storeName = idx.storeName >= 0 ? cells[idx.storeName] : '';
                  const activeDelta = idx.active >= 0 ? Number(cells[idx.active] || 0) : 0;
                  const pendingDelta = idx.pending >= 0 ? Number(cells[idx.pending] || 0) : 0;
                  const fee = idx.fee >= 0 ? Number(cells[idx.fee] || 0) : 0;
                  const payout = idx.payout >= 0 ? Number(cells[idx.payout] || 0) : 0;

                  // Ensure account exists
                  const accKey = accountId || name.toLowerCase();
                  const accRef = doc(db, 'marketplace_accounts', accKey);
                  const accSnap = await getDoc(accRef);
                  const accData = accSnap.data() || { name: name || accKey, activeBalance: 0, pendingBalance: 0 };

                  // Apply active/pending adjustments
                  let nextActive = Number(accData.activeBalance || 0) + (activeDelta || 0);
                  let nextPending = Number(accData.pendingBalance || 0) + (pendingDelta || 0);
                  if (fee > 0) nextActive = Math.max(0, nextActive - fee);
                  if (payout > 0) nextActive = Math.max(0, nextActive - payout);

                  await setDoc(accRef, {
                    name: name || accKey,
                    storeName: storeName || null,
                    activeBalance: nextActive,
                    pendingBalance: nextPending,
                    lastUpdated: serverTimestamp()
                  }, { merge: true });

                  // Log adjust
                  if ((activeDelta || 0) !== 0 || (pendingDelta || 0) !== 0) {
                    await addDoc(collection(db, 'marketplace_transactions'), {
                      accountId: accKey,
                      name: name || accKey,
                      storeName: storeName || null,
                      type: 'ADJUST',
                      activeChange: activeDelta || 0,
                      pendingChange: pendingDelta || 0,
                      date: serverTimestamp(),
                      recordedBy: auth.currentUser?.uid || 'import',
                      note: 'Import Settlement'
                    });
                  }
                  if (fee > 0) {
                    await addDoc(collection(db, 'marketplace_transactions'), {
                      accountId: accKey,
                      name: name || accKey,
                      storeName: storeName || null,
                      type: 'WITHDRAWAL',
                      amount: fee,
                      date: serverTimestamp(),
                      recordedBy: auth.currentUser?.uid || 'import',
                      note: 'Biaya Platform'
                    });
                    await addDoc(collection(db, 'operational_expenses'), {
                      title: `Biaya Platform ${name || accKey}`,
                      amount: fee,
                      type: 'expense',
                      category: 'Marketplace Fee',
                      createdAt: serverTimestamp()
                    });
                    // Double-entry: Debit MarketplaceFeeExpense, Credit MarketplaceBalance
                    await postJournal({
                      debitAccount: 'MarketplaceFeeExpense',
                      creditAccount: 'MarketplaceBalance',
                      amount: fee,
                      memo: `Biaya platform ${name || accKey}`,
                      refType: 'MARKETPLACE_FEE',
                      refId: accKey
                    });
                  }
                  if (payout > 0) {
                    // Tambah kas
                    const cashRef = doc(db, 'store_settings', 'finance');
                    const cashSnap = await getDoc(cashRef);
                    const cash = cashSnap.exists() ? (cashSnap.data().cashBalance || 0) : 0;
                    await setDoc(cashRef, { cashBalance: cash + payout }, { merge: true });
                    // Modal injection & log
                    await addDoc(collection(db, 'capital_transactions'), {
                      date: serverTimestamp(),
                      type: 'INJECTION',
                      amount: payout,
                      description: `Settlement ${name || accKey}`,
                      recordedBy: auth.currentUser?.uid || 'import',
                      source: 'MARKETPLACE_SETTLEMENT',
                      marketplaceId: accKey
                    });
                    await addDoc(collection(db, 'marketplace_transactions'), {
                      accountId: accKey,
                      name: name || accKey,
                      storeName: storeName || null,
                      type: 'WITHDRAWAL',
                      amount: payout,
                      date: serverTimestamp(),
                      recordedBy: auth.currentUser?.uid || 'import',
                      note: 'Settlement Payout'
                    });
                    // Double-entry: Debit Cash, Credit MarketplaceBalance
                    await postJournal({
                      debitAccount: 'Cash',
                      creditAccount: 'MarketplaceBalance',
                      amount: payout,
                      memo: `Settlement ${name || accKey}`,
                      refType: 'MARKETPLACE_SETTLEMENT',
                      refId: accKey
                    });
                  }
                }
                toast.success('Import selesai');
                setIsImportModalOpen(false);
                setImportFile(null);
              } catch (err) {
                console.error(err);
                toast.error('Gagal import CSV');
              } finally {
                setIsSubmitting(false);
              }
            }}
            className="py-2 px-4 bg-purple-600 text-white font-bold rounded-xl"
          >
            Proses CSV
          </button>
        </div>
      </div>
    </div>
  )}
    </div>
  );
}
