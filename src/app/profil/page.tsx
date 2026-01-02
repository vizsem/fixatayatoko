'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { 
  Store, User, MapPin, Package, Heart, LogOut, Edit, Save, Mail, Phone, 
  ClipboardList, Star, ChevronRight, Loader2, Trash2, Clock, CheckCircle2, Truck
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

  // Helper untuk Warna Status Pesanan
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

      // 1. Ambil Profil & Alamat
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        setProfile(userData);
        setNewName(userData.name || '');
        setUserRole(userData.role || 'customer');
        setAddresses(userData.addresses || []);
      }

      // 2. Listener Pesanan Real-time (Pantau Perubahan Status dari Back Office)
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
        setLoading(false);
      });

      return () => unsubscribeOrders();
    });

    return () => unsubscribeAuth();
  }, [router]);

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
      setProfile({ ...profile, name: newName.trim() });
      setIsEditingName(false);
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
      setNewAddress('');
      setNewReceiverName('');
      setNewReceiverPhone('');
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
      <header className="bg-white shadow-sm sticky top-0 z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/"><Store className="text-green-600" size={28} /></Link>
            <Link href="/" className="text-gray-500 hover:text-green-600 text-xs font-bold uppercase tracking-tighter">← Beranda</Link>
          </div>
          <h1 className="text-xs font-black text-gray-400 uppercase tracking-widest">Pusat Akun</h1>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="space-y-6">
            {/* Kartu Profil */}
            <div className="bg-white rounded-3xl shadow-sm p-6 border border-gray-100">
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
                  <div key={addr.id} className="p-4 bg-gray-50 rounded-2xl relative border border-gray-100 group">
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
                <input value={newReceiverName} onChange={e => setNewReceiverName(e.target.value)} placeholder="Nama Penerima" className="w-full bg-white rounded-xl px-4 py-2 text-xs font-bold outline-none border border-gray-100" />
                <input value={newReceiverPhone} onChange={e => setNewReceiverPhone(e.target.value)} placeholder="No. WA (08...)" className="w-full bg-white rounded-xl px-4 py-2 text-xs font-bold outline-none border border-gray-100" />
                <textarea value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="Alamat Lengkap..." className="w-full bg-white rounded-xl px-4 py-2 text-xs font-bold outline-none border border-gray-100 h-16" />
                <button onClick={addAddress} disabled={isSaving} className="w-full bg-green-600 text-white py-3 rounded-xl font-black text-[10px] uppercase shadow-md flex items-center justify-center gap-2">
                   <Save size={14}/> Simpan Alamat
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {/* RIWAYAT PESANAN REAL-TIME */}
            <div className="bg-white rounded-3xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Lacak Pesanan</h3>
                <span className="bg-slate-100 text-slate-500 text-[9px] px-2 py-1 rounded-full font-black">{orders.length} Transaksi</span>
              </div>

              {orders.length === 0 ? (
                <div className="text-center py-16">
                  <Package className="mx-auto text-gray-100 mb-4" size={64} />
                  <p className="text-xs font-black text-gray-300 uppercase">Belum ada pesanan</p>
                  <Link href="/" className="text-green-600 text-[10px] font-black uppercase underline mt-2 block">Mulai Belanja Sekarang</Link>
                </div>
              ) : (
                <div className="grid gap-4">
                  {orders.map(order => {
                    const statusInfo = getStatusInfo(order.status);
                    return (
                      <div key={order.id} className="p-5 border border-gray-100 rounded-[2rem] hover:border-green-200 transition-all bg-white relative overflow-hidden group">
                        {/* Strip Status di Samping */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusInfo.color.split(' ')[1]}`} />
                        
                        <div className="flex justify-between items-start mb-4 pl-2">
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{order.orderId || `INV-${order.id.slice(0,5).toUpperCase()}`}</p>
                            <p className="text-[10px] font-bold text-gray-500">
                                {order.createdAt?.toDate ? new Date(order.createdAt.toDate()).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) : '-'}
                            </p>
                          </div>
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase shadow-sm ${statusInfo.color}`}>
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
              )}
            </div>

            {/* Banner Wishlist */}
            <div className="bg-gradient-to-br from-red-500 to-pink-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-red-100 flex items-center justify-between overflow-hidden relative">
              <div className="relative z-10">
                <h3 className="text-xl font-black uppercase tracking-tight mb-1">Daftar Keinginan</h3>
                <p className="text-[10px] font-bold opacity-80 mb-6 uppercase tracking-widest">Produk yang kamu simpan untuk nanti</p>
                <Link href="/" className="bg-white text-red-600 px-8 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg hover:shadow-xl transition-all">Jelajahi Produk</Link>
              </div>
              <Heart className="absolute -right-6 -bottom-6 text-white/10 group-hover:scale-125 transition-transform duration-500" size={180} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}