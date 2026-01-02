'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut, updateProfile } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { 
  Store, User, MapPin, Package, Heart, LogOut, Edit, Save, Mail, 
  ClipboardList, Star, ChevronRight, ChevronLeft, Loader2, Trash2, Clock, CheckCircle2, Truck,
  Bell, Tag, X, Info
} from 'lucide-react';
import Link from 'next/link';

type Address = {
  id: string;
  label: string;
  receiverName: string; 
  receiverPhone: string;
  address: string;
  lat: number;
  lng: number;
};

type Order = {
  id: string;
  orderId: string;
  items: any[];
  total: number;
  status: string;
  createdAt: any;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('customer');
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [newAddress, setNewAddress] = useState('');
  const [newReceiverName, setNewReceiverName] = useState('');
  const [newReceiverPhone, setNewReceiverPhone] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // --- STATE NOTIFIKASI & UI ---
  const [showNotif, setShowNotif] = useState(false);
  const [hasNewPromo, setHasNewPromo] = useState(false);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  const [activeOrdersList, setActiveOrdersList] = useState<Order[]>([]);

  // --- STATE PAGINASI ---
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 3;

  const getStatusInfo = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING': return { color: 'bg-amber-100 text-amber-700', icon: <Clock size={12}/> };
      case 'DIPROSES': return { color: 'bg-blue-100 text-blue-700', icon: <Package size={12}/> };
      case 'DIKIRIM': return { color: 'bg-purple-100 text-purple-700', icon: <Truck size={12}/> };
      case 'SELESAI': return { color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 size={12}/> };
      case 'BATAL': return { color: 'bg-rose-100 text-rose-700', icon: <Trash2 size={12}/> };
      default: return { color: 'bg-gray-100 text-gray-700', icon: <Clock size={12}/> };
    }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push('/profil/login');
        setLoading(false);
        return;
      }
      setUser(firebaseUser);

      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        setProfile(userData);
        setNewName(userData.name || '');
        setUserRole(userData.role || 'customer');
        setAddresses(userData.addresses || []);
      }

      // Real-time Orders Listener
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
        
        // Filter pesanan aktif untuk dropdown notifikasi
        const actives = orderData.filter(o => ['PENDING', 'DIPROSES', 'DIKIRIM'].includes(o.status?.toUpperCase()));
        setActiveOrdersList(actives);
        setActiveOrdersCount(actives.length);
        
        setLoading(false);
      });

      // Listener Promo Aktif
      const qPromo = query(collection(db, 'promotions'), where('active', '==', true));
      const unsubscribePromo = onSnapshot(qPromo, (snapshot) => {
        setHasNewPromo(!snapshot.empty);
      });

      return () => {
        unsubscribeOrders();
        unsubscribePromo();
      };
    });

    return () => unsubscribeAuth();
  }, [router]);

  // Logika Paginasi
  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const currentOrders = orders.slice(indexOfFirstOrder, indexOfLastOrder);
  const totalPages = Math.ceil(orders.length / ordersPerPage);

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.clear();
    router.push('/');
  };

  const handleSaveName = async () => {
    if (!newName.trim() || isSaving || !user) return;
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { name: newName.trim() });
      if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: newName.trim() });
      setProfile({ ...profile, name: newName.trim() });
      setIsEditingName(false);
    } catch (error) {
      alert("Gagal memperbarui nama");
    } finally {
      setIsSaving(false);
    }
  };

  const addAddress = async () => {
    if (!newAddress.trim() || !newReceiverName.trim() || !newReceiverPhone.trim() || isSaving || !user) return;
    setIsSaving(true);
    const newAddr: Address = {
      id: `addr-${Date.now()}`,
      label: `Alamat ${addresses.length + 1}`,
      receiverName: newReceiverName.trim(),
      receiverPhone: newReceiverPhone.trim(),
      address: newAddress.trim(),
      lat: -7.8014, lng: 111.8139
    };
    try {
      const updated = [...addresses, newAddr];
      await updateDoc(doc(db, 'users', user.uid), { addresses: updated });
      setAddresses(updated);
      setNewAddress(''); setNewReceiverName(''); setNewReceiverPhone('');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteAddress = async (id: string) => {
    if(!user || !confirm("Hapus alamat ini?")) return;
    const updated = addresses.filter(a => a.id !== id);
    await updateDoc(doc(db, 'users', user.uid), { addresses: updated });
    setAddresses(updated);
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <Loader2 className="animate-spin text-green-600 mb-2" size={32} />
      <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Sinkronisasi Pesanan...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white shadow-sm sticky top-0 z-[100] border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/"><Store className="text-green-600" size={28} /></Link>
            <Link href="/" className="text-gray-500 hover:text-green-600 text-xs font-bold uppercase tracking-tighter">← Beranda</Link>
          </div>
          
          <div className="flex items-center gap-3">
             {/* Ikon Notifikasi Klikable */}
             <button 
                onClick={() => setShowNotif(!showNotif)}
                className="relative p-2 bg-gray-50 rounded-2xl hover:bg-green-50 transition-all text-gray-500 hover:text-green-600 group"
             >
                <Bell size={20} className={activeOrdersCount > 0 ? 'animate-swing' : ''} />
                {(activeOrdersCount > 0 || hasNewPromo) && (
                  <span className="absolute top-1 right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                  </span>
                )}
             </button>
             <h1 className="hidden sm:block text-xs font-black text-gray-400 uppercase tracking-widest">Pusat Akun</h1>
          </div>
        </div>

        {/* Dropdown Notifikasi */}
        {showNotif && (
          <>
            <div className="fixed inset-0 z-[-1]" onClick={() => setShowNotif(false)} />
            <div className="absolute right-4 top-16 w-80 bg-white rounded-[2rem] shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-4 bg-gray-50/50 border-b border-gray-50 flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Aktivitas Terbaru</span>
                <button onClick={() => setShowNotif(false)} className="text-gray-300 hover:text-red-500"><X size={16}/></button>
              </div>
              <div className="max-h-80 overflow-y-auto p-2 space-y-2">
                {hasNewPromo && (
                  <div className="p-3 bg-red-50 rounded-2xl flex gap-3 items-center border border-red-100">
                    <Tag size={16} className="text-red-500" />
                    <div>
                      <p className="text-[10px] font-black text-red-600 uppercase leading-none">Promo Aktif!</p>
                      <p className="text-[9px] font-bold text-red-400 mt-1">Cek penawaran terbatas hari ini.</p>
                    </div>
                  </div>
                )}
                {activeOrdersList.length > 0 ? (
                  activeOrdersList.map(order => (
                    <div 
                      key={order.id} 
                      onClick={() => { setShowNotif(false); router.push(`/success?id=${order.orderId || order.id}`); }}
                      className="p-3 hover:bg-gray-50 rounded-2xl flex gap-3 items-center border border-transparent hover:border-gray-100 transition-all cursor-pointer"
                    >
                      <div className="bg-green-100 p-2 rounded-xl text-green-600"><Package size={14}/></div>
                      <div className="flex-1">
                        <p className="text-[10px] font-black text-gray-800 uppercase leading-none">Pesanan {order.status}</p>
                        <p className="text-[8px] font-bold text-gray-400 mt-1">{order.orderId || order.id}</p>
                      </div>
                      <ChevronRight size={14} className="text-gray-300"/>
                    </div>
                  ))
                ) : !hasNewPromo && (
                  <div className="py-10 text-center">
                    <Info size={24} className="mx-auto text-gray-200 mb-2"/>
                    <p className="text-[10px] font-black text-gray-300 uppercase">Tidak ada pemberitahuan</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            {/* Kartu Profil */}
            <div className="bg-white rounded-3xl shadow-sm p-6 border border-gray-100 relative overflow-hidden">
              {activeOrdersCount > 0 && (
                <div className="absolute top-4 right-4 flex items-center gap-1 bg-green-500 text-white px-2 py-1 rounded-full animate-bounce shadow-lg shadow-green-100 z-10">
                  <Bell size={10} fill="currentColor"/>
                  <span className="text-[8px] font-black">{activeOrdersCount}</span>
                </div>
              )}

              <div className="flex items-center gap-4 mb-6">
                <div className="bg-green-100 w-16 h-16 rounded-2xl flex items-center justify-center text-green-600 shadow-inner">
                  <User size={32} />
                </div>
                <div className="flex-1">
                  {isEditingName ? (
                    <div className="flex gap-2">
                      <input value={newName} onChange={e => setNewName(e.target.value)} className="border-b-2 border-green-600 outline-none font-bold text-lg w-full" autoFocus />
                      <button onClick={handleSaveName} className="text-green-600">{isSaving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}</button>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-xl font-black text-gray-800 uppercase leading-none">{profile?.name || "Pelanggan Ataya"}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="bg-yellow-100 text-yellow-700 text-[9px] px-2 py-0.5 rounded-full font-black uppercase flex items-center gap-1"><Star size={10} fill="currentColor"/> Member Ataya</span>
                        <button onClick={() => setIsEditingName(true)} className="text-[10px] text-gray-400 font-bold hover:text-green-600 flex items-center gap-1 uppercase"><Edit size={10}/> Edit</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-4 pt-4 border-t border-dashed">
                <div className="flex items-center gap-3 text-gray-600">
                  <Mail size={16} className="text-gray-300"/><span className="text-xs font-bold">{profile?.email || '-'}</span>
                </div>
                {(userRole === 'admin' || userRole === 'cashier') && (
                  <Link href="/cashier" className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white text-[10px] font-black uppercase rounded-2xl shadow-lg shadow-green-100">
                    <ClipboardList size={16} /> Buka Dashboard Kasir
                  </Link>
                )}
                <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-3 text-red-500 text-[10px] font-black uppercase border-2 border-red-50 rounded-2xl hover:bg-red-50 transition-all"><LogOut size={16} /> Logout</button>
              </div>
            </div>

            {/* Alamat Pengiriman */}
            <div className="bg-white rounded-3xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Alamat Tersimpan</h3>
              <div className="space-y-3 mb-6">
                {addresses.map(addr => (
                  <div key={addr.id} className="p-4 bg-gray-50 rounded-2xl relative border border-gray-100 group transition-all">
                    <div className="flex gap-3">
                      <MapPin size={16} className="text-red-400 shrink-0 mt-1" />
                      <div className="flex-1">
                        <p className="text-[10px] font-black uppercase text-green-600 mb-1">{addr.label}</p>
                        <p className="text-xs font-black text-gray-800 mb-1">{addr.receiverName}</p>
                        <p className="text-[10px] font-bold text-gray-500 leading-relaxed">{addr.address}</p>
                      </div>
                    </div>
                    <button onClick={() => deleteAddress(addr.id)} className="absolute top-4 right-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl space-y-3 border-2 border-dashed border-gray-200">
                <input value={newReceiverName} onChange={e => setNewReceiverName(e.target.value)} placeholder="Nama Penerima" className="w-full bg-white rounded-xl px-4 py-2 text-xs font-bold outline-none border border-gray-100 focus:border-green-500 transition-all" />
                <input value={newReceiverPhone} onChange={e => setNewReceiverPhone(e.target.value)} placeholder="No. WA (08...)" className="w-full bg-white rounded-xl px-4 py-2 text-xs font-bold outline-none border border-gray-100 focus:border-green-500 transition-all" />
                <textarea value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="Alamat Lengkap..." className="w-full bg-white rounded-xl px-4 py-2 text-xs font-bold outline-none border border-gray-100 h-16 focus:border-green-500 transition-all" />
                <button onClick={addAddress} disabled={isSaving} className="w-full bg-green-600 text-white py-3 rounded-xl font-black text-[10px] uppercase shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all">
                   <Save size={14}/> Simpan Alamat
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {/* RIWAYAT PESANAN DENGAN PAGINASI */}
            <div className="bg-white rounded-3xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                   <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Lacak Pesanan</h3>
                   {activeOrdersCount > 0 && (
                     <span className="bg-green-100 text-green-700 text-[8px] font-black px-2 py-0.5 rounded-full animate-pulse uppercase">Aktif</span>
                   )}
                </div>
                <span className="bg-slate-100 text-slate-500 text-[9px] px-2 py-1 rounded-full font-black">{orders.length} Transaksi</span>
              </div>

              {orders.length === 0 ? (
                <div className="text-center py-16">
                  <Package className="mx-auto text-gray-100 mb-4" size={64} />
                  <p className="text-xs font-black text-gray-300 uppercase">Belum ada pesanan</p>
                  <Link href="/" className="text-green-600 text-[10px] font-black uppercase underline mt-2 block">Mulai Belanja</Link>
                </div>
              ) : (
                <>
                  <div className="grid gap-4">
                    {currentOrders.map(order => {
                      const statusInfo = getStatusInfo(order.status);
                      const isOrderActive = ['PENDING', 'DIPROSES', 'DIKIRIM'].includes(order.status?.toUpperCase());

                      return (
                        <div key={order.id} className={`p-5 border rounded-[2rem] transition-all bg-white relative overflow-hidden group ${isOrderActive ? 'border-green-200 shadow-lg shadow-green-50/50' : 'border-gray-100'}`}>
                          {order.status === 'DIKIRIM' && (
                            <div className="absolute top-0 right-10 flex h-3 w-3 mt-4">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                            </div>
                          )}

                          <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${statusInfo.color.split(' ')[1]}`} />
                          
                          <div className="flex justify-between items-start mb-4 pl-2">
                            <div>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{order.orderId || `INV-${order.id.slice(0,5).toUpperCase()}`}</p>
                              <p className="text-[10px] font-bold text-gray-500">
                                  {order.createdAt?.toDate ? new Date(order.createdAt.toDate()).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) : '-'}
                              </p>
                            </div>
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase shadow-sm ${statusInfo.color} ${isOrderActive ? 'animate-pulse' : ''}`}>
                              {statusInfo.icon}
                              {order.status || 'PENDING'}
                            </div>
                          </div>

                          <div className="pl-2 mb-4 space-y-1">
                             {order.items?.slice(0, 1).map((item, idx) => (
                               <p key={idx} className="text-xs font-black text-gray-800 truncate">{item.name} <span className="text-gray-400 font-bold ml-1">x{item.quantity}</span></p>
                             ))}
                             {order.items?.length > 1 && (
                               <p className="text-[10px] text-gray-400 font-bold">+{order.items.length - 1} produk lainnya...</p>
                             )}
                          </div>

                          <div className="pt-4 border-t border-gray-50 flex justify-between items-center pl-2">
                            <div>
                              <p className="text-[9px] font-black text-gray-400 uppercase">Total Belanja</p>
                              <p className="text-lg font-black text-green-600 tracking-tight">Rp{(order.total || 0).toLocaleString()}</p>
                            </div>
                            <Link href={`/success?id=${order.orderId || order.id}`} className="bg-slate-50 hover:bg-green-50 p-3 rounded-2xl transition-colors group">
                              <ChevronRight size={18} className="text-gray-300 group-hover:text-green-600" />
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Navigasi Paginasi */}
                  {orders.length > ordersPerPage && (
                    <div className="flex items-center justify-center gap-4 mt-8 pt-6 border-t border-gray-50">
                      <button 
                        onClick={() => { setCurrentPage(prev => Math.max(prev - 1, 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        disabled={currentPage === 1}
                        className={`p-2 rounded-xl border transition-all ${currentPage === 1 ? 'text-gray-200 border-gray-100 cursor-not-allowed' : 'text-green-600 border-green-100 hover:bg-green-50'}`}
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <div className="flex gap-2">
                        {[...Array(totalPages)].map((_, i) => (
                          <button key={i} onClick={() => { setCurrentPage(i + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all ${currentPage === i + 1 ? 'bg-green-600 text-white shadow-lg shadow-green-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                            {i + 1}
                          </button>
                        ))}
                      </div>
                      <button 
                        onClick={() => { setCurrentPage(prev => Math.min(prev + 1, totalPages)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        disabled={currentPage === totalPages}
                        className={`p-2 rounded-xl border transition-all ${currentPage === totalPages ? 'text-gray-200 border-gray-100 cursor-not-allowed' : 'text-green-600 border-green-100 hover:bg-green-50'}`}
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Banner Promo & Wishlist */}
            <div className="bg-gradient-to-br from-red-500 to-pink-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-red-100 flex items-center justify-between overflow-hidden relative group transition-all duration-500 hover:shadow-2xl">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                   <h3 className="text-xl font-black uppercase tracking-tight">Promo Menantimu</h3>
                   {hasNewPromo && <span className="bg-white text-red-600 text-[8px] font-black px-2 py-0.5 rounded-full animate-bounce">HOT</span>}
                </div>
                <p className="text-[10px] font-bold opacity-80 mb-6 uppercase tracking-widest leading-relaxed">Dapatkan potongan harga spesial<br/>untuk belanjaanmu hari ini!</p>
                <Link href="/" className="bg-white text-red-600 px-8 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg hover:shadow-xl transition-all flex items-center gap-2 w-fit active:scale-95">
                   <Tag size={14}/> Jelajahi Promo
                </Link>
              </div>
              <Heart className="absolute -right-6 -bottom-6 text-white/10 group-hover:scale-125 group-hover:rotate-12 transition-transform duration-700" size={180} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}