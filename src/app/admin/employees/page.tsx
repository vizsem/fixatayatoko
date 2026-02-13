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
  increment, addDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast, Toaster } from 'react-hot-toast';

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

      toast.error("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'employees', editingId), formData);
        toast.success("Data berhasil diperbarui");
      } else {
        await addDoc(collection(db, 'employees'), {
          ...formData,
          totalAttendance: 0,
          createdAt: serverTimestamp()
        });
        toast.success("Karyawan baru ditambahkan");
      }
      setIsModalOpen(false);
      resetForm();
      fetchEmployees();
    } catch {

      toast.error("Terjadi kesalahan sistem");
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
    try {
      await deleteDoc(doc(db, 'employees', id));
      toast.success("Data dihapus");
      fetchEmployees();
    } catch {

      toast.error("Gagal menghapus");
    }
  };

  const handlePresent = async (id: string) => {
    try {
      await updateDoc(doc(db, 'employees', id), { totalAttendance: increment(1) });
      toast.success("Kehadiran tercatat");
      fetchEmployees();
    } catch { toast.error("Gagal update absensi"); }

  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ name: '', role: 'Karyawan Toko', email: '', phone: '', manualSalary: 0, workSchedule: '07:00 - 14:00', status: 'AKTIF' });
  };

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Toaster position="top-center" />

      <div className="px-4 md:px-8 pt-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 text-green-600 rounded-2xl">
              <UserCog size={22} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-gray-900">Team Ataya</h1>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Manajemen staf & kehadiran</p>
            </div>
          </div>
          <button
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="bg-black text-white px-6 py-3 rounded-2xl flex items-center gap-2 text-[10px] font-black shadow-lg active:scale-95 transition-all"
          >
            <Plus size={16} /> Tambah Staff
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <div className="relative mb-10 group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-green-600 transition-colors" size={20} />
          <input
            type="text"
            placeholder="Cari berdasarkan nama staff..."
            className="w-full pl-14 pr-6 py-5 bg-white border-none rounded-[28px] text-sm font-bold focus:ring-4 focus:ring-green-500/10 outline-none shadow-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-green-600" size={40} /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredEmployees.map((emp) => (
              <div key={emp.id} className="bg-white rounded-[35px] p-7 shadow-sm border border-gray-100 hover:shadow-xl hover:shadow-gray-200/50 transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 px-5 py-2.5 bg-gray-50 text-gray-500 rounded-bl-[20px] flex items-center gap-2 border-l border-b border-gray-100">
                  <Clock size={12} />
                  <span className="text-[9px] font-black tracking-widest">{emp.workSchedule}</span>

                </div>

                <div className="flex justify-between items-start mb-6 pt-4">
                  <div className="w-16 h-16 bg-green-50 rounded-3xl flex items-center justify-center text-green-600 group-hover:bg-green-600 group-hover:text-white transition-all shadow-inner">
                    <UserCog size={32} />
                  </div>
                  <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black tracking-[0.1em] ${emp.status === 'AKTIF' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>

                    {emp.status}
                  </span>
                </div>

                <div className="mb-6">
                  <h3 className="font-black text-gray-800 tracking-tighter text-xl leading-none mb-2">{emp.name}</h3>
                  <div className="flex items-center gap-2 text-green-600">
                    <ShieldCheck size={14} />
                    <span className="text-[10px] font-black tracking-widest">{emp.role}</span>
                  </div>

                </div>

                <div className="space-y-3 mb-8">
                  <div className="p-5 bg-[#FBFBFE] rounded-[25px] border border-gray-50 group-hover:border-green-100 transition-all">
                    <span className="text-[9px] font-black text-gray-400 tracking-widest block mb-1">Take home pay</span>
                    <p className="text-2xl font-black text-gray-800 tracking-tighter">Rp {emp.manualSalary?.toLocaleString('id-ID')}</p>
                  </div>

                  <div className="flex items-center gap-2 px-2 text-gray-400">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    <span className="text-[11px] font-black tracking-tighter text-gray-500">Total absensi: {emp.totalAttendance || 0} Hari</span>
                  </div>

                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <button onClick={() => handlePresent(emp.id)} className="bg-gray-900 hover:bg-black text-white py-4 rounded-2xl font-black text-[10px] tracking-widest transition-all active:scale-95 shadow-lg shadow-gray-200">Absen hadir</button>
                  <button onClick={() => toast.error("Alpha dicatat")} className="bg-white border-2 border-rose-50 text-rose-500 hover:bg-rose-50 py-4 rounded-2xl font-black text-[10px] tracking-widest transition-all active:scale-95">Alpha</button>
                </div>


                <div className="flex items-center justify-between pt-5 border-t border-gray-50">
                  <button onClick={() => handleEdit(emp)} className="flex items-center gap-2 text-[10px] font-black text-blue-600 hover:text-blue-800 transition-colors">
                    <Edit size={14} /> Edit data
                  </button>

                  <button onClick={() => handleDelete(emp.id)} className="text-gray-300 hover:text-rose-500 transition-colors">
                    <Trash2 size={18} />
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
