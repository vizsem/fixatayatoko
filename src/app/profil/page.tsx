// src/app/profil/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove 
} from 'firebase/firestore';
import { 
  Store, User, MapPin, Package, Heart, LogOut, Edit, Save, Trash2, Mail, Phone, 
  CreditCard, Truck, ClipboardList, Star
} from 'lucide-react';
import Link from 'next/link';

// Tipe untuk alamat dengan lokasi
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [newAddress, setNewAddress] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

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
          
          // Konversi alamat lama ke format baru jika perlu
          const savedAddresses = userData.addresses || [];
          if (Array.isArray(savedAddresses) && savedAddresses.length > 0) {
            if (typeof savedAddresses[0] === 'string') {
              const newAddresses: Address[] = savedAddresses.map((addr, idx) => ({
                id: `addr-${Date.now()}-${idx}`,
                label: `Alamat ${idx + 1}`,
                address: addr,
                lat: -7.8014,
                lng: 111.8139
              }));
              setAddresses(newAddresses);
              await updateDoc(userRef, { addresses: newAddresses });
            } else {
              setAddresses(savedAddresses);
            }
          } else {
            setAddresses([]);
          }
          
          // Ambil data pesanan lengkap dari koleksi 'orders'
          const orderIds = userData.orders || [];
          if (orderIds.length > 0) {
            const orderPromises = orderIds.map(id => 
              getDoc(doc(db, 'orders', id))
            );
            const orderDocs = await Promise.all(orderPromises);
            const orderData = orderDocs
              .filter(doc => doc.exists())
              .map(doc => ({ id: doc.id, ...doc.data() }));
            setOrders(orderData);
          } else {
            setOrders([]);
          }
        } else {
          const newUser = {
            name: firebaseUser.displayName || firebaseUser.phoneNumber || 'Pelanggan',
            email: firebaseUser.email || '',
            whatsapp: firebaseUser.phoneNumber || '',
            avatar: firebaseUser.photoURL || '',
            createdAt: new Date().toISOString(),
            addresses: [],
            orders: [],
            wishlist: []
          };
          await setDoc(userRef, newUser);
          setProfile(newUser);
          setNewName(newUser.name);
          setAddresses([]);
          setOrders([]);
        }
      } catch (error: any) {
        console.error('Error mengambil data profil:', error);
        if (error.code === 'permission-denied') {
          try {
            await signOut(auth);
            localStorage.removeItem('atayatoko-user');
            localStorage.removeItem('atayatoko-cart');
            localStorage.removeItem('atayatoko-wishlist');
          } catch (signOutError) {
            console.error('Error saat logout paksa:', signOutError);
          }
          router.push('/profil/login');
        }
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (typeof window !== 'undefined' && mapLoaded === false && addresses.length > 0) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyDV5Oz_zphv8UatLlZssdLkrbHSIZ8fOZI`;
      script.async = true;
      script.onload = () => setMapLoaded(true);
      document.head.appendChild(script);
    }
  }, [addresses, mapLoaded]);

  useEffect(() => {
    if (mapLoaded && mapRef.current && addresses.length > 0) {
      const map = new (window as any).google.maps.Map(mapRef.current, {
        zoom: 12,
        center: { lat: addresses[0].lat, lng: addresses[0].lng },
        mapTypeId: (window as any).google.maps.MapTypeId.ROADMAP
      });

      addresses.forEach(address => {
        new (window as any).google.maps.Marker({
          position: { lat: address.lat, lng: address.lng },
          map: map,
          title: address.label
        });
      });
    }
  }, [mapLoaded, addresses]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('atayatoko-user');
      localStorage.removeItem('atayatoko-cart');
      localStorage.removeItem('atayatoko-wishlist');
      router.push('/');
    } catch (error) {
      console.error('Error logout:', error);
    }
  };

  const handleSaveName = async () => {
    if (newName.trim() && user) {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { name: newName.trim() });
      setProfile({ ...profile, name: newName.trim() });
      setIsEditingName(false);
    }
  };

  const addAddress = async () => {
    if (newAddress.trim() && user && profile) {
      const existing = addresses.find(addr => addr.address === newAddress.trim());
      if (existing) {
        alert('Alamat ini sudah ada!');
        return;
      }

      const newAddr: Address = {
        id: `addr-${Date.now()}`,
        label: `Alamat ${addresses.length + 1}`,
        address: newAddress.trim(),
        lat: -7.8014,
        lng: 111.8139
      };

      const updatedAddresses = [...addresses, newAddr];
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { addresses: updatedAddresses });
      
      setAddresses(updatedAddresses);
      setNewAddress('');
    }
  };

  const updateAddress = async (oldAddressId: string) => {
    if (editingAddress && newAddress.trim() && user && profile) {
      const updatedAddresses = addresses.map(addr => 
        addr.id === oldAddressId 
          ? { ...addr, address: newAddress.trim() }
          : addr
      );
      
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { addresses: updatedAddresses });
      
      setAddresses(updatedAddresses);
      setEditingAddress(null);
      setNewAddress('');
    }
  };

  const deleteAddress = async (addressId: string) => {
    if (user && profile) {
      const updatedAddresses = addresses.filter(addr => addr.id !== addressId);
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { addresses: updatedAddresses });
      setAddresses(updatedAddresses);
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'diproses': return 'Diproses';
      case 'dikirim': return 'Dikirim';
      case 'selesai': return 'Selesai';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'diproses': return 'bg-yellow-100 text-yellow-800';
      case 'dikirim': return 'bg-blue-100 text-blue-800';
      case 'selesai': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Memverifikasi sesi...</p>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Mini - HANYA ICON */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link href="/"> <Store className="text-green-600" size={28} />
               </Link>
              

      {/* ✅ TOMBOL KEMBALI KE BERANDA */}
      <Link 
        href="/" 
        className="text-green-600 hover:text-green-700 text-sm font-medium"
      >
        ← Beranda
      </Link>
            </div>
            <h1 className="text-lg font-bold text-gray-900">Profil Saya</h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Informasi Profil */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center mb-6">
                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center">
                  <User className="text-green-600" size={32} />
                </div>
                <div className="ml-4">
                  {isEditingName ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveName}
                        className="text-green-600 hover:text-green-800"
                      >
                        <Save size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-xl font-bold text-gray-900">{profile.name}</h2>
                      <button
                        onClick={() => setIsEditingName(true)}
                        className="text-sm text-gray-500 hover:text-green-600 mt-1 flex items-center"
                      >
                        <Edit size={12} className="mr-1" /> Ubah Nama
                      </button>
                     

                    </>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {profile.email && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-1">Email</h3>
                    <p className="text-gray-600 flex items-center">
                      <Mail className="text-gray-400 mr-2" size={16} />
                      {profile.email}
                    </p>
                  </div>
                )}
                
                {profile.whatsapp && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-1">WhatsApp</h3>
                    <p className="text-gray-600 flex items-center">
                      <Phone className="text-gray-400 mr-2" size={16} />
                      {profile.whatsapp}
                    </p>
                  </div>
                )}

                <div>
                  <h3 className="font-medium text-gray-900 mb-1">Anggota Sejak</h3>
                  <p className="text-gray-600">
                    {new Date(profile.createdAt).toLocaleDateString('id-ID')}
                  </p>
                </div>

                <button
                  onClick={handleLogout}
                  className="w-full mt-6 flex items-center justify-center space-x-2 py-2 px-4 border border-red-500 text-red-500 rounded-lg hover:bg-red-50 hover:text-red-700 transition-colors"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            </div>

            {/* Alamat Pengiriman */}
            <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Alamat Pengiriman</h2>
              
              {addresses.length === 0 ? (
                <p className="text-gray-600 text-sm">Belum ada alamat tersimpan.</p>
              ) : (
                <div className="space-y-3">
                  {addresses.map((address) => (
                    <div key={address.id} className="p-3 border border-gray-200 rounded">
                      {editingAddress === address.id ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={newAddress}
                            onChange={(e) => setNewAddress(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 text-sm flex-1"
                            autoFocus
                          />
                          <button
                            onClick={() => updateAddress(address.id)}
                            className="text-green-600 hover:text-green-800"
                          >
                            <Save size={14} />
                          </button>
                          <button
                            onClick={() => setEditingAddress(null)}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start">
                            <MapPin className="text-red-500 mt-0.5 mr-2 flex-shrink-0" size={16} />
                            <div>
                              <p className="text-sm font-medium">{address.label}</p>
                              <p className="text-xs text-gray-600 mt-1">{address.address}</p>
                            </div>
                          </div>
                          <div className="flex space-x-2 mt-2">
                            <button
                              onClick={() => {
                                setEditingAddress(address.id);
                                setNewAddress(address.address);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              Ubah
                            </button>
                            <button
                              onClick={() => deleteAddress(address.id)}
                              className="text-xs text-red-600 hover:text-red-800"
                            >
                              Hapus
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4">
                <input
                  type="text"
                  placeholder="Tambah alamat baru"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <button
                  onClick={addAddress}
                  disabled={!newAddress.trim()}
                  className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white text-sm py-1.5 rounded-md disabled:opacity-50"
                >
                  Tambah Alamat
                </button>
              </div>
            </div>
          </div>

          {/* Riwayat Pesanan & Wishlist */}
          <div className="lg:col-span-2">
            {/* Riwayat Pesanan */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Riwayat Pesanan</h2>
                <Link href="/cart" className="text-green-600 hover:text-green-800 text-sm">
                  Lihat Keranjang
                </Link>
              </div>

              {orders.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="mx-auto text-gray-400 mb-2" size={48} />
                  <p className="text-gray-600">Belum ada pesanan.</p>
                  <Link
                    href="/"
                    className="mt-4 inline-block text-sm bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  >
                    Mulai Belanja
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div key={order.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-sm text-gray-600">#{order.id.substring(0, 8)}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(order.createdAt?.toDate?.() || order.createdAt).toLocaleDateString('id-ID')}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status || 'selesai')}`}>
                          {getStatusText(order.status || 'selesai')}
                        </span>
                      </div>
                      
                      {/* ✅ TAMPILKAN NOMINAL ITEM */}
                      <div className="mb-3">
                        {order.items?.slice(0, 2).map((item: any, i: number) => (
                          <div key={i} className="text-sm text-gray-900 mb-1">
                            <span>{item.quantity}x {item.name}</span>
                            <span className="float-right font-medium">
                              Rp{(item.price * item.quantity).toLocaleString('id-ID')}
                            </span>
                          </div>
                        ))}
                        {order.items?.length > 2 && (
                          <p className="text-xs text-gray-500 mt-1">+{order.items.length - 2} item lainnya</p>
                        )}
                      </div>
                      
                      {/* ✅ TOTAL NOMINAL DI BAWAH */}
                      <div className="flex justify-between items-center pt-3 border-t">
                        <span className="font-bold text-green-600">
                          Total: Rp{order.total?.toLocaleString('id-ID') || '0'}
                        </span>
                        <button className="text-green-600 hover:text-green-800 text-sm">
                          Lihat Detail
                        </button>
                      </div>
                    </div>
                  ))}
                  {orders.length > 3 && (
                    <Link href="/profil/pesanan" className="block text-center text-green-600 hover:text-green-800 mt-4">
                      Lihat Semua Riwayat
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Wishlist */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Wishlist</h2>
              <div className="text-center py-6">
                <Heart className="mx-auto text-red-400 mb-2" size={48} />
                <p className="text-gray-600 mb-4">Kelola produk favorit Anda</p>
                <Link
                  href="/wishlist"
                  className="inline-block bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100"
                >
                  Lihat Wishlist
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}