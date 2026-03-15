'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { RefreshCcw, CheckCircle, XCircle } from 'lucide-react';
import { addStockTx, deductStockTx } from '@/lib/inventory';
import { postJournal } from '@/lib/ledger';
import notify from '@/lib/notify';

type ReturnReq = {
  id: string;
  type: 'SALES_RETURN' | 'PURCHASE_RETURN';
  refId: string; // Order ID or Purchase ID
  customerOrSupplierName: string;
  items: { productId: string; productName: string; quantity: number; price: number }[];
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  totalValue: number;
  createdAt: any;
};

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnReq[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'returns'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setReturns(snap.docs.map(d => ({ id: d.id, ...d.data() } as ReturnReq)));
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleProcess = async (ret: ReturnReq, action: 'APPROVE' | 'REJECT') => {
    if (!confirm(`Yakin ingin ${action === 'APPROVE' ? 'menyetujui' : 'menolak'} retur ini?`)) return;

    try {
      if (action === 'REJECT') {
        await updateDoc(doc(db, 'returns', ret.id), { status: 'REJECTED', updatedAt: serverTimestamp() });
        notify.admin.success('Retur ditolak');
        return;
      }

      // APPROVE Logic
      await runTransaction(db, async (tx) => {
        const retRef = doc(db, 'returns', ret.id);
        const retSnap = await tx.get(retRef);
        if (!retSnap.exists() || retSnap.data().status !== 'PENDING') {
          throw new Error('Retur sudah diproses atau tidak ditemukan.');
        }

        if (ret.type === 'SALES_RETURN') {
          // Sales Return: Barang kembali ke gudang (addStock)
          for (const item of ret.items) {
            await addStockTx(tx, {
              productId: item.productId,
              amount: item.quantity,
              warehouseId: 'gudang-utama',
              adminId: auth.currentUser?.uid || 'system',
              note: `Retur Penjualan #${ret.refId}`,
              source: 'MANUAL' // Adjust if needed
            });
          }
          // Ledger: Debit Sales Return (or Sales), Credit CustomerWallet/Cash
          await postJournal({
            debitAccount: 'Sales', // Idealnya Sales Return account
            creditAccount: 'CustomerWallet', // Asumsi refund masuk ke dompet
            amount: ret.totalValue,
            memo: `Refund Retur Penjualan #${ret.refId}`,
            refType: 'RETURN',
            refId: ret.id
          }, tx);

        } else if (ret.type === 'PURCHASE_RETURN') {
          // Purchase Return: Barang keluar dari gudang (deductStock)
          for (const item of ret.items) {
            await deductStockTx(tx, {
              productId: item.productId,
              amount: item.quantity,
              mainWarehouseId: 'gudang-utama',
              adminId: auth.currentUser?.uid || 'system',
              note: `Retur Pembelian #${ret.refId}`,
              source: 'MANUAL'
            });
          }
          // Ledger: Debit Cash/AccountsPayable, Credit Inventory
          await postJournal({
            debitAccount: 'Cash', // Asumsi uang dikembalikan tunai
            creditAccount: 'Inventory',
            amount: ret.totalValue,
            memo: `Refund Retur Pembelian #${ret.refId}`,
            refType: 'RETURN',
            refId: ret.id
          }, tx);
        }

        tx.update(retRef, { status: 'APPROVED', updatedAt: serverTimestamp() });
      });

      notify.admin.success('Retur disetujui dan stok disesuaikan.');
    } catch (err: any) {
      console.error(err);
      notify.admin.error(err.message || 'Gagal memproses retur.');
    }
  };

  if (loading) return <div className="p-8 text-center">Memuat...</div>;

  return (
    <div className="p-6 md:p-8 min-h-screen bg-gray-50 text-slate-800">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <RefreshCcw size={28} className="text-purple-600" /> Manajemen Retur
            </h1>
            <p className="text-slate-500 mt-2">Kelola pengembalian barang dari Penjualan dan ke Pembelian.</p>
          </div>
          {/* Untuk demo, bisa ditambah tombol buat retur manual di sini */}
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="p-4 font-bold text-slate-600">Tanggal</th>
                <th className="p-4 font-bold text-slate-600">Tipe / Ref</th>
                <th className="p-4 font-bold text-slate-600">Pihak</th>
                <th className="p-4 font-bold text-slate-600">Alasan</th>
                <th className="p-4 font-bold text-slate-600">Total (Rp)</th>
                <th className="p-4 font-bold text-slate-600">Status</th>
                <th className="p-4 font-bold text-slate-600 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {returns.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">Tidak ada data retur.</td></tr>
              ) : returns.map(ret => (
                <tr key={ret.id} className="hover:bg-slate-50">
                  <td className="p-4">{ret.createdAt ? new Date(ret.createdAt.seconds * 1000).toLocaleDateString('id-ID') : '-'}</td>
                  <td className="p-4">
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${ret.type === 'SALES_RETURN' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                      {ret.type === 'SALES_RETURN' ? 'RETUR JUAL' : 'RETUR BELI'}
                    </span>
                    <div className="mt-1 text-xs font-mono text-slate-500">#{ret.refId.slice(-6)}</div>
                  </td>
                  <td className="p-4 font-bold">{ret.customerOrSupplierName}</td>
                  <td className="p-4 max-w-xs truncate">{ret.reason}</td>
                  <td className="p-4 font-black">Rp {ret.totalValue.toLocaleString('id-ID')}</td>
                  <td className="p-4">
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${
                      ret.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                      ret.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {ret.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {ret.status === 'PENDING' && (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleProcess(ret, 'APPROVE')} className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200"><CheckCircle size={16} /></button>
                        <button onClick={() => handleProcess(ret, 'REJECT')} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"><XCircle size={16} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
