'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';

import {
  collection, doc, getDoc,
  updateDoc, addDoc, increment, serverTimestamp
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import {
  Ticket, Coins, ArrowLeft, Lock,
  Gift, Zap, Snowflake
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { User as FirebaseUser } from 'firebase/auth';
import { UserProfile } from '@/lib/types';
import { SkeletonList, EmptyState } from '@/components/UIState';

interface UserData extends UserProfile {
  _addresses?: unknown[]; // internal extended field
}



// Data Statis Voucher (Bisa dipindah ke Firestore nantinya)
const VOUCHER_LIST = [
  { id: 'v1', name: 'Potongan Rp 5.000', cost: 5000, value: 5000, color: 'bg-emerald-500' },
  { id: 'v2', name: 'Potongan Rp 15.000', cost: 14000, value: 15000, color: 'bg-blue-500' }, // Diskon poin (14rb poin dpt 15rb)
  { id: 'v3', name: 'Potongan Rp 50.000', cost: 45000, value: 50000, color: 'bg-purple-600' },
  { id: 'v4', name: 'Gratis Ongkir Toko', cost: 10000, value: 10000, color: 'bg-orange-500' },
];

export default function VoucherExchangePage() {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);

  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (userSnap.exists()) setUserData(userSnap.data() as UserData);

      } else {
        router.push('/login');
      }
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const handleRedeem = async (voucher: typeof VOUCHER_LIST[0]) => {
    if (!userData || userData.points < voucher.cost) {
      return toast.error("Poin tidak cukup!");
    }
    if (userData.isPointsFrozen) {
      return toast.error("Akun Anda sedang ditangguhkan.");
    }

    const confirmRedeem = confirm(`Tukar ${voucher.cost.toLocaleString()} poin dengan ${voucher.name}?`);
    if (!confirmRedeem) return;

    setIsProcessing(true);
    try {
      if (!user) return;
      const userRef = doc(db, 'users', user.uid);


      // Generate Kode Unik
      const voucherCode = `ATY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // 1. Jalankan Transaksi ke Firestore
      await updateDoc(userRef, { points: increment(-voucher.cost) });

      await addDoc(collection(db, 'user_vouchers'), {
        userId: user.uid,
        code: voucherCode,
        name: voucher.name,
        value: voucher.value,
        status: 'ACTIVE',
        createdAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'point_logs'), {
        userId: user.uid,
        pointsChanged: -voucher.cost,
        type: 'VOUCHER_EXCHANGE',
        description: `Tukar voucher: ${voucher.name} (${voucherCode})`,
        createdAt: serverTimestamp()
      });

      // 2. OTOMATIS SALIN KE CLIPBOARD
      await navigator.clipboard.writeText(voucherCode);

      // 3. TAMPILKAN NOTIFIKASI SUKSES DENGAN OPSI SALIN ULANG
      toast.success((t) => (
        <span className="flex flex-col gap-1">
          <b className="text-xs">Berhasil ditukar!</b>

          <span className="text-[10px]">Kode <code className="bg-gray-100 px-1 font-black">{voucherCode}</code> telah disalin.</span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(voucherCode);
              toast.dismiss(t.id);
              toast.success("Disalin ulang!");
            }}
            className="mt-2 bg-black text-white text-[8px] font-black py-1 px-2 rounded-lg"

          >
            Salin Ulang
          </button>
        </span>
      ), { duration: 6000 });

      // Update UI
      setUserData({ ...userData, points: userData.points - voucher.cost });

    } catch {
      toast.error("Gagal menukar voucher.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900 pb-10 page-fade">
      <Toaster />

      {/* HEADER */}
      <div className="bg-white p-6 shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <button onClick={() => router.back()} className="p-2 bg-gray-100 rounded-full">
            <ArrowLeft size={20} />
          </button>
          <div className="text-center">
            <h1 className="font-black italic text-lg tracking-tighter">Voucher Center</h1>
            <p className="text-[10px] font-bold text-gray-400 tracking-widest">Tukar poin jadi keuntungan</p>
          </div>

          <div className="w-10"></div>
        </div>
      </div>

      <div className="max-w-xl mx-auto p-4 space-y-6">
        {loading ? (
          <SkeletonList lines={4} />
        ) : (
          <>
            <div className="bg-black rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
              <Coins className="absolute right-[-20px] bottom-[-20px] text-white/10" size={150} />
              <p className="text-[10px] font-black tracking-[0.2em] opacity-60 mb-2">Saldo poin Anda</p>
              <div className="flex items-center gap-3">
                <h2 className="text-5xl font-black italic">{(userData?.points || 0).toLocaleString()}</h2>
                <div className="bg-yellow-400 text-black p-1 rounded-full"><Zap size={14} fill="currentColor" /></div>
              </div>
              {userData?.isPointsFrozen && (
                <div className="mt-4 flex items-center gap-2 bg-red-600/20 text-red-400 p-3 rounded-2xl border border-red-600/30">
                  <Snowflake size={16} />
                  <span className="text-[10px] font-black">Akun dibekukan sementara</span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-black tracking-widest text-gray-400 ml-2">Voucher tersedia</h3>
              {VOUCHER_LIST.length === 0 ? (
                <EmptyState
                  icon={<Ticket className="mx-auto text-slate-200" size={48} />}
                  title="Belum ada voucher"
                  description="Kami akan menambahkan voucher baru untuk ditukar dengan poin Anda."
                />
              ) : (
                VOUCHER_LIST.map((v) => {
                  const isAffordable = (userData?.points || 0) >= v.cost;
                  return (
                    <div key={v.id} className="bg-white rounded-[2rem] p-5 shadow-sm border border-gray-100 flex items-center justify-between group tap-active">
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl ${v.color} flex items-center justify-center text-white shadow-lg shadow-gray-200`}>
                          <Ticket size={24} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black italic leading-tight">{v.name}</h4>
                          <p className="text-[10px] font-bold text-gray-400 flex items-center gap-1 mt-1">
                            <Coins size={10} className="text-yellow-500" /> {v.cost.toLocaleString()} Poin
                          </p>
                        </div>
                      </div>
                      <button
                        disabled={!isAffordable || userData?.isPointsFrozen || isProcessing}
                        onClick={() => handleRedeem(v)}
                        className={`px-6 py-3 rounded-2xl font-black text-[10px] tracking-widest transition-all ${isAffordable
                          ? 'bg-black text-white hover:bg-emerald-500'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                      >
                        {isProcessing ? '...' : isAffordable ? 'Tukar' : <Lock size={14} />}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* INFO */}
        <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
          <h5 className="text-[10px] font-black text-blue-600 mb-2 flex items-center gap-2">
            <Gift size={14} /> Cara menggunakan voucher
          </h5>
          <p className="text-[10px] text-blue-800/70 font-bold leading-relaxed">
            Voucher yang telah ditukar akan muncul di riwayat belanja. Masukkan kode voucher saat checkout untuk memotong harga belanja Anda.
          </p>
        </div>


      </div>
    </div>
  );
}
