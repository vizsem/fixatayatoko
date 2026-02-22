'use client';

import { useEffect, useState } from 'react';

import {
  Plus, Search, Edit, Trash2,
  UserCog, Loader2, Clock, CheckCircle2,
  X, Save, ShieldCheck
} from 'lucide-react';

// import Link from 'next/link';
import {
  collection, getDocs, updateDoc, doc, query, orderBy,
  increment, addDoc, deleteDoc, serverTimestamp,
  writeBatch, arrayUnion, setDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import notify from '@/lib/notify';
import { Toaster } from 'react-hot-toast';

type Employee = {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  status: 'AKTIF' | 'NON-AKTIF';
  manualSalary: number;
  workSchedule: string;
  totalAttendance: number;
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '', role: 'Karyawan Toko', email: '', phone: '',
    manualSalary: 0, workSchedule: '07:00 - 14:00', status: 'AKTIF' as 'AKTIF' | 'NON-AKTIF'
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'employees'), orderBy('name', 'asc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Employee[];
      setEmployees(data);
    } catch {

      notify.admin.error("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'employees', editingId), formData);
        notify.admin.success("Data berhasil diperbarui");
      } else {
        await addDoc(collection(db, 'employees'), {
          ...formData,
          totalAttendance: 0,
          createdAt: serverTimestamp()
        });
        notify.admin.success("Karyawan baru ditambahkan");
      }
      setIsModalOpen(false);
      resetForm();
      fetchEmployees();
    } catch {

      notify.admin.error("Gagal menyimpan data");
    }
  };

  const handleEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setFormData({
      name: emp.name, role: emp.role, email: emp.email, phone: emp.phone,
      manualSalary: emp.manualSalary, workSchedule: emp.workSchedule, status: emp.status
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus data karyawan ini secara permanen?")) return;
    notify.admin.loading('Menghapus...');
    try {
      await deleteDoc(doc(db, 'employees', id));
      notify.admin.success("Berhasil dihapus");
      setEmployees(employees.filter(e => e.id !== id));
    } catch {
      notify.admin.error("Gagal menghapus");
    }
  };

  const handlePresent = async (employee: Employee) => {
    try {
      const batch = writeBatch(db);
      
      // Update attendance counter
      const employeeRef = doc(db, 'employees', employee.id);
      batch.update(employeeRef, { 
        totalAttendance: increment(1),
        attendanceDates: arrayUnion(new Date().toISOString().split('T')[0])
      });
      
      // Record operational cost for daily salary
      const dailySalary = Math.round(employee.manualSalary / 30); // Calculate daily salary
      if (dailySalary > 0) {
        const operationalRef = doc(collection(db, 'operational_costs'));
        batch.set(operationalRef, {
          type: 'GAJI_KARYAWAN',
          description: `Gaji harian ${employee.name} - ${employee.role}`,
          amount: dailySalary,
          employeeId: employee.id,
          employeeName: employee.name,
          date: new Date().toISOString().split('T')[0],
          createdAt: serverTimestamp(),
          category: 'PENGELUARAN_OPERASIONAL'
        });
      }
      
      await batch.commit();
      notify.admin.success("Kehadiran dan biaya operasional tercatat");
      fetchEmployees();
    } catch (error) { 
      console.error('Absensi error:', error);
      notify.admin.error("Gagal mencatat absensi"); 
    }
  };

  const handleAlpha = async (employee: Employee) => {
    try {
      // Record alpha (absence) in operational costs as penalty
      const penaltyAmount = Math.round(employee.manualSalary / 30 * 0.5); // 50% penalty for absence
      
      const operationalRef = doc(collection(db, 'operational_costs'));
      await setDoc(operationalRef, {
        type: 'DENDA_ALPHA',
        description: `Denda alpha ${employee.name} - ${employee.role}`,
        amount: -penaltyAmount, // Negative amount for penalty
        employeeId: employee.id,
        employeeName: employee.name,
        date: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
        category: 'PENGELUARAN_OPERASIONAL',
        notes: 'Karyawan tidak hadir (alpha)'
      });
      
      notify.admin.success("Alpha dan denda tercatat");
      fetchEmployees();
    } catch (error) { 
      console.error('Alpha error:', error);
      notify.admin.error("Gagal mencatat alpha"); 
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ name: '', role: 'Karyawan Toko', email: '', phone: '', manualSalary: 0, workSchedule: '07:00 - 14:00', status: 'AKTIF' });
  };

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-20">
      <Toaster position="top-center" />

      <div className="px-4 md:px-8 pt-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-3xl shadow-lg">
              <UserCog size={28} />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">Team Ataya</h1>
              <p className="text-xs font-semibold text-gray-500 mt-1">Manajemen staf & kehadiran</p>
            </div>
          </div>
          <button
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="bg-gradient-to-r from-gray-900 to-black text-white px-6 py-3.5 rounded-2xl text-sm font-bold hover:shadow-xl transition-all duration-200 flex items-center gap-2"
          >
            <Plus size={18} /> Tambah Staff
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <div className="relative mb-8 group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-green-600 transition-colors" size={20} />
          <input
            type="text"
            placeholder="Cari berdasarkan nama staff..."
            className="w-full pl-14 pr-6 py-4 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-green-600" size={40} /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEmployees.map((emp) => (
              <div key={emp.id} className="bg-white rounded-3xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 px-4 py-2 bg-gray-50 text-gray-600 rounded-bl-2xl flex items-center gap-2 border-l border-b border-gray-200">
                  <Clock size={12} />
                  <span className="text-xs font-medium">{emp.workSchedule}</span>
                </div>

                <div className="flex justify-between items-start mb-6 pt-2">
                  <div className="w-14 h-14 bg-green-100 text-green-700 rounded-2xl flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-all">
                    <UserCog size={28} />
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${emp.status === 'AKTIF' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {emp.status}
                  </span>
                </div>

                <div className="mb-6">
                  <h3 className="font-bold text-gray-900 text-lg leading-tight mb-2">{emp.name}</h3>
                  <div className="flex items-center gap-2 text-green-600">
                    <ShieldCheck size={14} />
                    <span className="text-xs font-medium">{emp.role}</span>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 group-hover:border-green-200 transition-all">
                    <span className="text-xs font-medium text-gray-500 block mb-1">Gaji Bulanan</span>
                    <p className="text-xl font-bold text-gray-900">Rp {emp.manualSalary?.toLocaleString('id-ID')}</p>
                  </div>

                  <div className="flex items-center gap-2 px-1 text-gray-500">
                    <CheckCircle2 size={16} className="text-green-500" />
                    <span className="text-sm font-medium">Total absensi: {emp.totalAttendance || 0} Hari</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <button onClick={() => handlePresent(emp)} className="bg-gray-900 hover:bg-black text-white py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 shadow-md">Absen hadir</button>
                  <button onClick={() => handleAlpha(emp)} className="bg-white border-2 border-red-100 text-red-600 hover:bg-red-50 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95">Alpha</button>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <button onClick={() => handleEdit(emp)} className="flex items-center gap-2 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">
                    <Edit size={14} /> Edit data
                  </button>

                  <button onClick={() => handleDelete(emp.id)} className="text-gray-400 hover:text-red-600 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL TAMBAH/EDIT */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[40px] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-lg font-black tracking-tighter italic">{editingId ? 'Edit profile staff' : 'Registrasi staff baru'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={20} /></button>
            </div>


            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 ml-2 tracking-widest">Nama lengkap</label>
                <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-green-500/20" placeholder="Contoh: Budi Santoso" />
              </div>


              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-gray-400 ml-2 tracking-widest">Jabatan</label>
                  <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className="w-full px-4 py-4 bg-gray-50 rounded-2xl text-xs font-bold outline-none">

                    <option>Karyawan Toko</option>
                    <option>Kasir</option>
                    <option>Kurir</option>
                    <option>Admin Gudang</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-gray-400 ml-2 tracking-widest">Gaji bulanan</label>
                  <input type="number" required value={formData.manualSalary} onChange={e => setFormData({ ...formData, manualSalary: Number(e.target.value) })} className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-xs font-bold outline-none" />
                </div>

              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 ml-2 tracking-widest">Jadwal shift</label>
                <input required value={formData.workSchedule} onChange={e => setFormData({ ...formData, workSchedule: e.target.value })} className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-xs font-bold outline-none" placeholder="07:00 - 14:00" />
              </div>


              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-gray-400 ml-2 tracking-widest">Kontak WA</label>
                  <input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-xs font-bold outline-none" placeholder="08xxx" />
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-gray-400 ml-2 tracking-widest">Status</label>
                  <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as 'AKTIF' | 'NON-AKTIF' })} className="w-full px-4 py-4 bg-gray-50 rounded-2xl text-xs font-bold outline-none">


                    <option value="AKTIF">AKTIF</option>
                    <option value="NON-AKTIF">OFF</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="w-full bg-green-600 text-white py-5 rounded-[24px] font-black text-[11px] tracking-[0.2em] shadow-xl shadow-green-100 hover:bg-green-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                <Save size={18} /> {editingId ? 'Simpan perubahan' : 'Daftarkan staff'}
              </button>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
