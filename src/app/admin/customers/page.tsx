'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { auth, db } from '@/lib/firebase';


import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { LucideIcon } from 'lucide-react';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc
} from 'firebase/firestore';

import Link from 'next/link';
import {
  Users,
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
  Search,
  X,
  Activity
} from 'lucide-react';


// --- TYPES ---
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

  // 1. Proteksi Admin
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
        toast.error('Akses ditolak! Anda bukan admin.');
        router.push('/profil');
        return;
      }
      fetchData();
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Sinkronisasi Data Pelanggan & Pesanan (Sinkron Total Spent & Debt)
  const fetchData = async () => {
    try {
      setLoading(true);
      const customersSnapshot = await getDocs(collection(db, 'customers'));
      const ordersSnapshot = await getDocs(collection(db, 'orders'));

      const orders = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];

      const customerList: Customer[] = customersSnapshot.docs.map((doc) => {
        const data = doc.data();
        const customerId = doc.id;

        // Filter pesanan khusus pelanggan ini
        const customerOrders = orders.filter(o => o.customerId === customerId);

        // Hitung piutang (MENUNGGU, PENDING, atau DIPROSES)
        const outstandingDebt = customerOrders
          .filter(o => ['MENUNGGU', 'PENDING', 'DIPROSES'].includes(o.status?.toUpperCase()))
          .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

        // Hitung total pengeluaran (Hanya yang SELESAI / SUCCESS)
        const totalSpent = customerOrders
          .filter(o => ['SELESAI', 'SUCCESS'].includes(o.status?.toUpperCase()))
          .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

        // Cari tanggal pesanan terakhir
        const lastOrderDate = customerOrders.length > 0
          ? customerOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt
          : null;

        return {
          id: customerId,
          name: data.name || '',
          phone: data.phone || '',
          email: data.email || '',
          address: data.address || '',
          type: data.type || 'ecer',
          creditLimit: Number(data.creditLimit) || 0,
          outstandingDebt,
          totalSpent,
          notes: data.notes || '',
          createdAt: data.createdAt || new Date().toISOString(),
          lastOrderDate
        };
      });

      setCustomers(customerList);
      setFilteredCustomers(customerList);
    } catch (err) {

      console.error('Fetch Error:', err);
    } finally {

      setLoading(false);
    }
  };

  // 3. Filter Search
  useEffect(() => {
    const filtered = customers.filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredCustomers(filtered);
  }, [searchTerm, customers]);

  // 4. Create Customer
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'customers'), {
        ...formData,
        createdAt: new Date().toISOString()
      });
      setShowAddModal(false);
      setFormData({ name: '', phone: '', email: '', address: '', type: 'ecer', creditLimit: 0, notes: '' });
      fetchData();
    } catch {
      toast.error("Gagal menambah data");
    }
  };

  // 5. Delete Customer
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus permanen data "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'customers', id));
      setCustomers(customers.filter(c => c.id !== id));
    } catch {
      toast.error('Gagal menghapus.');
    }


  };

  const isOverLimit = (customer: Customer) => {
    return customer.creditLimit > 0 && customer.outstandingDebt > customer.creditLimit;
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-green-600 mb-4"></div>
      <p className="text-[10px] font-black tracking-[0.3em] text-gray-400">Syncing client data...</p>

    </div>
  );

  return (
    <div className="min-h-screen bg-[#FBFBFE] p-4 lg:p-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tighter flex items-center gap-3">
            <Users className="text-green-600" size={32} /> Client database
          </h1>
          <p className="text-gray-400 text-xs font-bold tracking-widest mt-1">Manajemen pelanggan & piutang berjalan</p>
        </div>


        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
            <input
              type="text"
              placeholder="Cari nama/hp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-gray-50 border-none rounded-xl text-xs font-bold shadow-sm focus:ring-2 focus:ring-black outline-none transition-all"
            />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-black text-white px-8 py-4 rounded-[1.5rem] text-[10px] font-black tracking-widest flex items-center gap-2 hover:bg-gray-800 transition-all shadow-lg"
          >
            <Plus size={18} /> Tambah client
          </button>

        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
        <StatBox label="Total Client" value={customers.length} icon={Users} color="text-blue-600" bg="bg-blue-50" />
        <StatBox label="Tipe Grosir" value={customers.filter(c => c.type === 'grosir').length} icon={Package} color="text-purple-600" bg="bg-purple-50" />
        <StatBox label="Total Piutang" value={`Rp${customers.reduce((s, c) => s + c.outstandingDebt, 0).toLocaleString()}`} icon={CreditCard} color="text-red-600" bg="bg-red-50" />
        <StatBox label="Over Limit" value={customers.filter(isOverLimit).length} icon={AlertTriangle} color="text-orange-600" bg="bg-orange-50" />
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto -mx-4 md:mx-0">
          <table className="w-full text-left min-w-[720px] md:min-w-0">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-3 md:px-8 py-3 md:py-6 text-[10px] font-black text-gray-400 tracking-[0.2em]">Profil pelanggan</th>
                <th className="hidden md:table-cell px-3 md:px-6 py-3 md:py-6 text-[10px] font-black text-gray-400 tracking-[0.2em]">Detail kontak</th>
                <th className="px-3 md:px-6 py-3 md:py-6 text-[10px] font-black text-gray-400 tracking-[0.2em]">Kategori</th>
                <th className="hidden md:table-cell px-3 md:px-6 py-3 md:py-6 text-[10px] font-black text-gray-400 tracking-[0.2em]">Status piutang</th>
                <th className="hidden md:table-cell px-3 md:px-6 py-3 md:py-6 text-[10px] font-black text-gray-400 tracking-[0.2em]">Omzet</th>
                <th className="px-3 md:px-8 py-3 md:py-6 text-right text-[10px] font-black text-gray-400 tracking-[0.2em]">Action</th>
              </tr>
 
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 md:px-8 py-14 md:py-20 text-center">
                    <Activity className="mx-auto text-gray-200 mb-4" size={40} />
                    <p className="text-[10px] font-black text-gray-400 tracking-widest">Tidak ada data ditemukan</p>

                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-3 md:px-8 py-3 md:py-6">
                      <div className="flex flex-col">
                        <span className="font-black text-gray-800 text-xs tracking-tight">{customer.name}</span>

                        {customer.notes && (
                          <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md mt-1 w-fit">
                            {customer.notes}
                          </span>
                        )}
                        <span className="text-[9px] font-bold text-gray-400 mt-1">
                          Mulai: {new Date(customer.createdAt).toLocaleDateString('id-ID')}
                        </span>

                      </div>
                    </td>
                    <td className="hidden md:table-cell px-3 md:px-6 py-3 md:py-6">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-600">
                          <Phone size={12} className="text-green-500" /> {customer.phone}
                        </div>
                        {customer.email && (
                          <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                            <Mail size={12} /> {customer.email}
                          </div>
                        )}
                        {customer.address && (
                          <div className="flex items-start gap-2 text-[10px] font-bold text-gray-400 max-w-[180px] leading-tight">
                            <MapPin size={12} className="shrink-0 mt-0.5" /> {customer.address}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-6">
                      <span className={`px-3 py-1 text-[9px] font-black rounded-full tracking-widest ${customer.type === 'grosir' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                        }`}>
                        {customer.type}
                      </span>
                    </td>

                    <td className="hidden md:table-cell px-3 md:px-6 py-3 md:py-6">
                      <div className="flex flex-col">
                        <span className={`text-xs font-black ${isOverLimit(customer) ? 'text-red-600' : 'text-gray-800'}`}>
                          Rp{customer.outstandingDebt.toLocaleString()}
                        </span>
                        {customer.creditLimit > 0 && (
                          <span className="text-[9px] font-bold text-gray-400">Limit: Rp{customer.creditLimit.toLocaleString()}</span>
                        )}
                        {isOverLimit(customer) && (
                          <span className="text-[8px] font-black text-red-500 flex items-center gap-1 mt-1">
                            <AlertTriangle size={10} /> Limit exceeded
                          </span>
                        )}

                      </div>
                    </td>
                    <td className="hidden md:table-cell px-3 md:px-6 py-3 md:py-6">
                      <div className="flex items-center gap-2">
                        <TrendingUp size={14} className="text-green-500" />
                        <span className="text-xs font-black text-gray-800">Rp{customer.totalSpent.toLocaleString()}</span>
                      </div>
                      {customer.lastOrderDate && (
                        <p className="text-[8px] font-bold text-gray-400 mt-1">Terakhir: {new Date(customer.lastOrderDate).toLocaleDateString('id-ID')}</p>
                      )}

                    </td>
                    <td className="px-3 md:px-8 py-3 md:py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/customers/edit/${customer.id}`} className="p-3 bg-white border border-gray-100 rounded-xl text-blue-600 hover:shadow-md transition-all">
                          <Edit size={16} />
                        </Link>
                        <button onClick={() => handleDelete(customer.id, customer.name)} className="p-3 bg-white border border-gray-100 rounded-xl text-red-500 hover:shadow-md transition-all">
                          <Trash2 size={16} />
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

      {/* Modal Tambah Client */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] p-8 lg:p-10 relative z-10 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-black text-gray-800 tracking-tighter">New client</h2>
                <p className="text-[10px] font-bold text-gray-400 tracking-widest">Entry database pelanggan baru</p>
              </div>

              <button onClick={() => setShowAddModal(false)} className="p-2 bg-gray-50 rounded-full hover:bg-gray-100"><X size={24} /></button>
            </div>

            <form onSubmit={handleCreate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-1">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1">Nama lengkap *</label>
                  <input required className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-xs font-bold mt-2 outline-none focus:ring-2 focus:ring-green-500"
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>

                <div className="col-span-1">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1">Tipe member *</label>
                  <select required className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-xs font-bold mt-2 outline-none focus:ring-2 focus:ring-green-500"
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'grosir' | 'ecer' })}>


                    <option value="ecer">ECERAN</option>
                    <option value="grosir">GROSIR</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1">WhatsApp / HP *</label>
                  <input required type="tel" className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-xs font-bold mt-2 outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="08..." onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1">Email</label>
                  <input type="email" className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-xs font-bold mt-2 outline-none focus:ring-2 focus:ring-green-500"
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1">Alamat lengkap</label>
                  <textarea rows={2} className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-xs font-bold mt-2 outline-none focus:ring-2 focus:ring-green-500"
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1">Limit kredit (Rp)</label>
                  <input type="number" className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-xs font-bold mt-2 outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="0" onChange={(e) => setFormData({ ...formData, creditLimit: Number(e.target.value) })} />
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1">Catatan internal</label>
                  <input className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-xs font-bold mt-2 outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Misal: Pelanggan setia / pembayaran lancar" onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
                </div>

              </div>

              <div className="pt-6 flex gap-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-5 text-[10px] font-black tracking-widest text-gray-400 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all">Batal</button>
                <button type="submit" className="flex-1 py-5 bg-green-600 text-white rounded-2xl text-[10px] font-black tracking-widest shadow-xl shadow-green-100 hover:bg-green-700 transition-all">Simpan client</button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface StatBoxProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  bg: string;
}

function StatBox({ label, value, icon: Icon, color, bg }: StatBoxProps) {

  return (
    <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all">
      <div>
        <p className="text-[9px] font-black text-gray-400 tracking-[0.2em] mb-1">{label}</p>

        <p className="text-xl font-black text-gray-800 tracking-tighter">{value}</p>
      </div>
      <div className={`${bg} ${color} p-4 rounded-3xl group-hover:scale-110 transition-transform shadow-inner`}>
        <Icon size={22} />
      </div>
    </div>
  );
}
