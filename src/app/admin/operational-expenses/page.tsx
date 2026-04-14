'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  deleteDoc, 
  doc,
  where,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { OperationalExpense } from '@/lib/types';
import { 
  Plus, 
  Trash2, 
  FileText, 
  Calendar, 
  DollarSign,
  Search,
  Filter,
  Download,
  Edit
} from 'lucide-react';
import Link from 'next/link';
import notify from '@/lib/notify';
import * as XLSX from 'xlsx';

export default function OperationalExpensesPage() {
  const router = useRouter();
  const [expenses, setExpenses] = useState<OperationalExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Semua');
  const [dateFilter, setDateFilter] = useState('bulan-ini'); // bulan-ini, semua, custom (nanti)

  const categories = ['Listrik', 'Air', 'Gaji', 'Packing', 'Bensin', 'Pajak', 'Lainnya'];

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'operational_expenses'),
        orderBy('date', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as OperationalExpense[];
      
      setExpenses(data);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      notify.error('Gagal mengambil data pengeluaran');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data pengeluaran ini?')) return;
    
    try {
      await deleteDoc(doc(db, 'operational_expenses', id));
      setExpenses(prev => prev.filter(item => item.id !== id));
      notify.success('Pengeluaran berhasil dihapus');
    } catch (error) {
      console.error('Error deleting expense:', error);
      notify.error('Gagal menghapus pengeluaran');
    }
  };

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = expense.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          expense.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'Semua' || expense.category === categoryFilter;
    
    // Simple date filter implementation
    let matchesDate = true;
    if (dateFilter === 'bulan-ini' && expense.date) {
      let date: Date;
      // @ts-ignore - Handle various date formats including Firestore Timestamp
      if (typeof expense.date.toDate === 'function') {
        // @ts-ignore
        date = expense.date.toDate();
      } else if (expense.date instanceof Date) {
        date = expense.date;
      } else if ((expense.date as any).seconds) {
        date = new Date((expense.date as any).seconds * 1000);
      } else {
        date = new Date(expense.date as any);
      }
      
      const now = new Date();
      matchesDate = date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    
    return matchesSearch && matchesCategory && matchesDate;
  });

  const totalAmount = filteredExpenses.reduce((sum, item) => sum + Number(item.amount), 0);

  const formatDate = (date: any) => {
    if (!date) return '-';
    let d: Date;
    // @ts-ignore
    if (typeof date.toDate === 'function') {
      // @ts-ignore
      d = date.toDate();
    } else if (date instanceof Date) {
      d = date;
    } else if (date.seconds) {
      d = new Date(date.seconds * 1000);
    } else {
      d = new Date(date);
    }

    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const handleExport = () => {
    const exportData = filteredExpenses.map(item => ({
      Tanggal: formatDate(item.date),
      Kategori: item.category,
      Deskripsi: item.description,
      Jumlah: item.amount,
      Bukti: item.proofOfPayment || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pengeluaran');
    XLSX.writeFile(wb, `laporan-pengeluaran-${dateFilter}.xlsx`);
  };

  return (
    <div className="p-3 md:p-4 bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Pengeluaran Operasional</h1>
          <p className="text-gray-500">Kelola pengeluaran operasional toko</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExport}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50 transition-colors"
          >
            <Download size={20} />
            Export Excel
          </button>
          <Link 
            href="/admin/operational-expenses/add" 
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700 transition-colors"
          >
            <Plus size={20} />
            Tambah Pengeluaran
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Pengeluaran</p>
              <h3 className="text-2xl font-bold text-gray-800">{formatCurrency(totalAmount)}</h3>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Transaksi</p>
              <h3 className="text-2xl font-bold text-gray-800">{filteredExpenses.length}</h3>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
              <Calendar size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Periode</p>
              <h3 className="text-lg font-bold text-gray-800">
                {dateFilter === 'bulan-ini' ? 'Bulan Ini' : 'Semua Waktu'}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Cari deskripsi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="Semua">Semua Kategori</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="bulan-ini">Bulan Ini</option>
            <option value="semua">Semua Waktu</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tanggal</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kategori</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Deskripsi</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Jumlah</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Memuat data...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Belum ada data pengeluaran
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                      {formatDate(expense.date)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-800">
                      {expense.description}
                      {expense.proofOfPayment && (
                        <a 
                          href={expense.proofOfPayment} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="ml-2 text-blue-500 hover:text-blue-700 text-xs inline-flex items-center"
                        >
                          (Bukti)
                        </a>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-800 text-right">
                      {formatCurrency(expense.amount)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/admin/operational-expenses/edit/${expense.id}`}
                          className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit size={18} />
                        </Link>
                        <button
                          onClick={() => handleDelete(expense.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus"
                        >
                          <Trash2 size={18} />
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
    </div>
  );
}
