'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, doc, updateDoc, addDoc, query, orderBy, Timestamp, serverTimestamp, getDocs, limit, startAfter, runTransaction, arrayUnion, getDoc
} from 'firebase/firestore';
import Link from 'next/link';
import notify from '@/lib/notify';
import { postJournal } from '@/lib/ledger';
import { Toaster } from 'react-hot-toast';
import { ShoppingBag, Plus, CreditCard, Package, Search, ChevronRight, Calendar, Clock, CheckCircle2, XCircle, Filter, Download, User, ArrowRight, X, Info } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { TableSkeleton } from '@/components/admin/InventorySkeleton';
import { Purchase, ProductItem } from '@/lib/types';
import * as XLSX from 'xlsx';

export default function AdminPurchases() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);

  const fetchPurchases = useCallback(async (isMore = false) => {
    try {
      if (isMore) setLoadingMore(true);
      else setLoading(true);

      const q = isMore && lastDoc 
        ? query(collection(db, 'purchases'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(20))
        : query(collection(db, 'purchases'), orderBy('createdAt', 'desc'), limit(20));

      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate().toISOString() : new Date().toISOString()
      } as Purchase));

      if (isMore) setPurchases(prev => [...prev, ...list]);
      else setPurchases(list);

      setLastDoc(snapshot.docs[snapshot.docs.length - 1] ?? null);
    } catch (err) {
      Sentry.captureException(err);
      notify.error("Gagal memuat data pembelian");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [lastDoc]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push('/profil/login');
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.data()?.role !== 'admin' && userDoc.data()?.role !== 'owner') {
        notify.aksesDitolakAdmin();
        return router.push('/profil');
      }
      fetchPurchases();
    });
    return () => unsubAuth();
  }, [router, fetchPurchases]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      const matchesSearch = p.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) || p.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchesPayment = paymentFilter === 'all' || p.paymentStatus === paymentFilter;
      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [purchases, searchTerm, statusFilter, paymentFilter]);

  const updatePurchaseStatus = async (id: string, newStatus: Purchase['status']) => {
    const confirmMsg = newStatus === 'DITERIMA' ? 'Konfirmasi barang diterima? Stok akan bertambah.' : 'Batalkan transaksi ini?';
    if (!confirm(confirmMsg)) return;

    const t = notify.admin.loading(newStatus === 'DITERIMA' ? 'Memproses konfirmasi...' : 'Membatalkan...');
    try {
      await runTransaction(db, async (tx) => {
        const keyRef = doc(db, 'action_keys', `purchase:${id}:${newStatus}`);
        if ((await tx.get(keyRef)).exists()) throw new Error('Sudah diproses');

        const pRef = doc(db, 'purchases', id);
        const pSnap = await tx.get(pRef);
        if (!pSnap.exists()) throw new Error('Not found');
        const pData = pSnap.data() as Purchase;

        if (pData.status !== 'MENUNGGU') throw new Error('Status bukan MENUNGGU');

        if (newStatus === 'DITERIMA') {
          for (const item of pData.items) {
            const productRef = doc(db, 'products', item.id);
            const prodSnap = await tx.get(productRef);
            if (prodSnap.exists()) {
              const curData = prodSnap.data();
              const currentStock = Number(curData.stock || 0);
              const conv = Number(item.conversion || 1);
              const incomingPcs = item.quantity * conv;
              const newStock = currentStock + incomingPcs;
              
              const currentCost = Number(curData.Modal || curData.purchasePrice || 0);
              const incomingCost = conv > 0 ? (item.purchasePrice / conv) : item.purchasePrice;
              const nextAvgCost = currentStock === 0 ? Math.round(incomingCost) : Math.round(((currentStock * currentCost) + (item.quantity * item.purchasePrice)) / newStock);

              const whKey = pData.warehouseId || 'gudang-utama';
              const nextWH = { ...(curData.stockByWarehouse || {}) };
              nextWH[whKey] = (nextWH[whKey] || 0) + incomingPcs;

              tx.update(productRef, {
                stock: newStock,
                stockByWarehouse: nextWH,
                Modal: nextAvgCost,
                updatedAt: serverTimestamp(),
                inventoryLayers: arrayUnion({
                  qty: incomingPcs,
                  costPerPcs: incomingCost,
                  ts: Timestamp.now(),
                  purchaseId: id,
                  supplierName: pData.supplierName,
                  warehouseId: whKey
                })
              });

              tx.set(doc(collection(db, 'inventory_logs')), {
                productId: item.id,
                productName: curData.name || 'Produk',
                type: 'MASUK',
                amount: incomingPcs,
                adminId: auth.currentUser?.uid,
                source: 'PURCHASE',
                note: `PO #${id}`,
                toWarehouseId: whKey,
                prevStock: currentStock,
                nextStock: newStock,
                date: serverTimestamp()
              });
            }
          }

          await postJournal({
            debitAccount: 'Inventory',
            creditAccount: pData.paymentStatus === 'LUNAS' ? 'Cash' : 'AccountsPayable',
            amount: pData.total,
            memo: `Penerimaan Barang PO #${id}`,
            refType: 'PURCHASE',
            refId: id
          }, tx);
        } else if (newStatus === 'DIBATALKAN' && pData.paymentStatus === 'LUNAS') {
            tx.set(doc(collection(db, 'capital_transactions')), {
              date: serverTimestamp(),
              type: 'INJECTION',
              amount: pData.total,
              description: `Refund PO #${id}`,
              recordedBy: auth.currentUser?.uid,
              referenceId: id,
              source: 'PURCHASE_CANCEL'
            });
        }

        tx.update(pRef, { status: newStatus, updatedAt: serverTimestamp() });
        tx.set(keyRef, { createdAt: serverTimestamp(), by: auth.currentUser?.uid });
      });

      notify.admin.success('Berhasil diperbarui!', { id: t });
      fetchPurchases();
    } catch (err: any) {
      Sentry.captureException(err);
      notify.admin.error(err.message || 'Gagal update status', { id: t });
    }
  };

  const handlePayment = async (purchaseId: string, amount: number) => {
    const t = notify.admin.loading("Memproses pembayaran...");
    try {
      await runTransaction(db, async (tx) => {
        const pRef = doc(db, 'purchases', purchaseId);
        const pSnap = await tx.get(pRef);
        if (!pSnap.exists()) throw new Error('Not found');
        const pData = pSnap.data() as Purchase;
        const newPaid = (pData.paidAmount || 0) + amount;
        const lunas = newPaid >= pData.total;

        tx.update(pRef, {
          paymentStatus: lunas ? 'LUNAS' : 'HUTANG',
          paidAmount: newPaid,
          updatedAt: serverTimestamp()
        });

        await postJournal({
          debitAccount: 'AccountsPayable',
          creditAccount: 'Cash',
          amount,
          memo: `Bayar PO #${purchaseId}`,
          refType: 'PURCHASE_PAYMENT',
          refId: purchaseId
        }, tx);
      });
      notify.admin.success("Pembayaran berhasil!", { id: t });
      setPaymentModalOpen(false);
      fetchPurchases();
    } catch (err: any) {
      Sentry.captureException(err);
      notify.admin.error("Gagal bayar", { id: t });
    }
  };

  const handleExport = () => {
    const data = filteredPurchases.map(p => ({
      ID: p.id,
      Tanggal: format(new Date(p.createdAt), 'Pp'),
      Supplier: p.supplierName,
      Total: p.total,
      Status: p.status,
      Pembayaran: p.paymentStatus
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Purchases");
    XLSX.writeFile(wb, `Purchases_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  if (loading) return <div className="p-6"><TableSkeleton rows={10} /></div>;

  return (
    <div className="p-3 md:p-6 bg-[#F8FAFC] min-h-screen pb-32">
      <Toaster position="top-right" />

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-10 gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <ShoppingBag className="text-blue-600" size={32} /> Supply Chain
          </h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] mt-1">Purchase order management</p>
        </div>
        
        <div className="flex items-center gap-3">
           <button onClick={handleExport} className="p-4 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-emerald-600 transition-all shadow-sm">
             <Download size={20} />
           </button>
           <Link href="/admin/purchases/add" className="bg-slate-900 text-white px-8 py-4 rounded-2xl text-[10px] font-black tracking-widest flex items-center gap-2 hover:bg-black shadow-xl active:scale-95 transition-all">
             <Plus size={18} /> NEW PURCHASE
           </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat label="Pending PO" val={purchases.filter(p => p.status === 'MENUNGGU').length} color="text-amber-600" bg="bg-amber-50" />
        <Stat label="Received" val={purchases.filter(p => p.status === 'DITERIMA').length} color="text-emerald-600" bg="bg-emerald-50" />
        <Stat label="Accounts Payable" val={`Rp ${purchases.filter(p => p.paymentStatus === 'HUTANG').reduce((s, p) => s + (p.total - (p.paidAmount || 0)), 0).toLocaleString()}`} color="text-rose-600" bg="bg-rose-50" span={2} />
      </div>

      <div className="bg-white p-3 rounded-[2.5rem] shadow-sm border border-slate-100 mb-8 flex flex-col lg:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
           <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
           <input type="text" placeholder="Search supplier or PO ID..." className="w-full pl-16 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex gap-2 w-full lg:w-auto">
           <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="flex-1 lg:flex-none bg-slate-50 border-none rounded-2xl px-6 py-4 text-[10px] font-black uppercase outline-none">
              <option value="all">Status</option>
              <option value="MENUNGGU">Pending</option>
              <option value="DITERIMA">Received</option>
           </select>
           <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className="flex-1 lg:flex-none bg-slate-50 border-none rounded-2xl px-6 py-4 text-[10px] font-black uppercase outline-none">
              <option value="all">Payment</option>
              <option value="LUNAS">Paid</option>
              <option value="HUTANG">Debt</option>
           </select>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
           <table className="w-full text-left">
              <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                 <tr>
                    <th className="px-8 py-5">Reference & Date</th>
                    <th className="px-8 py-5">Supplier & Wh</th>
                    <th className="px-8 py-5">Financials</th>
                    <th className="px-8 py-5">Status</th>
                    <th className="px-8 py-5 text-right pr-12">Actions</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {filteredPurchases.map(p => (
                   <tr key={p.id} className="hover:bg-slate-50/50 transition-all group">
                      <td className="px-8 py-5">
                         <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-100 rounded-lg text-slate-400 group-hover:text-blue-600 transition-colors"><Package size={16}/></div>
                            <div>
                               <p className="text-[11px] font-black text-slate-800 uppercase italic leading-none">#{p.id.slice(-8)}</p>
                               <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 flex items-center gap-1"><Calendar size={10}/> {new Date(p.createdAt).toLocaleDateString('id-ID')}</p>
                            </div>
                         </div>
                      </td>
                      <td className="px-8 py-5">
                         <p className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{p.supplierName}</p>
                         <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{p.warehouseName}</p>
                      </td>
                      <td className="px-8 py-5">
                         <p className="text-[11px] font-black text-slate-900 leading-none">Rp {p.total.toLocaleString()}</p>
                         <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg w-fit mt-1.5 inline-block ${p.paymentStatus === 'LUNAS' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                            {p.paymentStatus}
                         </span>
                      </td>
                      <td className="px-8 py-5">
                         <span className={`text-[9px] font-black uppercase px-4 py-1.5 rounded-xl border ${p.status === 'DITERIMA' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : p.status === 'MENUNGGU' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                            {p.status}
                         </span>
                      </td>
                      <td className="px-8 py-5 text-right pr-12">
                         <div className="flex items-center justify-end gap-2">
                            {p.status === 'MENUNGGU' && (
                              <>
                                 <button onClick={() => updatePurchaseStatus(p.id, 'DITERIMA')} className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all"><CheckCircle2 size={16}/></button>
                                 <button onClick={() => updatePurchaseStatus(p.id, 'DIBATALKAN')} className="p-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all"><XCircle size={16}/></button>
                              </>
                            )}
                            {p.paymentStatus === 'HUTANG' && (
                              <button onClick={() => { setSelectedPurchase(p); setPaymentModalOpen(true); }} className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><CreditCard size={16}/></button>
                            )}
                            <Link href={`/admin/purchases/${p.id}`} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white transition-all"><ChevronRight size={16}/></Link>
                         </div>
                      </td>
                   </tr>
                 ))}
              </tbody>
           </table>
        </div>
        
        {lastDoc && (
          <div className="p-8 flex justify-center border-t border-slate-50">
             <button onClick={() => fetchPurchases(true)} disabled={loadingMore} className="px-10 py-4 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all disabled:opacity-50">
                {loadingMore ? 'Loading...' : 'Load More Purchases'}
             </button>
          </div>
        )}
      </div>

      <div className="mt-8 bg-blue-600 rounded-[3rem] p-10 text-white flex flex-col md:flex-row items-center justify-between overflow-hidden relative group">
         <div className="relative z-10 max-w-xl">
            <div className="flex items-center gap-3 mb-4">
               <div className="p-2 bg-white/20 rounded-xl"><Info size={20}/></div>
               <h3 className="text-xl font-black uppercase tracking-tighter">Automated Stock Control</h3>
            </div>
            <p className="text-xs font-medium opacity-80 leading-relaxed">
               Confirming a purchase as &quot;Received&quot; will automatically increment warehouse inventory and recalculate the Average Cost (HPP) for all included SKUs based on the latest purchase price.
            </p>
         </div>
         <div className="mt-8 md:mt-0 relative z-10">
            <Link href="/admin/inventory" className="px-8 py-4 bg-white text-blue-600 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all inline-block">Review Inventory</Link>
         </div>
         <Package size={200} className="absolute -right-10 -bottom-10 opacity-10 group-hover:rotate-12 transition-all duration-700 pointer-events-none" />
      </div>

      {paymentModalOpen && selectedPurchase && (
        <PaymentModal purchase={selectedPurchase} onClose={() => setPaymentModalOpen(false)} onConfirm={(amt) => handlePayment(selectedPurchase.id, amt)} />
      )}
    </div>
  );
}

function Stat({ label, val, color, bg, span = 1 }: any) {
  return (
    <div className={`${bg} p-6 rounded-[2rem] border border-slate-50 shadow-sm flex flex-col justify-center ${span > 1 ? `lg:col-span-${span}` : ''}`}>
       <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{label}</p>
       <p className={`text-2xl font-black ${color}`}>{val}</p>
    </div>
  );
}

function PaymentModal({ purchase, onClose, onConfirm }: { purchase: Purchase; onClose: () => void; onConfirm: (amt: number) => void }) {
  const remaining = purchase.total - (purchase.paidAmount || 0);
  const [amt, setAmt] = useState(remaining);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
       <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={onClose} />
       <div className="bg-white max-w-md w-full rounded-[3rem] p-10 relative z-10 shadow-2xl animate-in zoom-in-95">
          <div className="flex justify-between items-center mb-8">
             <h2 className="text-2xl font-black tracking-tight">Record Payment</h2>
             <button onClick={onClose} className="p-3 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100"><X size={20}/></button>
          </div>
          <div className="space-y-4 mb-8">
             <div className="p-6 bg-slate-50 rounded-3xl">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Total Payable</p>
                <p className="text-2xl font-black text-slate-900">Rp {purchase.total.toLocaleString()}</p>
                <div className="h-[1px] bg-slate-200 my-4" />
                <p className="text-[10px] font-black text-rose-500 uppercase mb-1">Remaining Debt</p>
                <p className="text-xl font-black text-rose-600">Rp {remaining.toLocaleString()}</p>
             </div>
             <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Payment Amount</label>
                <input type="number" value={amt} onChange={e => setAmt(Number(e.target.value))} className="w-full bg-slate-50 mt-2 px-8 py-5 rounded-[2rem] text-2xl font-black text-center outline-none focus:ring-4 focus:ring-blue-50 transition-all" />
             </div>
          </div>
          <button onClick={() => onConfirm(amt)} disabled={amt <= 0 || amt > remaining} className="w-full py-6 bg-slate-900 text-white rounded-[2.5rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-black disabled:opacity-30 transition-all">
             Submit Payment Record
          </button>
       </div>
    </div>
  );
}

function format(date: Date, fmt: string) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    if (fmt === 'Pp') {
        return `${date.toLocaleDateString('id-ID')} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }
    if (fmt === 'yyyyMMdd') {
        return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
    }
    return date.toISOString();
}
