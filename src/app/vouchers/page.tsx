'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';

import {
  collection, doc, getDoc, getDocs,
  updateDoc, addDoc, increment, serverTimestamp
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import {
  Ticket, Coins, ArrowLeft, Lock,
  Gift, Zap, Snowflake, Truck, Wallet, Store, Percent
} from 'lucide-react';
import { ChipFilter, ChipKey } from '@/components/ChipFilter';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { User as FirebaseUser } from 'firebase/auth';
import { UserProfile } from '@/lib/types';
import { SkeletonList, EmptyState } from '@/components/UIState';

interface UserData extends UserProfile {
  _addresses?: unknown[]; // internal extended field
}

type VoucherCategory = Extract<ChipKey, 'DISKON' | 'ONGKIR' | 'CASHBACK' | 'TOKO'>;
interface Voucher {
  id: string;
  name: string;
  cost: number;
  value: number;
  color: string;
  category: VoucherCategory;
}


// Data Statis Voucher (Bisa dipindah ke Firestore nantinya)
const VOUCHER_LIST: Voucher[] = [
  { id: 'v1', name: 'Potongan Rp 5.000', cost: 5000, value: 5000, color: 'bg-emerald-500', category: 'DISKON' },
  { id: 'v2', name: 'Potongan Rp 15.000', cost: 14000, value: 15000, color: 'bg-blue-500', category: 'DISKON' }, // Diskon poin (14rb poin dpt 15rb)
  { id: 'v3', name: 'Potongan Rp 50.000', cost: 45000, value: 50000, color: 'bg-purple-600', category: 'DISKON' },
  { id: 'v4', name: 'Gratis Ongkir Toko', cost: 10000, value: 10000, color: 'bg-orange-500', category: 'ONGKIR' },
  { id: 'v5', name: 'Cashback Rp 10.000', cost: 10000, value: 10000, color: 'bg-pink-500', category: 'CASHBACK' },
  { id: 'v6', name: 'Voucher Toko Rp 20.000', cost: 18000, value: 20000, color: 'bg-teal-600', category: 'TOKO' },
];

// Kategori untuk ChipFilter
const VOUCHER_CHIPS: { key: ChipKey; label: string }[] = [
  { key: 'SEMUA', label: 'Semua' },
  { key: 'DISKON', label: 'Diskon' },
  { key: 'ONGKIR', label: 'Ongkir' },
  { key: 'CASHBACK', label: 'Cashback' },
  { key: 'TOKO', label: 'Voucher Toko' },
];

export default function VoucherExchangePage() {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);

  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeChip, setActiveChip] = useState<ChipKey>('SEMUA');
  const [vouchers, setVouchers] = useState<Voucher[]>([]);

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

  useEffect(() => {
    // Ambil voucher dari Firestore (koleksi: vouchers)
    const fetchVouchers = async () => {
      try {
        const snap = await getDocs(collection(db, 'vouchers'));
        const docs: Voucher[] = snap.docs.map((d) => {
          const data = d.data() as Partial<Voucher>;
          return {
            id: d.id,
            name: data.name ?? 'Voucher',
            cost: Number(data.cost ?? 0),
            value: Number(data.value ?? 0),
            color: typeof data.color === 'string' ? data.color : 'bg-emerald-500',
            category: (data.category as VoucherCategory) ?? 'DISKON',
          };
        });
        setVouchers(docs);
      } catch {
        // Biarkan fallback ke VOUCHER_LIST
      }
    };
    fetchVouchers();
  }, []);

  const handleRedeem = async (voucher: Voucher) => {
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

  const sourceVouchers = vouchers.length > 0 ? vouchers : VOUCHER_LIST;
  const filteredVouchers = sourceVouchers.filter(
    (v) => activeChip === 'SEMUA' || v.category === (activeChip as VoucherCategory)
  );

  const categoryIcon = (c: VoucherCategory) => {
    if (c === 'DISKON') return <Percent size={24} />;
    if (c === 'ONGKIR') return <Truck size={24} />;
    if (c === 'CASHBACK') return <Wallet size={24} />;
    return <Store size={24} />;
  };

  const categoryBadgeCls = (c: VoucherCategory) => {
    if (c === 'DISKON') return 'bg-emerald-50 text-emerald-700';
    if (c === 'ONGKIR') return 'bg-orange-50 text-orange-700';
    if (c === 'CASHBACK') return 'bg-pink-50 text-pink-700';
    return 'bg-teal-50 text-teal-700';
  };

  const categoryLabel = (c: VoucherCategory) => {
    if (c === 'DISKON') return 'Diskon';
    if (c === 'ONGKIR') return 'Ongkir';
    if (c === 'CASHBACK') return 'Cashback';
    return 'Voucher Toko';
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
        {/* ChipFilter untuk jenis voucher */}
        <ChipFilter items={VOUCHER_CHIPS} value={activeChip} onChange={setActiveChip} />
        
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
              {filteredVouchers.length === 0 ? (
                <EmptyState
                  icon={<Ticket className="mx-auto text-slate-200" size={48} />}
                  title="Belum ada voucher"
                  description="Kami akan menambahkan voucher baru untuk ditukar dengan poin Anda."
                />
              ) : (
                filteredVouchers.map((v) => {
                  const isAffordable = (userData?.points || 0) >= v.cost;
                  return (
                    <div key={v.id} className="bg-white rounded-[2rem] p-5 shadow-sm border border-gray-100 flex items-center justify-between group tap-active">
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl ${v.color} flex items-center justify-center text-white shadow-lg shadow-gray-200`}>
                          {categoryIcon(v.category)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black italic leading-tight">{v.name}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${categoryBadgeCls(v.category)}`}>
                              {categoryLabel(v.category)}
                            </span>
                          </div>
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
