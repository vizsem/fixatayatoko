'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  doc, updateDoc, collection, query, where, orderBy, onSnapshot, arrayUnion, arrayRemove 
} from 'firebase/firestore';
import { 
  User, MapPin, Package, LogOut, Edit, Save, Mail, 
  ClipboardList, ChevronRight, ChevronLeft, Loader2, Trash2, Clock, CheckCircle2, Truck,
  Bell, X, Ticket
} from 'lucide-react';
import Link from 'next/link';
import MemberCard from '@/components/MemberCard';

import { User as FirebaseUser } from 'firebase/auth';

// --- TYPES ---
type Address = {
  id: string;
  label: string;
  receiverName: string; 
  receiverPhone: string;
  address: string;
};

interface CartItem {
  id?: string;
  name: string;
  quantity: number;
  price: number;
}

type Order = {
  id: string;
  orderId?: string;
  items: CartItem[];
  total: number;
  status: string;
  createdAt: { toDate: () => Date } | null;
  pointsUsed?: number;
};

interface UserProfile {
  name: string;
  email: string;
  role: string;
  addresses: Address[];
  points?: number;
  isPointsFrozen?: boolean;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<string>('customer');
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  
  // State Input Alamat
  const [newAddress, setNewAddress] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newReceiverName, setNewReceiverName] = useState('');
  const [newReceiverPhone, setNewReceiverPhone] = useState('');
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [showNotif, setShowNotif] = useState(false);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  const [activeOrdersList, setActiveOrdersList] = useState<Order[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 3;

  // --- HELPER STATUS ---
  const getStatusInfo = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING': case 'MENUNGGU': return { label: 'Menunggu', color: 'text-amber-700', bg: 'bg-amber-100', icon: <Clock size={12}/> };
      case 'DIPROSES': return { label: 'Diproses', color: 'text-blue-700', bg: 'bg-blue-100', icon: <Package size={12}/> };
      case 'DIKIRIM': return { label: 'Dikirim', color: 'text-purple-700', bg: 'bg-purple-100', icon: <Truck size={12}/> };
      case 'SELESAI': return { label: 'Selesai', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: <CheckCircle2 size={12}/> };
      case 'BATAL': return { label: 'Batal', color: 'text-rose-700', bg: 'bg-rose-100', icon: <X size={12}/> };
      default: return { label: status, color: 'text-gray-700', bg: 'bg-gray-100', icon: <Clock size={12}/> };
    }
  };

  // --- AUTH & DATA SYNC ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // PERBAIKAN: Arahkan ke /profil/login untuk menghindari 404
        router.push('/profil/login');
        return;
      }
      setUser(firebaseUser);

      // Real-time Listener Data User
      const unsubscribeUser = onSnapshot(doc(db, 'users', firebaseUser.uid), (doc) => {
        if (doc.exists()) {
          const userData = doc.data() as UserProfile;
          setProfile(userData);
          setNewName(userData.name || '');
          setUserRole(userData.role || 'customer');
          setAddresses(userData.addresses || []);
        }
      });

      // Real-time Listener Pesanan
      const q = query(
        collection(db, 'orders'),
        where('userId', '==', firebaseUser.uid),
        orderBy('createdAt', 'desc')
      );

      const unsubscribeOrders = onSnapshot(q, (snapshot) => {
        const orderData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Order));
        setOrders(orderData);
        
        const actives = orderData.filter(o => ['PENDING', 'MENUNGGU', 'DIPROSES', 'DIKIRIM'].includes(o.status?.toUpperCase()));
        setActiveOrdersList(actives);
        setActiveOrdersCount(actives.length);
        setLoading(false);
      }, (err) => {
        console.error("Firestore Order Error:", err);
        setLoading(false);
      });

      return () => {
        unsubscribeUser();
        unsubscribeOrders();
      };
    });

    return () => unsubscribeAuth();
  }, [router]);

  // --- HANDLERS ---
  const handleLogout = async () => {
    await signOut(auth);
    // Hapus token admin jika ada
    document.cookie = "admin-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    router.push('/profil/login');
  };

  const handleSaveName = async () => {
    if (!newName.trim() || isSaving || !user) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { name: newName.trim() });
      setIsEditingName(false);
    } catch {
      alert("Gagal memperbarui nama");
    } finally {
      setIsSaving(false);
    }
  };

  const addAddress = async () => {
    if (!newAddress || !newReceiverName || !user) {
      alert("Lengkapi nama penerima dan alamat!");
      return;
    }
    setIsSaving(true);
    const addressObj: Address = {
      id: Date.now().toString(),
      label: newLabel || 'Rumah',
      receiverName: newReceiverName,
      receiverPhone: newReceiverPhone,
      address: newAddress
    };

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        addresses: arrayUnion(addressObj)
      });
      setNewAddress('');
      setNewLabel('');
      setNewReceiverName('');
      setNewReceiverPhone('');
    } catch {
      alert("Gagal menambah alamat");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteAddress = async (addrId: string) => {
    if (!user || !window.confirm("Hapus alamat ini?")) return;
    const addrToDelete = addresses.find(a => a.id === addrId);
    if (!addrToDelete) return;

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        addresses: arrayRemove(addrToDelete)
      });
    } catch {
      alert("Gagal menghapus alamat");
    }
  };

  const indexOfLastOrder = currentPage * ordersPerPage;
  const currentOrders = orders.slice(indexOfLastOrder - ordersPerPage, indexOfLastOrder);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <Loader2 className="animate-spin text-green-600 mb-2" size={32} />
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Memuat Profil...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      {/* HEADER */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-[100] border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-green-100 hover:text-green-600 transition-all">
              <ChevronLeft size={20} />
            </Link>
            <h1 className="text-sm font-black text-slate-900 uppercase tracking-tighter italic underline decoration-green-500 underline-offset-4">Akun Saya</h1>
          </div>
          
          <button onClick={() => setShowNotif(!showNotif)} className="relative p-3 bg-slate-100 rounded-2xl text-slate-500 group">
            <Bell size={20} className={activeOrdersCount > 0 ? 'animate-bounce' : ''} />
            {activeOrdersCount > 0 && <span className="absolute top-2 right-2 h-2.5 w-2.5 bg-red-500 border-2 border-white rounded-full"></span>}
          </button>
        </div>

        {showNotif && (
          <div className="absolute right-6 top-20 w-80 bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Aktivitas Belanja</span>
              <button onClick={() => setShowNotif(false)}><X size={16}/></button>
            </div>
            <div className="max-h-80 overflow-y-auto p-3 space-y-2">
              {activeOrdersList.length > 0 ? activeOrdersList.map(order => (
                <div key={order.id} onClick={() => router.push(`/transaksi/${order.id}`)} className="p-4 hover:bg-slate-50 rounded-2xl flex gap-3 items-center cursor-pointer border border-transparent hover:border-slate-100 transition-all">
                  <div className="bg-green-100 p-2 rounded-xl text-green-600"><Clock size={16}/></div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-slate-800 uppercase italic">Status: {order.status}</p>
                    <p className="text-[8px] font-bold text-slate-400 mt-1">{order.orderId || order.id.slice(0,8)}</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-200"/>
                </div>
              )) : (
                <div className="py-10 text-center opacity-30 italic text-[10px] font-black uppercase tracking-widest">Belum ada aktivitas</div>
              )}
            </div>
          </div>
        )}
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* KOLOM KIRI: PROFIL & POIN */}
          <div className="space-y-6">
            {/* MEMBER CARD WIDGET (NEW) */}
            <MemberCard 
              name={profile?.name || "Member Ataya"} 
              memberId={user?.uid || "GUEST"} 
              points={profile?.points || 0}
              level={(profile?.points || 0) > 100000 ? 'Platinum' : (profile?.points || 0) > 50000 ? 'Gold' : (profile?.points || 0) > 10000 ? 'Silver' : 'Bronze'}
            />

            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 relative overflow-hidden group">
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-green-600 text-white flex items-center justify-center shadow-lg shadow-green-100">
                    <User size={32} />
                  </div>
                  <div className="flex-1">
                    {isEditingName ? (
                      <div className="flex gap-2">
                        <input value={newName} onChange={e => setNewName(e.target.value)} className="bg-slate-50 px-3 py-1 rounded-lg outline-none font-black text-lg w-full uppercase italic" autoFocus />
                        <button onClick={handleSaveName} disabled={isSaving} className="text-green-600"><Save size={20}/></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group/name">
                        <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">{profile?.name || "Member Ataya"}</h2>
                        <button onClick={() => setIsEditingName(true)} className="opacity-0 group-hover/name:opacity-100 transition-opacity"><Edit size={14} className="text-slate-300 hover:text-green-600"/></button>
                      </div>
                    )}
                    <p className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1 uppercase tracking-widest">
                      <Mail size={10} /> {profile?.email}
                    </p>
                  </div>
                </div>

                {/* POIN WIDGET (Dihapus karena sudah ada di MemberCard, diganti info lain) */}
                <div className="bg-slate-50 rounded-3xl p-6 mt-6 relative overflow-hidden border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><Ticket size={20}/></div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Voucher Saya</p>
                      <h3 className="text-xl font-black text-slate-800 italic">0 Voucher</h3>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3 pt-6 border-t border-dashed border-slate-100">
                {(userRole === 'admin' || userRole === 'cashier') && (
                  <Link href="/admin" className="w-full flex items-center justify-center gap-3 py-4 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-2xl hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all">
                    <ClipboardList size={18} /> Panel {userRole === 'admin' ? 'Admin' : 'Kasir'}
                  </Link>
                )}
                <button onClick={handleLogout} className="w-full py-4 text-slate-400 text-[10px] font-black uppercase rounded-2xl hover:bg-rose-50 hover:text-rose-500 transition-all flex items-center justify-center gap-2">
                  <LogOut size={16} /> Keluar Akun
                </button>
              </div>
            </div>

            {/* BAGIAN ALAMAT */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <MapPin size={14} className="text-green-600" /> Alamat Tersimpan
              </h3>
              <div className="space-y-4 mb-8">
                {addresses.length > 0 ? addresses.map(addr => (
                  <div key={addr.id} className="p-5 bg-slate-50 rounded-3xl relative border border-slate-50 group">
                    <p className="text-[10px] font-black text-green-600 uppercase italic mb-1">{addr.label}</p>
                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{addr.receiverName}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase leading-relaxed">{addr.address}</p>
                    <button onClick={() => deleteAddress(addr.id)} className="absolute top-5 right-5 text-slate-300 hover:text-rose-500 transition-colors">
                      <Trash2 size={16}/>
                    </button>
                  </div>
                )) : <p className="text-[10px] text-center italic text-slate-300 py-4">Belum ada alamat.</p>}
              </div>
              
              <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-dashed border-slate-200 space-y-3">
                <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="LABEL (MISAL: RUMAH)..." className="w-full bg-white rounded-xl px-4 py-3 text-[10px] font-black uppercase outline-none border border-slate-100 focus:border-green-500" />
                <input value={newReceiverName} onChange={e => setNewReceiverName(e.target.value)} placeholder="NAMA PENERIMA..." className="w-full bg-white rounded-xl px-4 py-3 text-[10px] font-black uppercase outline-none border border-slate-100 focus:border-green-500" />
                <input value={newReceiverPhone} onChange={e => setNewReceiverPhone(e.target.value)} placeholder="NO. WHATSAPP..." className="w-full bg-white rounded-xl px-4 py-3 text-[10px] font-black uppercase outline-none border border-slate-100 focus:border-green-500" />
                <textarea value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="ALAMAT LENGKAP..." className="w-full bg-white rounded-xl px-4 py-3 text-[10px] font-black uppercase outline-none border border-slate-100 h-20 resize-none" />
                <button onClick={addAddress} disabled={isSaving} className="w-full bg-black text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all">
                   {isSaving ? <Loader2 className="animate-spin" size={14}/> : <Save size={14}/>} Simpan Alamat
                </button>
              </div>
            </div>
          </div>

          {/* KOLOM KANAN: RIWAYAT PESANAN */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 min-h-[600px]">
              <div className="flex items-center justify-between mb-8">
                <div>
                   <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest italic">Riwayat Transaksi</h3>
                   <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Total {orders.length} Pesanan</p>
                </div>
                {activeOrdersCount > 0 && (
                   <div className="bg-green-100 text-green-600 px-4 py-2 rounded-full flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-600 rounded-full animate-ping"></div>
                      <span className="text-[9px] font-black uppercase tracking-widest">{activeOrdersCount} Aktif</span>
                   </div>
                )}
              </div>

              {orders.length === 0 ? (
                <div className="text-center py-24 italic opacity-40">
                  <Package className="mx-auto text-slate-200 mb-4" size={64} />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em]">Belum ada riwayat belanja</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentOrders.map(order => {
                    const status = getStatusInfo(order.status);
                    const isActive = ['PENDING', 'MENUNGGU', 'DIPROSES', 'DIKIRIM'].includes(order.status?.toUpperCase());

                    return (
                      <div key={order.id} className={`p-6 border rounded-[2rem] transition-all relative overflow-hidden group ${isActive ? 'bg-green-50/30 border-green-100' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-2xl bg-gray-50 ${status.color}`}>
                                {status.icon}
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black uppercase italic tracking-tighter">{order.orderId || `INV-${order.id.slice(0,8).toUpperCase()}`}</h4>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">
                                    {order.createdAt?.toDate ? new Date(order.createdAt.toDate()).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'}) : '-'}
                                </p>
                            </div>
                          </div>
                          <span className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest ${status.color} ${status.bg}`}>
                            {status.label}
                          </span>
                        </div>

                        <div className="mb-6">
                            {order.items?.slice(0, 1).map((item, i) => (
                                <p key={i} className="text-xs font-black text-slate-800 uppercase italic line-clamp-1">{item.name} <span className="text-slate-400 ml-1">x{item.quantity}</span></p>
                            ))}
                            {order.items?.length > 1 && <p className="text-[9px] font-bold text-slate-400 mt-1">+ {order.items.length - 1} PRODUK LAINNYA</p>}
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-dashed border-slate-200">
                          <div>
                             <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Bayar</p>
                             <p className="text-xl font-black text-slate-900 italic tracking-tighter">Rp{(order.total || 0).toLocaleString()}</p>
                          </div>
                          <Link href={`/transaksi/${order.id}`} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 text-slate-400 hover:text-green-600 hover:border-green-100 transition-all">
                             <ChevronRight size={20} />
                          </Link>
                        </div>
                      </div>
                    );
                  })}

                  {/* PAGINASI */}
                  {orders.length > ordersPerPage && (
                    <div className="flex items-center justify-center gap-2 mt-10">
                      <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} className="p-2 text-slate-300 hover:text-green-600 disabled:opacity-20 transition-all"><ChevronLeft/></button>
                      {[...Array(Math.ceil(orders.length/ordersPerPage))].map((_, i) => (
                        <button key={i} onClick={() => setCurrentPage(i+1)} className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all ${currentPage === i+1 ? 'bg-green-600 text-white shadow-lg shadow-green-100' : 'bg-slate-100 text-slate-400'}`}>{i+1}</button>
                      ))}
                      <button onClick={() => setCurrentPage(p => Math.min(Math.ceil(orders.length/ordersPerPage), p+1))} disabled={currentPage === Math.ceil(orders.length/ordersPerPage)} className="p-2 text-slate-300 hover:text-green-600 disabled:opacity-20 transition-all"><ChevronRight/></button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}