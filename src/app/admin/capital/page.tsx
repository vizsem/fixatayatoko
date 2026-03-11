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
  Save
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { CapitalTransaction, LoanRecord } from '@/types/finance';

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
        const pSnapshot = await getDocs(collection(db, 'products'));
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

    return () => {
      unsubAuth();
      unsubTx();
      unsubLoans();
    };
  }, []);

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
  const totalAssets = assetSummary.stockValue + assetSummary.receivables + cashBalance;
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

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
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
    </div>
  );
}
