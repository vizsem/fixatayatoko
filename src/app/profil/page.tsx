'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { 
  User, MapPin, Package, LogOut, Edit, Save, Mail, 
  ClipboardList, ChevronRight, ChevronLeft, Loader2, Trash2, Clock, CheckCircle2, Truck,
  Bell, X, Ticket, ShieldCheck, Phone, Home, Building2, Star, Plus, AlertTriangle
} from 'lucide-react';

import Link from 'next/link';
import MemberCard from '@/components/MemberCard';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';


import { arrayRemove, arrayUnion, auth, collection, db, doc, onAuthStateChanged, onSnapshot, orderBy, query, signOut, updateDoc, where, FirebaseUser } from '@/lib/firebase';
import { isOperationalUser } from '@/lib/auth-helpers';

const MAX_ADDRESSES = 5;
const LABEL_PRESETS = ['Rumah', 'Kantor', 'Kos / Kost', 'Gudang', 'Lainnya'];
// --- TYPES ---
type Address = {
  id: string;
  label: string;
  receiverName: string;
  receiverPhone: string;
  address: string;
  city?: string;
  province?: string;
  postalCode?: string;
  isDefault?: boolean;
};

const EMPTY_FORM: Omit<Address, 'id' | 'isDefault'> = {
  label: '',
  receiverName: '',
  receiverPhone: '',
  address: '',
  city: '',
  province: '',
  postalCode: '',
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
  walletBalance?: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<string>('customer');
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  
  // Address form state
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
      if (firebaseUser.isAnonymous) {
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
      toast.error("Gagal memperbarui nama");
    } finally {
      setIsSaving(false);
    }
  };

  // Open form for new address
  const openNewForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  // Open form for editing existing address
  const openEditForm = (addr: Address) => {
    setForm({
      label: addr.label,
      receiverName: addr.receiverName,
      receiverPhone: addr.receiverPhone,
      address: addr.address,
      city: addr.city || '',
      province: addr.province || '',
      postalCode: addr.postalCode || '',
    });
    setEditingId(addr.id);
    setShowForm(true);
  };

  const handleSaveAddress = async () => {
    if (!form.receiverName.trim() || !form.address.trim() || !user) {
      toast.error("Nama penerima dan alamat lengkap wajib diisi!");
      return;
    }
    setIsSaving(true);

    try {
      let newAddresses: Address[];

      if (editingId) {
        newAddresses = addresses.map(a =>
          a.id === editingId
            ? { ...a, ...form, label: form.label || 'Rumah' }
            : a
        );
      } else {
        const newAddr: Address = {
          id: Date.now().toString(),
          label: form.label || 'Rumah',
          receiverName: form.receiverName,
          receiverPhone: form.receiverPhone,
          address: form.address,
          city: form.city,
          province: form.province,
          postalCode: form.postalCode,
          isDefault: addresses.length === 0,
        };
        newAddresses = [...addresses, newAddr];
      }

      await updateDoc(doc(db, 'users', user.uid), { addresses: newAddresses });
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      toast.success(editingId ? "Alamat berhasil diperbarui" : "Alamat berhasil ditambahkan");
    } catch {
      toast.error("Gagal menyimpan alamat");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteAddress = async () => {
    if (!user || !deleteConfirmId) return;
    try {
      let newAddresses = addresses.filter(a => a.id !== deleteConfirmId);
      const wasDefault = addresses.find(a => a.id === deleteConfirmId)?.isDefault;
      if (wasDefault && newAddresses.length > 0) {
        newAddresses[0] = { ...newAddresses[0], isDefault: true };
      }
      await updateDoc(doc(db, 'users', user.uid), { addresses: newAddresses });
      toast.success("Alamat dihapus");
    } catch {
      toast.error("Gagal menghapus alamat");
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const setDefaultAddress = async (addrId: string) => {
    if (!user) return;
    const newAddresses = addresses.map(a => ({ ...a, isDefault: a.id === addrId }));
    try {
      await updateDoc(doc(db, 'users', user.uid), { addresses: newAddresses });
      toast.success("Alamat utama diperbarui");
    } catch {
      toast.error("Gagal mengubah alamat utama");
    }
  };

  const indexOfLastOrder = currentPage * ordersPerPage;
  const currentOrders = orders.slice(indexOfLastOrder - ordersPerPage, indexOfLastOrder);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <Loader2 className="animate-spin text-emerald-500 mb-2" size={32} />
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Memuat Profil...</p>
    </div>
  );

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 pb-24 font-sans">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-[100] border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-emerald-100 hover:text-emerald-600 transition-all">
              <ChevronLeft size={20} />
            </Link>
            <h1 className="text-sm font-bold text-slate-800 uppercase tracking-tight underline decoration-emerald-500 underline-offset-4">Akun Saya</h1>
          </div>
          
          <div className="flex items-center gap-2">
            {isOperationalUser(user, userRole) && (
              <Link 
                href="/admin" 
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-full shadow-sm shadow-emerald-200 transition-all"
                title="Buka Panel Admin / Operasional"
              >
                <ShieldCheck size={14} />
                <span>Panel Admin</span>
              </Link>
            )}

            <button
              onClick={() => setShowNotif(!showNotif)}
              className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500 relative"
              title="Notifikasi"
            >
              <Bell size={22} strokeWidth={1.8} className={activeOrdersCount > 0 ? 'animate-bounce' : ''} />
              {activeOrdersCount > 0 && (
                <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 bg-red-600 text-white text-[9px] flex items-center justify-center rounded-full font-bold border-2 border-white">
                  {activeOrdersCount > 9 ? '9+' : activeOrdersCount}
                </span>
              )}
            </button>
          </div>
        </div>


        {showNotif && (
          <div className="absolute right-6 top-20 w-80 bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Aktivitas Belanja</span>
              <button onClick={() => setShowNotif(false)} className="text-slate-400 hover:text-emerald-600 p-1 rounded-full hover:bg-emerald-100 transition-all"><X size={16}/></button>
            </div>
            <div className="max-h-80 overflow-y-auto p-3 space-y-2">
              {activeOrdersList.length > 0 ? activeOrdersList.map(order => {
                    const status = getStatusInfo(order.status);
                    return (
                      <div key={order.id} onClick={() => router.push(`/transaksi/${order.id}`)} className="p-4 hover:bg-slate-50 rounded-2xl flex gap-3 items-center cursor-pointer border border-transparent hover:border-slate-100 transition-all">
                        <div className={`p-2 rounded-xl bg-gray-50 ${status.color}`}>
                          {status.icon}
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] font-black text-slate-800 uppercase">Status: {status.label}</p>
                          <p className="text-[8px] font-bold text-slate-400 mt-1">{order.orderId || order.id.slice(0,8)}</p>
                        </div>
                        <ChevronRight size={14} className="text-slate-200"/>
                      </div>
                    );
                  }) : (
                    <div className="py-10 text-center opacity-40 text-[10px] font-black uppercase tracking-widest">Belum ada aktivitas</div>
                  )}
            </div>
          </div>
        )}
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* MEMBER CARD WIDGET (NEW) - FULL WIDTH */}
        <div className="mb-8">
          <MemberCard 
            name={profile?.name || "Member Ataya"} 
            memberId={user?.uid || "GUEST"} 
            points={profile?.points || 0}
            walletBalance={profile?.walletBalance}
            level={(profile?.points || 0) > 100000 ? 'Platinum' : (profile?.points || 0) > 50000 ? 'Gold' : (profile?.points || 0) > 10000 ? 'Silver' : 'Bronze'}
          />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* KOLOM KIRI: PROFIL & POIN */}
          <div className="space-y-6">

            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-100">
                    <User size={32} />
                  </div>
                  <div className="flex-1">
                    {isEditingName ? (
                      <div className="flex gap-2">
                        <input value={newName} onChange={e => setNewName(e.target.value)} className="bg-white px-3 py-1 rounded-lg outline-none font-bold text-lg w-full border border-slate-100 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" autoFocus />
                        <button onClick={handleSaveName} disabled={isSaving} className="text-emerald-600 hover:text-emerald-700 p-1 rounded-full hover:bg-emerald-100 transition-all"><Save size={20}/></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group/name">
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{profile?.name || "Member Ataya"}</h2>
                        <button onClick={() => setIsEditingName(true)} className="opacity-0 group-hover/name:opacity-100 transition-opacity p-1 rounded-full hover:bg-emerald-100"><Edit size={14} className="text-slate-400 hover:text-emerald-600"/></button>
                      </div>
                    )}
                    <p className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1 uppercase tracking-widest">
                      <Mail size={10} /> {profile?.email}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-3xl p-6 mt-6 relative overflow-hidden border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><Ticket size={20}/></div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Saldo Dompet</p>
                      <h3 className="text-xl font-bold text-slate-800">
                        Rp{(profile?.walletBalance || 0).toLocaleString('id-ID')}
                      </h3>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3 pt-6 border-t border-dashed border-slate-100">
                {isOperationalUser(user, userRole) && (
                  <Link 
                    href="/admin" 
                    className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[11px] font-black uppercase tracking-wider rounded-2xl hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-200 transition-all active:scale-[0.99]"
                  >
                    <ClipboardList size={18} /> 
                    Panel {userRole === 'cashier' || user?.email?.startsWith('kasir') ? 'Kasir / POS' : 'Admin & Operasional'}
                  </Link>
                )}
                <button onClick={handleLogout} className="w-full py-4 text-slate-400 text-[10px] font-black uppercase rounded-2xl hover:bg-rose-50 hover:text-rose-500 transition-all flex items-center justify-center gap-2">
                  <LogOut size={16} /> Keluar Akun
                </button>
              </div>

            </div>

            {/* BAGIAN ALAMAT — PROFESIONAL */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow overflow-hidden">
              {/* Header */}
              <div className="px-6 pt-6 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 rounded-xl">
                    <MapPin size={16} className="text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Alamat Pengiriman</h3>
                    <p className="text-[10px] text-slate-400 font-medium">{addresses.length} / {MAX_ADDRESSES} alamat</p>
                  </div>
                </div>
                {addresses.length < MAX_ADDRESSES && (
                  <button
                    onClick={openNewForm}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl transition-all active:scale-95 shadow-sm shadow-emerald-200"
                  >
                    <Plus size={14} />
                    Tambah
                  </button>
                )}
              </div>

              {/* Daftar alamat */}
              <div className="px-4 pb-4 space-y-3">
                {addresses.length === 0 ? (
                  <div className="py-10 flex flex-col items-center gap-3 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center">
                      <MapPin size={24} className="text-slate-300" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-500">Belum ada alamat</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Tambahkan alamat untuk mempercepat checkout</p>
                    </div>
                    <button
                      onClick={openNewForm}
                      className="mt-1 px-4 py-2 bg-emerald-600 text-white text-[11px] font-bold rounded-xl hover:bg-emerald-700 transition-all"
                    >
                      + Tambah Alamat Pertama
                    </button>
                  </div>
                ) : (
                  addresses.map(addr => (
                    <div
                      key={addr.id}
                      className={`rounded-2xl border-2 p-4 transition-all ${
                        addr.isDefault
                          ? 'border-emerald-200 bg-emerald-50/40'
                          : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'
                      }`}
                    >
                      {addr.isDefault && (
                        <span className="inline-flex items-center gap-1 mb-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">
                          <Star size={9} className="fill-emerald-500 text-emerald-500" />
                          Alamat Utama
                        </span>
                      )}
                      <div className="flex items-center gap-1.5 mb-1.5">
                        {addr.label === 'Kantor' || addr.label === 'Gudang' ? (
                          <Building2 size={12} className="text-slate-500" />
                        ) : (
                          <Home size={12} className="text-slate-500" />
                        )}
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">{addr.label || 'Rumah'}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-900">{addr.receiverName}</p>
                      {addr.receiverPhone && (
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone size={10} /> {addr.receiverPhone}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">
                        {addr.address}
                        {addr.city && `, ${addr.city}`}
                        {addr.province && `, ${addr.province}`}
                        {addr.postalCode && ` ${addr.postalCode}`}
                      </p>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-dashed border-slate-200">
                        {!addr.isDefault && (
                          <button
                            onClick={() => setDefaultAddress(addr.id)}
                            className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-all"
                          >
                            <Star size={11} /> Jadikan Utama
                          </button>
                        )}
                        <button
                          onClick={() => openEditForm(addr)}
                          className="text-[10px] font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-blue-50 transition-all"
                        >
                          <Edit size={11} /> Edit
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(addr.id)}
                          className="ml-auto text-[10px] font-bold text-slate-400 hover:text-rose-500 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-rose-50 transition-all"
                        >
                          <Trash2 size={11} /> Hapus
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* KOLOM KANAN: RIWAYAT PESANAN */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 min-h-[600px] hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-8">
                <div>
                   <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-widest">Riwayat Transaksi</h3>
                   <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Total {orders.length} Pesanan</p>
                </div>
                {activeOrdersCount > 0 && (
                   <div className="bg-emerald-100 text-emerald-600 px-4 py-2 rounded-full flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-ping"></div>
                      <span className="text-[9px] font-bold uppercase tracking-widest">{activeOrdersCount} Aktif</span>
                   </div>
                )}
              </div>

              {orders.length === 0 ? (
                <div className="text-center py-24 opacity-40">
                  <Package className="mx-auto text-slate-200 mb-4" size={64} />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em]">Belum ada riwayat belanja</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentOrders.map(order => {
                    const status = getStatusInfo(order.status);
                    const isActive = ['PENDING', 'MENUNGGU', 'DIPROSES', 'DIKIRIM'].includes(order.status?.toUpperCase());
                    const firstItem = order.items?.[0];
                    const additionalItems = (order.items?.length || 0) - 1;

                    return (
                      <div key={order.id} className={`p-6 border rounded-[2rem] transition-all relative overflow-hidden group ${isActive ? 'bg-emerald-50/30 border-emerald-100' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-2xl bg-gray-50 ${status.color}`}>
                              {status.icon}
                            </div>
                            <div>
                              <h4 className="text-[10px] font-bold uppercase tracking-tight">{order.orderId || `ATY-${order.id.slice(0,5).toUpperCase()}`}</h4>
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
                          {firstItem && (
                            <p className="text-xs font-bold text-slate-800 uppercase line-clamp-1">
                              {firstItem.name} <span className="text-slate-400 ml-1">x{firstItem.quantity}</span>
                            </p>
                          )}
                          {additionalItems > 0 && (
                            <p className="text-[9px] font-bold text-slate-400 mt-1">+ {additionalItems} PRODUK LAINNYA</p>
                          )}
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-dashed border-slate-200">
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Bayar</p>
                            <p className="text-xl font-bold text-slate-900 tracking-tight">Rp{(order.total || 0).toLocaleString('id-ID')}</p>
                          </div>
                          <Link href={`/transaksi/${order.id}`} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 text-slate-400 hover:text-emerald-500 hover:border-emerald-100 transition-all">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-chevron-right" aria-hidden="true">
                              <path d="m9 18 6-6-6-6"></path>
                            </svg>
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

      {/* MODAL FORM TAMBAH / EDIT ALAMAT */}
      {showForm && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => { setShowForm(false); setEditingId(null); }}
          />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 rounded-xl">
                  <MapPin size={16} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    {editingId ? 'Edit Alamat' : 'Tambah Alamat Baru'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Isi informasi pengiriman</p>
                </div>
              </div>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-4 flex-1">
              {/* Label presets */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Label Alamat</label>
                <div className="flex flex-wrap gap-2">
                  {LABEL_PRESETS.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, label: preset }))}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                        form.label === preset
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-600'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  value={form.label}
                  onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="Atau ketik label custom..."
                  className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Nama penerima */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Nama Penerima <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={form.receiverName}
                    onChange={e => setForm(f => ({ ...f, receiverName: e.target.value }))}
                    placeholder="Nama lengkap penerima"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all placeholder:text-slate-400"
                    autoComplete="name"
                  />
                </div>
              </div>

              {/* No HP */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">No. WhatsApp / HP</label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={form.receiverPhone}
                    onChange={e => setForm(f => ({ ...f, receiverPhone: e.target.value }))}
                    placeholder="08xx-xxxx-xxxx"
                    type="tel"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all placeholder:text-slate-400"
                    autoComplete="tel"
                  />
                </div>
              </div>

              {/* Kota & Kode Pos */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Kota / Kabupaten</label>
                  <input
                    value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    placeholder="cth: Kota Kediri"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Kode Pos</label>
                  <input
                    value={form.postalCode}
                    onChange={e => setForm(f => ({ ...f, postalCode: e.target.value }))}
                    placeholder="cth: 64116"
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Provinsi */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Provinsi</label>
                <input
                  value={form.province}
                  onChange={e => setForm(f => ({ ...f, province: e.target.value }))}
                  placeholder="cth: Jawa Timur"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Alamat lengkap */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Alamat Lengkap <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <MapPin size={15} className="absolute left-3.5 top-3 text-slate-400" />
                  <textarea
                    value={form.address}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="Nama jalan, no. rumah, RT/RW, kelurahan, kecamatan..."
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all resize-none placeholder:text-slate-400"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Isi selengkap mungkin agar kurir mudah menemukan lokasi</p>
              </div>
            </div>

            <div className="px-6 pb-6 pt-4 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleSaveAddress}
                disabled={isSaving}
                className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 disabled:opacity-60"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {editingId ? 'Perbarui Alamat' : 'Simpan Alamat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-6">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setDeleteConfirmId(null)}
          />
          <div className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full z-10 text-center">
            <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} className="text-rose-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Hapus Alamat?</h3>
            <p className="text-sm text-slate-500 mb-6">Alamat ini akan dihapus permanen dan tidak bisa dikembalikan.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all"
              >
                Batal
              </button>
              <button
                onClick={confirmDeleteAddress}
                className="flex-1 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm transition-all active:scale-[0.98]"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
