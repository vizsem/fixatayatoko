'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc 
} from 'firebase/firestore';
import { 
  Store, User, MapPin, Package, Heart, LogOut, Edit, Save, Mail, Phone, 
  ClipboardList, Star, ChevronRight, Loader2, Trash2
} from 'lucide-react';
import Link from 'next/link';

// Tipe untuk alamat
type Address = {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
};

// Tipe untuk pesanan
type Order = {
  id: string;
  customerName: string;
  customerPhone: string;
  items: any[];
  total: number;
  paymentMethod: string;
  deliveryMethod: string;
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
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [newAddress, setNewAddress] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Handle authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push('/profil/login');
        setLoading(false);
        return;
      }

      setUser(firebaseUser);

      try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setProfile(userData);
          setNewName(userData.name || '');
          setUserRole(userData.role || 'customer');
          
          // Load Alamat
          setAddresses(userData.addresses || []);
          
          // Load Pesanan
          const orderIds = userData.orders || [];
          if (orderIds.length > 0) {
            const orderPromises = orderIds.map((id: string) => getDoc(doc(db, 'orders', id)));
            const orderDocs = await Promise.all(orderPromises);
            const orderData = orderDocs
              .filter(doc => doc.exists())
              .map(doc => ({ id: doc.id, ...doc.data() } as Order));
            setOrders(orderData.sort((a, b) => b.createdAt - a.createdAt));
          }
        } else {
          const newUser = {
            name: firebaseUser.displayName || 'Pelanggan',
            email: firebaseUser.email || '',
            role: 'customer',
            createdAt: new Date().toISOString(),
            addresses: [],
            orders: []
          };
          await setDoc(userRef, newUser);
          setProfile(newUser);
          setNewName(newUser.name);
        }
      } catch (error) {
        console.error('Error:', error);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.clear();
    router.push('/');
  };

  const handleSaveName = async () => {
    if (!newName.trim() || isSaving) return;
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
    if (!newAddress.trim() || isSaving) return;
    setIsSaving(true);
    const newAddr = {
      id: `addr-${Date.now()}`,
      label: `Alamat ${addresses.length + 1}`,
      address: newAddress.trim(),
      lat: -7.8014, lng: 111.8139
    };
    const updated = [...addresses, newAddr];
    await updateDoc(doc(db, 'users', user.uid), { addresses: updated });
    setAddresses(updated);
    setNewAddress('');
    setIsSaving(false);
  };

  const deleteAddress = async (id: string) => {
    const updated = addresses.filter(a => a.id !== id);
    await updateDoc(doc(db, 'users', user.uid), { addresses: updated });
    setAddresses(updated);
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <Loader2 className="animate-spin text-green-600 mb-2" size={32} />
      <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Memuat Profil...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header Baru dengan Navigasi Dashboard */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/"><Store className="text-green-600" size={28} /></Link>
            <Link href="/" className="text-gray-500 hover:text-green-600 text-xs font-bold uppercase tracking-tighter">← Beranda</Link>
            
            {/* Link Dashboard Kasir untuk Admin/Kasir */}
            {(userRole === 'admin' || userRole === 'cashier') && (
              <Link href="/cashier" className="bg-green-600 text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1 shadow-lg shadow-green-100">
                <ClipboardList size={12} /> Dashboard POS
              </Link>
            )}
          </div>
          <h1 className="text-xs font-black text-gray-400 uppercase tracking-widest">Akun Saya</h1>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Sisi Kiri: Profil & Alamat */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-green-100 w-16 h-16 rounded-2xl flex items-center justify-center text-green-600 shadow-inner">
                  <User size={32} />
                </div>
                <div className="flex-1">
                  {isEditingName ? (
                    <div className="flex gap-2">
                      <input value={newName} onChange={e => setNewName(e.target.value)} className="border-b-2 border-green-600 outline-none font-bold text-lg w-full" autoFocus />
                      <button onClick={handleSaveName} className="text-green-600">{isSaving ? <Loader2 className="animate-spin"/> : <Save size={20}/>}</button>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-xl font-black text-gray-800 uppercase leading-none">{profile.name}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="bg-yellow-100 text-yellow-700 text-[9px] px-2 py-0.5 rounded-full font-black uppercase flex items-center gap-1">
                          <Star size={10} fill="currentColor"/> Member Reguler
                        </span>
                        <button onClick={() => setIsEditingName(true)} className="text-[10px] text-gray-400 font-bold hover:text-green-600 flex items-center gap-1 uppercase">
                          <Edit size={10}/> Edit
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-dashed">
                <div className="flex items-center gap-3 text-gray-600">
                  <Mail size={16} className="text-gray-300"/>
                  <span className="text-xs font-bold">{profile.email || 'Email belum diatur'}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-600">
                  <Phone size={16} className="text-gray-300"/>
                  <span className="text-xs font-bold">{profile.whatsapp || 'WhatsApp belum diatur'}</span>
                </div>
                <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-3 text-red-500 text-[10px] font-black uppercase border-2 border-red-50 rounded-2xl hover:bg-red-50 transition-all">
                  <LogOut size={16} /> Logout Dari Perangkat
                </button>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Alamat Pengiriman</h3>
              <div className="space-y-3 mb-4">
                {addresses.map(addr => (
                  <div key={addr.id} className="p-4 bg-gray-50 rounded-2xl relative group border border-transparent hover:border-green-100 transition-all">
                    <div className="flex gap-3">
                      <MapPin size={16} className="text-red-400 shrink-0" />
                      <div>
                        <p className="text-[10px] font-black uppercase text-gray-400">{addr.label}</p>
                        <p className="text-xs font-bold text-gray-700 leading-relaxed">{addr.address}</p>
                      </div>
                    </div>
                    <button onClick={() => deleteAddress(addr.id)} className="absolute top-4 right-4 text-gray-300 hover:text-red-500"><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="Tulis alamat baru..." className="flex-1 bg-gray-100 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 ring-green-500/20" />
                <button onClick={addAddress} disabled={!newAddress.trim() || isSaving} className="bg-green-600 text-white p-2 rounded-xl disabled:opacity-50 shadow-lg shadow-green-100">
                  {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                </button>
              </div>
            </div>
          </div>

          {/* Sisi Kanan: Orders & Wishlist */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Riwayat Pesanan</h3>
                <Link href="/cart" className="text-[10px] font-black text-green-600 uppercase bg-green-50 px-3 py-1 rounded-full">Buka Keranjang</Link>
              </div>

              {orders.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="mx-auto text-gray-100 mb-4" size={64} />
                  <p className="text-xs font-black text-gray-300 uppercase">Belum ada transaksi</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {orders.map(order => (
                    <div key={order.id} className="p-5 border border-gray-100 rounded-3xl hover:shadow-md transition-all group">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">INV-{order.id.slice(0, 8)}</p>
                          <p className="text-xs font-bold text-gray-800">
                            {order.createdAt?.seconds ? new Date(order.createdAt.seconds * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Baru saja'}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          order.status === 'SELESAI' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600 animate-pulse'
                        }`}>
                          {order.status || 'PROSES'}
                        </span>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        {order.items?.slice(0, 2).map((item, i) => (
                          <div key={i} className="flex justify-between text-xs font-bold">
                            <span className="text-gray-500">{item.quantity}x {item.name}</span>
                            <span className="text-gray-800">Rp{(item.price * item.quantity).toLocaleString()}</span>
                          </div>
                        ))}
                        {order.items?.length > 2 && <p className="text-[10px] text-gray-400 font-bold italic">+{order.items.length - 2} produk lainnya...</p>}
                      </div>

                      <div className="pt-4 border-t border-gray-50 flex justify-between items-center">
                        <div>
                          <p className="text-[9px] font-black text-gray-400 uppercase">Total Pembayaran</p>
                          <p className="text-lg font-black text-green-600">Rp{(order.total || 0).toLocaleString()}</p>
                        </div>
                        <button className="flex items-center gap-1 text-[10px] font-black text-gray-400 hover:text-green-600 transition-colors uppercase">
                          Detail <ChevronRight size={14}/>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Wishlist Placeholder */}
            <div className="bg-gradient-to-br from-red-500 to-pink-600 rounded-3xl p-6 text-white shadow-xl shadow-red-100 flex items-center justify-between overflow-hidden relative group">
              <div className="relative z-10">
                <h3 className="text-lg font-black uppercase tracking-tight">Produk Favorit</h3>
                <p className="text-xs font-bold opacity-80 mb-4">Simpan barang yang kamu incar di sini.</p>
                <Link href="/wishlist" className="bg-white text-red-600 px-6 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg inline-block">Lihat Wishlist</Link>
              </div>
              <Heart className="absolute -right-4 -bottom-4 text-white/10 group-hover:scale-125 transition-transform duration-500" size={160} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}