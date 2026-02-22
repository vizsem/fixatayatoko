'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';

import {
  collection, query, orderBy, limit, onSnapshot,
  getDocs, doc, updateDoc, addDoc, increment, serverTimestamp, Timestamp
} from 'firebase/firestore';

import {
  Users,
  History,
  Wallet,
  User as UserIcon,
  PlusCircle,
  MinusCircle,
  AlertTriangle,
} from 'lucide-react';

import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { toast } from 'react-hot-toast';

interface WalletLog { id: string; userId: string; amountChanged: number; type: string; description: string; createdAt: Timestamp | { toDate: () => Date } | null; orderId?: string; }
interface UserWithWallet { id: string; displayName?: string; email?: string; walletBalance: number; }

export default function AdminWalletDashboard() {
  const [logs, setLogs] = useState<WalletLog[]>([]);
  const [topUsers, setTopUsers] = useState<UserWithWallet[]>([]);
  const [stats, setStats] = useState({ totalIn: 0, totalOut: 0 });

  const [showModal, setShowModal] = useState(false);
  const [adjustData, setAdjustData] = useState({ userId: '', amount: 0, reason: '', type: 'TOPUP_ADMIN' });

  useEffect(() => {
    const qLogs = query(collection(db, 'wallet_logs'), orderBy('createdAt', 'desc'), limit(50));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WalletLog)));
    });

    const qUsers = query(collection(db, 'users'), orderBy('walletBalance', 'desc'), limit(10));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      setTopUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserWithWallet)));
    });

    const fetchStats = async () => {
      const logsSnap = await getDocs(collection(db, 'wallet_logs'));
      let totalIn = 0;
      let totalOut = 0;
      logsSnap.forEach(doc => {
        const data = doc.data();
        if (data.amountChanged > 0) {
          totalIn += data.amountChanged;
        } else {
          totalOut += Math.abs(data.amountChanged);
        }
      });
      setStats({ totalIn, totalOut });
    };

    fetchStats();
    return () => { unsubLogs(); unsubUsers(); };
  }, []);

  const handleAdjustment = async () => {
    if (!adjustData.userId || adjustData.amount <= 0) return toast.error("Lengkapi data dengan benar");

    try {
      const amountToChange = adjustData.type === 'TOPUP_ADMIN' ? adjustData.amount : -adjustData.amount;
      const userRef = doc(db, 'users', adjustData.userId);

      await updateDoc(userRef, { walletBalance: increment(amountToChange) });
      await addDoc(collection(db, 'wallet_logs'), {
        userId: adjustData.userId,
        amountChanged: amountToChange,
        type: adjustData.type,
        description: adjustData.reason || (adjustData.type === 'TOPUP_ADMIN' ? 'Top-up oleh Admin' : 'Penarikan oleh Admin'),
        createdAt: serverTimestamp()
      });

      toast.success("Berhasil memperbarui saldo dompet");
      setShowModal(false);
      setAdjustData({ userId: '', amount: 0, reason: '', type: 'TOPUP_ADMIN' });
    } catch {
      toast.error("Gagal memproses data");
    }
  };

  return (
    <div className="p-4 md:p-10 bg-gray-50 min-h-screen font-sans text-black">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Wallet size={22} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">Digital Wallet Control</h1>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Audit & Manajemen Saldo</p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg"
          >
            <AlertTriangle size={16} /> Penyesuaian Manual
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 text-white">
          <div className="bg-black p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
            <Wallet className="absolute right-[-10px] bottom-[-10px] text-white/10" size={120} />
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Total Dana Masuk</p>
            <h2 className="text-4xl font-black italic">Rp{stats.totalIn.toLocaleString()}</h2>
          </div>
          <div className="bg-white text-black border border-gray-100 p-8 rounded-[2.5rem] shadow-sm">
            <p className="text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">Total Dana Keluar</p>
            <h2 className="text-4xl font-black italic text-red-600">Rp{stats.totalOut.toLocaleString()}</h2>
          </div>
          <div className="bg-blue-600 p-8 rounded-[2.5rem] shadow-lg">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Saldo Aktif Beredar</p>
            <h2 className="text-4xl font-black italic">Rp{(stats.totalIn - stats.totalOut).toLocaleString()}</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
            <h3 className="text-xs font-black uppercase mb-6 flex items-center gap-2 border-b pb-4 tracking-widest text-blue-600">
              <Users size={16} /> Pengguna Saldo Teratas
            </h3>
            <div className="space-y-3">
              {topUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 rounded-2xl border bg-gray-50 border-transparent">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center bg-white text-gray-400">
                      <UserIcon size={18} />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[10px] font-black uppercase truncate">{user.displayName || user.email?.split('@')[0]}</p>
                      <div
                        className="flex items-center gap-1 cursor-pointer group"
                        onClick={() => {
                          navigator.clipboard.writeText(user.id);
                          toast.success("UID Berhasil disalin!");
                        }}
                      >
                        <p className="text-[8px] font-bold text-blue-500 uppercase font-mono tracking-tighter">
                          UID: {user.id}
                        </p>
                        <span className="text-[7px] bg-blue-100 text-blue-600 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">Copy</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-2">
                    <p className="text-xs font-black text-blue-600">Rp{user.walletBalance?.toLocaleString()}</p>
                    <p className="text-[8px] font-bold text-gray-300 uppercase italic">Saldo</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7 bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <h3 className="text-xs font-black uppercase mb-6 flex items-center gap-2 tracking-widest">
              <History size={16} className="text-gray-400" /> Riwayat Transaksi Dompet
            </h3>
            <div className="overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
              <table className="w-full">
                <tbody className="divide-y divide-gray-50">
                  {logs.map((log) => (
                    <tr key={log.id} className="group">
                      <td className="py-4">
                        <p className="text-[9px] font-bold text-gray-400 uppercase">
                          {log.createdAt ? format(log.createdAt.toDate(), 'dd MMM HH:mm', { locale: localeID }) : '...'}
                        </p>
                        <p className="text-[10px] font-black uppercase">UID: {log.userId?.slice(0, 8)}</p>
                      </td>
                      <td className="py-4">
                        <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-tighter ${
                          log.amountChanged > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                        }`}>
                          {log.type.replace('_', ' ')}
                        </span>
                        <p className="text-[9px] text-gray-400 font-bold mt-1 uppercase italic leading-tight">{log.description}</p>
                        {log.orderId && <p className="text-[8px] text-blue-500 font-mono mt-1">Order: {log.orderId}</p>}
                      </td>
                      <td className="py-4 text-right">
                        <div className={`font-black text-xs ${log.amountChanged > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {log.amountChanged > 0 ? `+Rp${log.amountChanged.toLocaleString()}` : `-Rp${Math.abs(log.amountChanged).toLocaleString()}`}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl scale-in-center">
              <h2 className="text-xl font-black uppercase italic mb-6">Penyesuaian Saldo</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400">Target User ID</label>
                  <input
                    type="text"
                    className="w-full p-4 bg-gray-50 rounded-2xl mt-1 font-bold outline-none border-2 border-transparent focus:border-black"
                    placeholder="Masukkan UID Pelanggan..."
                    onChange={(e) => setAdjustData({ ...adjustData, userId: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setAdjustData({ ...adjustData, type: 'TOPUP_ADMIN' })}
                    className={`p-4 rounded-2xl font-black text-[10px] uppercase border-2 transition-all ${adjustData.type === 'TOPUP_ADMIN' ? 'bg-green-50 border-green-600 text-green-600' : 'border-gray-100 text-gray-400'}`}>
                    <PlusCircle className="mx-auto mb-1" size={18} /> Top-up
                  </button>
                  <button onClick={() => setAdjustData({ ...adjustData, type: 'WITHDRAW_ADMIN' })}
                    className={`p-4 rounded-2xl font-black text-[10px] uppercase border-2 transition-all ${adjustData.type === 'WITHDRAW_ADMIN' ? 'bg-red-50 border-red-600 text-red-600' : 'border-gray-100 text-gray-400'}`}>
                    <MinusCircle className="mx-auto mb-1" size={18} /> Penarikan
                  </button>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400">Nominal (Rp)</label>
                  <input type="number" className="w-full p-4 bg-gray-50 rounded-2xl mt-1 font-black outline-none" placeholder="0"
                    onChange={(e) => setAdjustData({ ...adjustData, amount: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400">Alasan Penyesuaian</label>
                  <textarea className="w-full p-4 bg-gray-50 rounded-2xl mt-1 font-bold outline-none resize-none" rows={3}
                    placeholder="Contoh: Koreksi saldo..."
                    onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })} />
                </div>
                <div className="flex gap-4 mt-6">
                  <button onClick={() => setShowModal(false)} className="flex-1 p-4 font-black text-[10px] uppercase text-gray-400 hover:text-black">Batal</button>
                  <button onClick={handleAdjustment} className="flex-1 p-4 bg-black text-white rounded-2xl font-black text-[10px] uppercase shadow-lg hover:shadow-blue-200 transition-all">Konfirmasi</button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
