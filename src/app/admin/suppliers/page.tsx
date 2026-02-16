// src/app/(admin)/suppliers/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';

import { auth, db } from '@/lib/firebase';
import Link from 'next/link';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';
import {
  Plus,
  Edit,
  Trash2,
  ArrowLeft,
  Users,
  Phone,
  MapPin,
  Mail,
  Search
} from 'lucide-react';


type Supplier = {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  category: string;
  unit: string;
  notes: string;
  createdAt: string;
};

export default async function AdminSuppliers() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    category: '',
    unit: '',
    notes: ''
  });

  // Verifikasi akses admin
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
        notify.aksesDitolakAdmin();
        router.push('/profil');
        return;
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  // Ambil data supplier secara real-time
  useEffect(() => {
    if (loading) return;

    const suppliersRef = collection(db, 'suppliers');
    const q = query(suppliersRef, orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const supplierList: Supplier[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          supplierList.push({
            id: doc.id,
            name: data.name || '',
            contactPerson: data.contactPerson || '',
            phone: data.phone || '',
            email: data.email || '',
            address: data.address || '',
            category: data.category || '',
            unit: data.unit || '',
            notes: data.notes || '',
            createdAt: data.createdAt || ''
          });
        });
        setSuppliers(supplierList);
        setError(null);
      },
      (err) => {
        console.error('Gagal memuat supplier:', err);
        setError('Gagal memuat data supplier. Silakan coba lagi nanti.');
      }
    );

    return () => unsubscribe();
  }, [loading]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'suppliers'), {
        ...formData,
        createdAt: new Date().toISOString()
      });
      notify.success('Supplier berhasil ditambahkan');
      setShowAddModal(false);
      setFormData({
        name: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        category: '',
        unit: '',
        notes: ''
      });
    } catch {
      notify.error('Gagal menambahkan supplier.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus supplier "${name}"? Tindakan ini tidak bisa dikembalikan.`)) return;
    try {
      await deleteDoc(doc(db, 'suppliers', id));
      notify.success('Supplier dihapus');
    } catch {
      notify.error('Gagal menghapus supplier.');
    }
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.phone.includes(searchTerm) ||
    supplier.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / pageSize));
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const pageItems = filteredSuppliers.slice(startIdx, endIdx);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat data supplier...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen text-black">
      <Toaster position="top-right" />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-3 bg-white rounded-2xl shadow-sm hover:bg-black hover:text-white transition-all">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="p-3 bg-black text-white rounded-2xl inline-flex">
              <Users size={22} />
            </div>
            <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Manajemen Supplier</h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Kelola database pemasok toko</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-black text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2"
        >
          <Plus size={16} /> Tambah Supplier
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
          <input
            type="text"
            placeholder="Cari supplier..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-11 pr-4 py-3 bg-gray-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-black outline-none"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-white text-black border border-gray-100 px-6 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2"
          >
            <Plus size={16} /> Tambah
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supplier
                </th>
                <th scope="col" className="hidden md:table-cell px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kontak
                </th>
                <th scope="col" className="hidden md:table-cell px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kategori
                </th>
                <th scope="col" className="hidden md:table-cell px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Alamat
                </th>
                <th scope="col" className="hidden md:table-cell px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Satuan
                </th>
                <th scope="col" className="px-3 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 md:px-6 py-10 md:py-12 text-center text-gray-500">
                    <Users className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                    <p>Belum ada supplier terdaftar</p>
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="mt-2 inline-block text-green-600 hover:text-green-800 font-medium"
                    >
                      Tambah supplier sekarang
                    </button>
                  </td>
                </tr>
              ) : (
                pageItems.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{supplier.name}</div>
                      <div className="text-sm text-gray-500">{supplier.contactPerson}</div>
                      <button
                        onClick={() => setExpandedRows(prev => ({ ...prev, [supplier.id]: !prev[supplier.id] }))}
                        className="md:hidden mt-2 inline-flex items-center gap-1 text-[10px] font-black text-blue-600"
                      >
                        {expandedRows[supplier.id] ? 'Tutup' : 'Detail'}
                      </button>
                    </td>
                    <td className="hidden md:table-cell px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 mb-1">
                        <Phone size={14} className="text-gray-400" />
                        <span className="text-sm">{supplier.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="text-gray-400" />
                        <span className="text-sm text-gray-500">{supplier.email}</span>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                        {supplier.category || 'Umum'}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-sm text-gray-700 max-w-xs">
                      <div className="flex items-start gap-2">
                        <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <span className="truncate">{supplier.address}</span>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-sm text-gray-700">
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                        {supplier.unit || '-'}
                      </span>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/admin/suppliers/edit/${supplier.id}`}
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <Edit size={16} />
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(supplier.id, supplier.name)}
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

      <div className="md:hidden">
        <table className="w-full">
          <tbody>
            {pageItems.map((supplier) => (
              expandedRows[supplier.id] ? (
                <tr key={`${supplier.id}-detail`}>
                  <td colSpan={5} className="px-3 py-3 bg-gray-50 border-t">
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Phone size={12} className="text-gray-400" />
                        <span>{supplier.phone || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail size={12} className="text-gray-400" />
                        <span className="text-gray-500">{supplier.email || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] bg-blue-100 text-blue-800 rounded-full">
                          {supplier.category || 'Umum'}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin size={12} className="text-gray-400 mt-0.5" />
                        <span className="text-gray-700">{supplier.address || '-'}</span>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : null
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Menampilkan {filteredSuppliers.length === 0 ? 0 : startIdx + 1}–{Math.min(endIdx, filteredSuppliers.length)} dari {filteredSuppliers.length}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className={`px-4 py-2 rounded-xl text-xs font-bold border ${currentPage === 1 ? 'text-gray-300 border-gray-200' : 'text-black border-gray-300 hover:bg-gray-50'}`}
          >
            Sebelumnya
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className={`px-4 py-2 rounded-xl text-xs font-bold border ${currentPage === totalPages ? 'text-gray-300 border-gray-200' : 'text-black border-gray-300 hover:bg-gray-50'}`}
          >
            Berikutnya
          </button>
        </div>
      </div>

      {/* Modal Tambah Supplier */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Tambah Supplier Baru</h2>
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nama Supplier *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="Contoh: PT. Sembako Jaya"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Penanggung Jawab *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.contactPerson}
                      onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="Nama kontak"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Telepon *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="081234567890"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="supplier@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Kategori Produk
                    </label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="Contoh: Beras, Minyak, Bumbu"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Satuan Produk
                    </label>
                    <input
                      type="text"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="Contoh: Kg, Pcs, Liter"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Alamat Lengkap
                    </label>
                    <textarea
                      rows={3}
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="Jl. Raya No. 123, Kota"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Catatan Tambahan
                    </label>
                    <textarea
                      rows={2}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="Informasi tambahan tentang supplier"
                    />
                  </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Simpan Supplier
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
