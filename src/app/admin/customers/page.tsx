// src/app/admin/customers/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Users, 
  User, 
  Phone, 
  Mail,
  MapPin,
  CreditCard,
  Package,
  Plus,
  Edit,
  Trash2,
  AlertTriangle,
  TrendingUp,
  Link
} from 'lucide-react';

type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  type: 'grosir' | 'ecer';
  creditLimit: number;
  outstandingDebt: number;
  totalSpent: number;
  notes?: string;
  createdAt: string;
  lastOrderDate?: string | null;
};

type Order = {
  id: string;
  customerId: string;
  total: number;
  createdAt: string;
  status: string;
};

export default function AdminCustomers() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    type: 'ecer' as 'grosir' | 'ecer',
    creditLimit: 0,
    notes: ''
  });

  // Proteksi admin
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
        alert('Akses ditolak! Anda bukan admin.');
        router.push('/profil');
        return;
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // Fetch pelanggan & hitung piutang
  useEffect(() => {
    if (loading) return;

    const fetchCustomers = async () => {
      try {
        // Ambil data pelanggan
        const customersSnapshot = await getDocs(collection(db, 'customers'));
        const customerList: Customer[] = [];
        
        // Ambil data pesanan untuk hitung piutang & total
        const ordersSnapshot = await getDocs(collection(db, 'orders'));
        const orders = ordersSnapshot.docs.map(doc => ({
          id: doc.id,
          customerId: doc.data().customerId,
          total: doc.data().total,
          createdAt: doc.data().createdAt,
          status: doc.data().status
        })) as Order[];

        customersSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          const customerId = doc.id;
          
          // Hitung piutang (pesanan belum lunas)
          const outstandingOrders = orders.filter(
            order => order.customerId === customerId && 
                     (order.status === 'MENUNGGU' || order.status === 'DIPROSES')
          );
          const outstandingDebt = outstandingOrders.reduce((sum, order) => sum + order.total, 0);
          
          // Hitung total pengeluaran
          const totalSpent = orders
            .filter(order => order.customerId === customerId && order.status === 'SELESAI')
            .reduce((sum, order) => sum + order.total, 0);
          
          // Tanggal pesanan terakhir
          const customerOrders = orders.filter(order => order.customerId === customerId);
          const lastOrderDate = customerOrders.length > 0 
            ? customerOrders.reduce((latest, order) => 
                new Date(order.createdAt) > new Date(latest) ? order.createdAt : latest
              , customerOrders[0].createdAt)
            : null;

          customerList.push({
            id: doc.id,
            name: data.name || '',
            phone: data.phone || '',
            email: data.email,
            address: data.address,
            type: data.type || 'ecer',
            creditLimit: data.creditLimit || 0,
            outstandingDebt,
            totalSpent,
            notes: data.notes,
            createdAt: data.createdAt || '',
            lastOrderDate
          });
        });

        setCustomers(customerList);
        setFilteredCustomers(customerList);
        setError(null);
      } catch (err) {
        console.error('Gagal memuat pelanggan:', err);
        setError('Gagal memuat data pelanggan.');
      }
    };

    fetchCustomers();
  }, [loading]);

  // Filter pelanggan
  useEffect(() => {
    const filtered = customers.filter(customer =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm) ||
      (customer.email && customer.email.includes(searchTerm))
    );
    setFilteredCustomers(filtered);
  }, [searchTerm, customers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'customers'), {
        ...formData,
        outstandingDebt: 0,
        totalSpent: 0,
        createdAt: new Date().toISOString()
      });
      setShowAddModal(false);
      setFormData({
        name: '',
        phone: '',
        email: '',
        address: '',
        type: 'ecer',
        creditLimit: 0,
        notes: ''
      });
      
      // Refresh data
      const customersSnapshot = await getDocs(collection(db, 'customers'));
      const customerList: Customer[] = [];
      customersSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        customerList.push({
          id: doc.id,
          name: data.name || '',
          phone: data.phone || '',
          email: data.email,
          address: data.address,
          type: data.type || 'ecer',
          creditLimit: data.creditLimit || 0,
          outstandingDebt: 0,
          totalSpent: 0,
          notes: data.notes,
          createdAt: data.createdAt || '',
          lastOrderDate: null
        });
      });
      setCustomers(customerList);
    } catch (err) {
      alert('Gagal menambahkan pelanggan.');
      console.error(err);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus pelanggan "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'customers', id));
      setCustomers(customers.filter(c => c.id !== id));
    } catch (err) {
      alert('Gagal menghapus pelanggan.');
      console.error(err);
    }
  };

  const isOverLimit = (customer: Customer) => {
    return customer.outstandingDebt > customer.creditLimit && customer.creditLimit > 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat data pelanggan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Users className="text-black" size={28} />
          <h1 className="text-2xl font-bold text-black">Manajemen Pelanggan</h1>
        </div>
        <p className="text-black">Kelola data pelanggan, piutang, dan riwayat transaksi</p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {/* Aksi Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Cari pelanggan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
          />
          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        </div>
        
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
        >
          <Plus size={18} />
          Tambah Pelanggan
        </button>
      </div>

      {/* Statistik */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Total Pelanggan</p>
              <p className="text-2xl font-bold mt-1">{customers.length}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Users className="text-blue-600" size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Pelanggan Grosir</p>
              <p className="text-2xl font-bold mt-1">
                {customers.filter(c => c.type === 'grosir').length}
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <Package className="text-purple-600" size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Total Piutang</p>
              <p className="text-2xl font-bold mt-1 text-red-600">
                Rp{customers.reduce((sum, c) => sum + c.outstandingDebt, 0).toLocaleString('id-ID')}
              </p>
            </div>
            <div className="bg-red-100 p-3 rounded-full">
              <CreditCard className="text-red-600" size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Lewat Limit Kredit</p>
              <p className="text-2xl font-bold mt-1 text-orange-600">
                {customers.filter(isOverLimit).length}
              </p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <AlertTriangle className="text-orange-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabel Pelanggan */}
      <div className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Pelanggan
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Kontak
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Jenis
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Piutang
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Total Belanja
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-black">
                    <Users className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                    <p>Belum ada pelanggan terdaftar</p>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-black">{customer.name}</div>
                      {customer.notes && (
                        <div className="text-xs text-black mt-1 bg-gray-100 px-2 py-1 rounded inline-block">
                          {customer.notes}
                        </div>
                      )}
                      <div className="text-xs text-black mt-1">
                        {new Date(customer.createdAt).toLocaleDateString('id-ID')}
                        {customer.lastOrderDate && (
                          <> • Terakhir: {new Date(customer.lastOrderDate).toLocaleDateString('id-ID')}</>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-black">
                      <div className="flex items-center gap-1 mb-1">
                        <Phone size={14} className="text-gray-500" />
                        {customer.phone}
                      </div>
                      {customer.email && (
                        <div className="flex items-center gap-1">
                          <Mail size={14} className="text-gray-500" />
                          {customer.email}
                        </div>
                      )}
                      {customer.address && (
                        <div className="flex items-start gap-1 mt-1">
                          <MapPin size={14} className="text-gray-500 mt-0.5" />
                          <span className="text-xs">{customer.address}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        customer.type === 'grosir' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {customer.type === 'grosir' ? 'Grosir' : 'Ecer'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className={`font-medium ${
                          isOverLimit(customer) ? 'text-red-600' : 'text-black'
                        }`}>
                          Rp{customer.outstandingDebt.toLocaleString('id-ID')}
                        </span>
                        {customer.creditLimit > 0 && (
                          <span className="text-xs text-black">
                            Limit: Rp{customer.creditLimit.toLocaleString('id-ID')}
                          </span>
                        )}
                        {isOverLimit(customer) && (
                          <span className="text-xs text-red-600 flex items-center gap-1 mt-1">
                            <AlertTriangle size={12} />
                            Melebihi limit!
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-black">
                      <div className="flex items-center gap-1">
                        <TrendingUp size={16} className="text-green-600" />
                        <span>Rp{customer.totalSpent.toLocaleString('id-ID')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/admin/customers/edit/${customer.id}`}
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <Edit size={16} />
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(customer.id, customer.name)}
                          className="text-red-600 hover:text-red-800 flex items-center gap-1"
                        >
                          <Trash2 size={16} />
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah Pelanggan */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-black">Tambah Pelanggan Baru</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={handleCreate}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">
                      Nama Lengkap *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">
                      Jenis Pelanggan *
                    </label>
                    <select
                      required
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
                    >
                      <option value="ecer">Eceran</option>
                      <option value="grosir">Grosir</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">
                      Nomor Telepon *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
                      placeholder="081234567890"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-black mb-2">
                      Alamat
                    </label>
                    <textarea
                      rows={2}
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
                      placeholder="Jl. Raya No. 123, Kota"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">
                      Limit Kredit (Rp)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.creditLimit}
                      onChange={(e) => setFormData({...formData, creditLimit: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
                      placeholder="0"
                    />
                    <p className="text-xs text-black mt-1">
                      Untuk pelanggan tempo. Biarkan 0 jika tidak ada limit.
                    </p>
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-black mb-2">
                      Catatan Tambahan
                    </label>
                    <textarea
                      rows={2}
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
                      placeholder="Informasi penting tentang pelanggan"
                    />
                  </div>
                </div>
                
                <div className="mt-8 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-black hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Tambah Pelanggan
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}