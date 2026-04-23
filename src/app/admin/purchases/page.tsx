'use client';

import { useEffect, useState, useMemo } from 'react';
import { auth, db } from '@/lib/firebase';


import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  updateDoc,
  addDoc,
  query,
  orderBy,
  Timestamp,
  serverTimestamp,
  getDocs,
  limit,
  startAfter,
  runTransaction,
  arrayUnion
} from 'firebase/firestore';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';
import notify from '@/lib/notify';
import { postJournal } from '@/lib/ledger';
import { Toaster } from 'react-hot-toast';

import {
  ShoppingBag, Plus, CreditCard,
  Package, Search, ChevronRight,
  Calendar, Clock, CheckCircle2, XCircle
} from 'lucide-react';


// --- TYPES ---
type ProductItem = {
  id: string;
  name: string;
  purchasePrice: number;
  quantity: number;
  unit: string;
  conversion?: number;
};

type Purchase = {
  id: string;
  supplierId: string;
  supplierName: string;
  items: ProductItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
  paymentMethod: string;
  paymentStatus: 'LUNAS' | 'HUTANG' | 'DP';
  paidAmount?: number; // Total amount paid so far
  dueDate?: string;
  notes?: string;
  status: 'MENUNGGU' | 'DITERIMA' | 'DIBATALKAN';
  warehouseId: string;
  warehouseName: string;
  createdAt: string;
};

export default function AdminPurchases() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all'); // State untuk filter pembayaran
  const [supplierFilter, setSupplierFilter] = useState<string>('');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [lastDoc, setLastDoc] = useState<import('firebase/firestore').QueryDocumentSnapshot | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);

  const openPaymentModal = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setPaymentModalOpen(true);
  };

  const filteredPurchases = useMemo(() => {
    let result = purchases;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.supplierName.toLowerCase().includes(term) ||
        p.id.toLowerCase().includes(term)
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter(p => p.status === statusFilter);
    }
    if (paymentFilter !== 'all') {
      result = result.filter(p => p.paymentStatus === paymentFilter);
    }
    if (supplierFilter) {
      const s = supplierFilter.toLowerCase();
      result = result.filter(p => (p.supplierName || '').toLowerCase().includes(s));
    }
    if (warehouseFilter) {
      const w = warehouseFilter.toLowerCase();
      result = result.filter(p => (p.warehouseName || '').toLowerCase().includes(w));
    }
    if (startDate) {
      const start = new Date(startDate).getTime();
      result = result.filter(p => {
        const t = p.createdAt ? new Date(p.createdAt).getTime() : 0;
        return t >= start;
      });
    }
    if (endDate) {
      const end = new Date(endDate).getTime() + 86400000 - 1;
      result = result.filter(p => {
        const t = p.createdAt ? new Date(p.createdAt).getTime() : 0;
        return t <= end;
      });
    }
    return result;
  }, [purchases, searchTerm, statusFilter, paymentFilter, supplierFilter, warehouseFilter, startDate, endDate]);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (loading) return;
    (async () => {
      const q = query(collection(db, 'purchases'), orderBy('createdAt', 'desc'), limit(20));
      const snapshot = await getDocs(q);
      const purchaseList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate().toISOString() : new Date().toISOString()
      } as Purchase));
      setPurchases(purchaseList);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] ?? null);
    })();
  }, [loading]);

  const updatePurchaseStatus = async (id: string, newStatus: Purchase['status']) => {
    console.log('updatePurchaseStatus called:', { id, newStatus });
    
    const confirmMsg = newStatus === 'DITERIMA'
      ? 'Konfirmasi barang diterima? Stok akan bertambah otomatis.'
      : 'Batalkan transaksi ini?';

    if (!confirm(confirmMsg)) {
      console.log('User cancelled confirmation');
      return;
    }

    console.log('User confirmed, processing...');
    
    try {
      // Show loading notification
      notify.admin.info(newStatus === 'DITERIMA' ? 'Memproses konfirmasi...' : 'Membatalkan transaksi...');
      
      await runTransaction(db, async (tx) => {
        // ============================================
        // STEP 1: READ ALL DATA FIRST (before any writes)
        // ============================================
        
        // 1. Idempotency Check
        const keyRef = doc(db, 'action_keys', `purchase:${id}:${newStatus}`);
        const keySnap = await tx.get(keyRef);
        if (keySnap.exists()) throw new Error('Aksi ini sudah diproses sebelumnya.');

        // 2. Lock Purchase Doc
        const purchaseRef = doc(db, 'purchases', id);
        const pSnap = await tx.get(purchaseRef);
        if (!pSnap.exists()) throw new Error('Data pembelian tidak ditemukan.');
        const pData = pSnap.data() as Purchase;

        if (pData.status !== 'MENUNGGU') throw new Error('Status transaksi bukan MENUNGGU.');

        // 3. Collect all product reads first (if DITERIMA)
        const productReads: Map<string, { ref: any; data: any }> = new Map();
        if (newStatus === 'DITERIMA') {
          for (const item of pData.items) {
            const productRef = doc(db, 'products', item.id);
            const prodSnap = await tx.get(productRef);
            
            if (prodSnap.exists()) {
              productReads.set(item.id, {
                ref: productRef,
                data: prodSnap.data()
              });
            }
          }
        }

        // ============================================
        // STEP 2: PROCESS ALL WRITES AFTER ALL READS
        // ============================================
        
        if (newStatus === 'DITERIMA') {
          for (const item of pData.items) {
            const productRead = productReads.get(item.id);
            if (!productRead) continue;
            
            const productRef = productRead.ref;
            const curData = productRead.data as Record<string, any>;
            const currentStock = Number(curData.stock || curData.Stok || 0);
            const conversion = Number(item.conversion || 1);
            const qtyInUnit = Number(item.quantity || 0);
            const pricePerUnit = Number(item.purchasePrice || 0);
            
            const incomingQtyPcs = qtyInUnit * conversion;
            const incomingCostPerPcs = conversion > 0 ? (pricePerUnit / conversion) : pricePerUnit;
            
            const currentCostPerPcs = Number(curData.Modal || curData.purchasePrice || 0);
            const effectiveOldCost = currentCostPerPcs > 0 ? currentCostPerPcs : incomingCostPerPcs;
            
            const newStock = currentStock + incomingQtyPcs;
            const nextAvgCost = currentStock === 0
              ? Math.round(incomingCostPerPcs)
              : Math.round(((currentStock * effectiveOldCost) + (qtyInUnit * pricePerUnit)) / newStock);

            const whKey = pData.warehouseId || 'gudang-utama';
            
            // Manual stock update (replacing addStockTx to avoid interleaved reads)
            const stockByWarehouse: Record<string, number> = curData.stockByWarehouse || {};
            const nextByWarehouse: Record<string, number> = { ...stockByWarehouse };
            nextByWarehouse[whKey] = Number(nextByWarehouse[whKey] || 0) + incomingQtyPcs;
            
            tx.update(productRef, {
              stock: newStock,
              stockByWarehouse: nextByWarehouse,
              purchasePrice: nextAvgCost,
              Modal: nextAvgCost,
              hargaBeli: nextAvgCost,
              updatedAt: serverTimestamp(),
              inventoryLayers: arrayUnion({
                qty: incomingQtyPcs,
                costPerPcs: incomingCostPerPcs,
                ts: Timestamp.now(),
                purchaseId: id,
                supplierName: pData.supplierName || '',
                warehouseId: whKey
              })
            });

            // Manual inventory log creation (replacing addStockTx logging)
            const logRef = doc(collection(db, 'inventory_logs'));
            tx.set(logRef, {
              productId: item.id,
              productName: curData.name || curData.Nama || 'Produk',
              type: 'MASUK',
              amount: incomingQtyPcs,
              adminId: auth.currentUser?.uid || 'system',
              source: 'PURCHASE',
              note: `Penerimaan Barang PO #${id} (${item.quantity} ${item.unit})`,
              toWarehouseId: whKey,
              prevStock: currentStock,
              nextStock: newStock,
              date: serverTimestamp()
            });
          }

          // DOUBLE ENTRY: Terima Barang (Inventory bertambah, tapi Hutang/Kas berkurang)
          // Asumsi: Saat barang diterima, kita catat nilai barang tersebut.
          await postJournal({
            debitAccount: 'Inventory',
            creditAccount: pData.paymentStatus === 'LUNAS' ? 'Cash' : 'AccountsPayable',
            amount: pData.total,
            memo: `Penerimaan Barang PO #${id}`,
            refType: 'PURCHASE',
            refId: id
          }, tx);

        } else if (newStatus === 'DIBATALKAN') {
          const method = pData.paymentMethod;
          const isPaid = pData.paymentStatus === 'LUNAS';
          if (isPaid && (method === 'CASH' || method === 'TRANSFER')) {
            const refundRef = doc(collection(db, 'capital_transactions'));
            tx.set(refundRef, {
              date: serverTimestamp(),
              type: 'INJECTION',
              amount: pData.total,
              description: `Refund Pembatalan PO #${id}`,
              recordedBy: auth.currentUser?.uid || 'system',
              referenceId: id,
              source: 'PURCHASE_CANCEL'
            });
          }
        }

        // 4. Update Status & Write Idempotency Key
        tx.update(purchaseRef, { status: newStatus, updatedAt: serverTimestamp() });
        tx.set(keyRef, { createdAt: serverTimestamp(), by: auth.currentUser?.uid || 'admin' });
      });

      notify.admin.success(newStatus === 'DITERIMA' ? 'Pembelian dikonfirmasi, stok bertambah' : 'Pembelian dibatalkan');
    } catch (err: any) {
      notify.admin.error(err.message || 'Gagal update status');
    }
  };

  const handlePayment = async (purchaseId: string, amountPaid: number) => {
    if (!purchaseId) return;
    const p = purchases.find(pur => pur.id === purchaseId);
    if (!p) return;

    try {
      await runTransaction(db, async (tx) => {
        const purchaseRef = doc(db, 'purchases', purchaseId);
        const pSnap = await tx.get(purchaseRef);
        if (!pSnap.exists()) throw new Error('Data pembelian tidak ditemukan.');
        
        const pData = pSnap.data() as Purchase;
        const currentPaid = pData.paidAmount || 0;
        const newPaid = currentPaid + amountPaid;
        const isFullyPaid = newPaid >= pData.total;

        tx.update(purchaseRef, {
          paymentStatus: isFullyPaid ? 'LUNAS' : 'HUTANG',
          paidAmount: newPaid,
          paymentDate: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // DOUBLE ENTRY: Payment of Accounts Payable
        await postJournal({
          debitAccount: 'AccountsPayable',
          creditAccount: 'Cash',
          amount: amountPaid,
          memo: `Pembayaran ${isFullyPaid ? 'Lunas' : 'Cicilan'} PO #${purchaseId}`,
          refType: 'PURCHASE_PAYMENT',
          refId: purchaseId
        }, tx);
      });

      // Refresh local state to reflect partial payment
      const pData = purchases.find(p => p.id === purchaseId);
      if (pData) {
        const currentPaid = pData.paidAmount || 0;
        const newPaid = currentPaid + amountPaid;
        const isFullyPaid = newPaid >= pData.total;
        
        setPurchases(prevPurchases =>
          prevPurchases.map(p =>
            p.id === purchaseId ? { ...p, paymentStatus: isFullyPaid ? 'LUNAS' : 'HUTANG', paidAmount: newPaid } : p
          )
        );
      }

      notify.admin.success('Pembayaran berhasil dicatat.');
      setPaymentModalOpen(false);
    } catch (error: any) {
      notify.admin.error(error.message || 'Gagal memproses pembayaran.');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black uppercase tracking-widest text-xs">Loading Purchases...</div>;

  return (
    <div className="p-3 md:p-4 bg-[#FBFBFE] min-h-screen pb-32">
      <Toaster position="top-right" />

      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-xl md:text-3xl font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2">
            <ShoppingBag className="text-blue-600" size={24} /> Purchases
          </h1>
          <p className="text-gray-400 text-[9px] font-black uppercase tracking-widest mt-0.5">
            Total Pengeluaran: <span className="text-red-500">Rp {purchases.reduce((s, p) => s + p.total, 0).toLocaleString()}</span>
          </p>
        </div>
        <Link href="/admin/purchases/add" className="bg-black text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 hover:scale-105 transition-all">
          <Plus size={16} /> Buat PO
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Menunggu" val={purchases.filter(p => p.status === 'MENUNGGU').length} color="text-yellow-600" bg="bg-yellow-50" icon={Clock} />
        <StatCard label="Diterima" val={purchases.filter(p => p.status === 'DITERIMA').length} color="text-green-600" bg="bg-green-50" icon={CheckCircle2} />
        <StatCard label="Hutang Total" val={`Rp ${purchases.filter(p => p.paymentStatus === 'HUTANG').reduce((s, p) => s + p.total, 0).toLocaleString()}`} color="text-red-600" bg="bg-red-50" icon={CreditCard} isWide />
      </div>

      {/* Filter & Search */}
      <div className="bg-white p-4 md:p-6 rounded-[2rem] shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            className="w-full bg-gray-50 pl-11 pr-6 py-2.5 md:py-3 rounded-xl text-[11px] font-bold outline-none"
            placeholder="Cari Supplier / PO..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 md:flex gap-2">
          <select
            className="bg-gray-50 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase outline-none border-none"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Status</option>
            <option value="MENUNGGU">Menunggu</option>
            <option value="DITERIMA">Diterima</option>
          </select>
          <select
            className="bg-gray-50 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase outline-none border-none"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            <option value="all">Bayar</option>
            <option value="LUNAS">Lunas</option>
            <option value="HUTANG">Hutang</option>
          </select>
        </div>
      </div>

      {/* Purchases Table */}
      {/* Mobile Card View */}
      <div className="md:hidden space-y-4 mb-6">
        {filteredPurchases.length === 0 ? (
           <div className="p-8 text-center bg-white rounded-3xl border border-gray-100 shadow-lg">
              <ShoppingBag className="mx-auto text-gray-200 mb-4" size={40} />
              <p className="text-[10px] font-black text-gray-400 tracking-widest">TIDAK ADA DATA PEMBELIAN</p>
           </div>
        ) : (
          filteredPurchases.map((purchase) => (
            <div key={purchase.id} className="bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col gap-3">
               <div className="flex justify-between items-start">
                  <div>
                     <span className="text-[10px] font-black text-gray-800 uppercase italic">#{purchase.id.slice(-6)}</span>
                     <div className="flex items-center gap-1 mt-0.5 text-gray-400">
                        <Calendar size={10} />
                        <span className="text-[9px] font-bold uppercase">{new Date(purchase.createdAt).toLocaleDateString('id-ID')}</span>
                     </div>
                  </div>
                   <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg border ${purchase.status === 'DITERIMA' ? 'bg-green-50 text-green-600 border-green-100' :
                      purchase.status === 'MENUNGGU' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                        'bg-red-50 text-red-600 border-red-100'
                      }`}>
                      {purchase.status}
                    </span>
               </div>

               <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-50">
                  <div className="col-span-2">
                     <p className="text-[9px] font-bold text-gray-400 uppercase">Supplier</p>
                     <p className="text-[11px] font-black text-gray-800 uppercase tracking-tight truncate">{purchase.supplierName}</p>
                  </div>
                  <div>
                     <p className="text-[9px] font-bold text-gray-400 uppercase">Gudang</p>
                     <p className="text-[11px] font-bold text-gray-600 uppercase truncate">{purchase.warehouseName}</p>
                  </div>
                   <div className="text-right">
                     <p className="text-[9px] font-bold text-gray-400 uppercase">Items</p>
                     <p className="text-[11px] font-bold text-blue-500 uppercase">{purchase.items.length} SKUs</p>
                  </div>
               </div>

               <div className="bg-gray-50 px-3 py-2 rounded-xl flex justify-between items-center">
                   <div>
                       <p className="text-[9px] font-bold text-gray-400 uppercase">Total</p>
                       <p className="text-xs font-black text-gray-900">Rp {purchase.total.toLocaleString()}</p>
                   </div>
                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${purchase.paymentStatus === 'LUNAS' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                      }`}>
                      {purchase.paymentStatus}
                    </span>
               </div>

               <div className="flex gap-1.5 pt-1.5">
                  {purchase.status === 'MENUNGGU' && (
                    <>
                      <button onClick={() => updatePurchaseStatus(purchase.id, 'DITERIMA')} className="flex-1 py-2 bg-green-600 text-white rounded-xl flex items-center justify-center shadow-sm">
                        <CheckCircle2 size={14} />
                      </button>
                      <button onClick={() => updatePurchaseStatus(purchase.id, 'DIBATALKAN')} className="flex-1 py-2 bg-red-50 text-red-500 rounded-xl flex items-center justify-center">
                        <XCircle size={14} />
                      </button>
                    </>
                  )}
                  <Link href={`/admin/purchases/${purchase.id}`} className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-xl flex items-center justify-center hover:bg-black hover:text-white transition-all">
                     <span className="text-[9px] font-bold uppercase mr-1.5">Info</span>
                     <ChevronRight size={14} />
                  </Link>
                  {purchase.paymentStatus === 'HUTANG' && (
                    <button onClick={() => openPaymentModal(purchase)} className="py-2 px-3 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-sm">
                      <CreditCard size={14} />
                    </button>
                  )}
               </div>
            </div>
          ))
        )}
      </div>

      <div className="hidden md:block bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[720px] md:min-w-0">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="px-3 md:px-4 py-2 text-[9px] font-black text-gray-400 uppercase tracking-widest">ID & Tanggal</th>
              <th className="px-3 md:px-4 py-2 text-[9px] font-black text-gray-400 uppercase tracking-widest">Supplier</th>
              <th className="hidden md:table-cell px-3 md:px-4 py-2 text-[9px] font-black text-gray-400 uppercase tracking-widest">Pembayaran</th>
              <th className="hidden md:table-cell px-3 md:px-4 py-2 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
              <th className="px-3 md:px-4 py-2 text-right text-[9px] font-black text-gray-400 uppercase tracking-widest">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredPurchases.map((purchase) => (
              <tr key={purchase.id} className="hover:bg-gray-50/50 transition-all">
                <td className="px-3 md:px-4 py-2">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black text-gray-800 uppercase italic leading-none">#{purchase.id.slice(-6)}</span>
                    <span className="text-[8px] font-bold text-gray-400 uppercase flex items-center gap-1 mt-0.5">
                      <Calendar size={9} /> {new Date(purchase.createdAt).toLocaleDateString('id-ID')}
                    </span>
                  </div>
                </td>
                <td className="px-3 md:px-4 py-2">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black text-gray-700 uppercase tracking-tight leading-none">{purchase.supplierName}</span>
                    <span className="text-[8px] font-bold text-blue-500 uppercase mt-0.5">{purchase.items.length} Items • {purchase.warehouseName}</span>
                  </div>
                </td>
                <td className="hidden md:table-cell px-3 md:px-4 py-2">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black text-gray-800 leading-none">Rp {purchase.total.toLocaleString()}</span>
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md w-fit mt-0.5 ${purchase.paymentStatus === 'LUNAS' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                      }`}>
                      {purchase.paymentStatus}
                    </span>
                  </div>
                </td>
                <td className="hidden md:table-cell px-3 md:px-4 py-2 text-center">
                  <span className={`text-[8px] font-black uppercase px-3 py-1.5 rounded-xl border inline-block ${purchase.status === 'DITERIMA' ? 'bg-green-50 text-green-600 border-green-100' :
                    purchase.status === 'MENUNGGU' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                      'bg-red-50 text-red-600 border-red-100'
                    }`}>
                    {purchase.status}
                  </span>
                </td>
                <td className="px-3 md:px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {purchase.status === 'MENUNGGU' && (
                      <div className="flex gap-1.5">
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('Confirm button clicked for:', purchase.id);
                            updatePurchaseStatus(purchase.id, 'DITERIMA');
                          }} 
                          className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all shadow-lg shadow-green-100 cursor-pointer active:scale-95"
                          title="Konfirmasi barang diterima"
                        >
                          <CheckCircle2 size={12} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('Cancel button clicked for:', purchase.id);
                            updatePurchaseStatus(purchase.id, 'DIBATALKAN');
                          }} 
                          className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all cursor-pointer active:scale-95"
                          title="Batalkan pembelian"
                        >
                          <XCircle size={12} />
                        </button>
                      </div>
                    )}
                    <Link href={`/admin/purchases/${purchase.id}`} className="p-1.5 bg-gray-100 text-gray-400 rounded-lg hover:bg-black hover:text-white transition-all">
                      <ChevronRight size={14} />
                    </Link>
                    {purchase.paymentStatus === 'HUTANG' && (
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('Payment button clicked for:', purchase.id);
                          openPaymentModal(purchase);
                        }} 
                        className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 cursor-pointer active:scale-95"
                        title="Catat pembayaran"
                      >
                        <CreditCard size={12} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {!!lastDoc && (
          <div className="p-4 flex justify-center">
            <button
              className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-green-600 text-white tap-active disabled:opacity-50"
              disabled={loadingMore}
              onClick={async () => {
                if (loadingMore || !lastDoc) return;
                setLoadingMore(true);
                try {
                  const q = query(
                    collection(db, 'purchases'),
                    orderBy('createdAt', 'desc'),
                    startAfter(lastDoc),
                    limit(20)
                  );
                  const snapshot = await getDocs(q);
                  const more = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate().toISOString() : new Date().toISOString()
                  } as Purchase));
                  setPurchases(prev => [...prev, ...more]);
                  setLastDoc(snapshot.docs[snapshot.docs.length - 1] ?? null);
                } catch {
                  notify.admin.error('Gagal memuat data tambahan');
                } finally {
                  setLoadingMore(false);
                }
              }}
            >
              {loadingMore ? 'Memuat...' : 'Muat Lebih Banyak'}
            </button>
          </div>
        )}
        {filteredPurchases.length === 0 && (
          <div className="p-20 text-center flex flex-col items-center gap-3">
            <ShoppingBag size={48} className="text-gray-100" />
            <p className="text-[10px] font-black uppercase text-gray-300 tracking-[0.2em]">Belum Ada Data Pembelian</p>
          </div>
        )}
      </div>

      {/* Info Alert */}
      <div className="mt-8 bg-blue-600 rounded-[2rem] p-8 text-white flex items-center justify-between overflow-hidden relative group">
        <div className="relative z-10">
          <h3 className="text-lg font-black uppercase tracking-tighter">Sistem Stok Otomatis Aktif</h3>
          <p className="text-[10px] opacity-80 font-bold uppercase tracking-widest mt-1 max-w-md leading-relaxed">
            Menekan tombol &quot;Terima&quot; akan menambah stok barang di gudang secara real-time dan memperbarui Harga Beli (HPP) pada master data produk.

          </p>
        </div>
        <Package size={120} className="absolute -right-5 -bottom-5 opacity-10 group-hover:rotate-12 transition-all duration-700" />
      </div>

      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        purchase={selectedPurchase}
        onConfirm={(amount) => {
          if (selectedPurchase) {
            handlePayment(selectedPurchase.id, amount);
          }
        }}
      />

    </div>
  );
}

interface StatCardProps {
  label: string;
  val: string | number;
  color: string;
  bg: string;
  icon: LucideIcon;
  isWide?: boolean;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: Purchase | null;
  onConfirm: (amount: number) => void;
}
function PaymentModal({ isOpen, onClose, purchase, onConfirm }: PaymentModalProps) {
  const remaining = purchase ? purchase.total - (purchase.paidAmount || 0) : 0;
  const [amount, setAmount] = useState(() => remaining);

  // Update amount if purchase changes
  useEffect(() => {
    if (purchase) {
      setAmount(purchase.total - (purchase.paidAmount || 0));
    }
  }, [purchase]);

  if (!isOpen || !purchase) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 m-4 transform transition-all">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter flex items-center gap-3"><CreditCard size={24} className="text-blue-600"/>Bayar Tagihan</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-800"><XCircle size={24} /></button>
        </div>
        
        <div className="space-y-4 mb-8">
          <div className="bg-gray-50 p-4 rounded-xl">
            <p className="text-[10px] font-bold text-gray-400 uppercase">Supplier</p>
            <p className="text-sm font-black text-gray-800 uppercase">{purchase.supplierName}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-center">
              <p className="text-[10px] font-bold text-blue-500 uppercase">Total Hutang</p>
              <p className="text-lg font-black text-blue-600">Rp {purchase.total.toLocaleString('id-ID')}</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl text-center">
              <p className="text-[10px] font-bold text-orange-500 uppercase">Sisa Tagihan</p>
              <p className="text-lg font-black text-orange-600">Rp {remaining.toLocaleString('id-ID')}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
           <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Jumlah Pembayaran</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full bg-gray-50 mt-2 px-6 py-4 rounded-2xl text-lg font-bold outline-none text-center"
              />
           </div>
          <button 
            onClick={() => onConfirm(amount)}
            disabled={amount <= 0 || amount > remaining}
            className="w-full bg-black text-white py-5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100">
            KONFIRMASI PEMBAYARAN
          </button>
        </div>
      </div>
    </div>
  );
}


function StatCard({ label, val, color, bg, icon: Icon, isWide }: StatCardProps) {
  return (
    <div className={`p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] ${bg} ${color} border border-transparent hover:border-current transition-all flex flex-col gap-2 ${isWide ? 'lg:col-span-2' : ''}`}>
      <div className="flex justify-between items-start">
        <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest opacity-60">{label}</span>
        <Icon size={14} className="md:size-4" />
      </div>
      <span className="text-sm md:text-xl font-black tracking-tighter uppercase truncate">{val}</span>
    </div>
  );
}
