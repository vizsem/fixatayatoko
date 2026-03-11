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
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F8F9FC] text-slate-800 font-sans pb-20">
      <Toaster position="top-center" />

      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
           <div className="flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="flex items-center gap-3">
               <div className="p-2.5 bg-emerald-600 rounded-xl text-white shadow-lg shadow-emerald-200">
                 <UserCog size={20} />
               </div>
               <div>
                 <h1 className="text-xl font-black text-slate-900 tracking-tight">Team Ataya</h1>
                 <p className="text-xs font-medium text-slate-500">Manajemen staf & kehadiran</p>
               </div>
             </div>
             
             <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Cari nama, jabatan..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => { resetForm(); setIsModalOpen(true); }}
                  className="bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-lg shadow-slate-200"
                >
                  <Plus size={16} /> <span className="hidden sm:inline">Tambah Staff</span>
                </button>
             </div>
           </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-emerald-600" size={32} /></div>
        ) : (
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
             <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                 <thead className="bg-slate-50/50 border-b border-slate-100">
                   <tr>
                     <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Nama Staff</th>
                     <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Jabatan</th>
                     <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Jadwal & Status</th>
                     <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Gaji & Absensi</th>
                     <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Aksi</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                   {filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm font-medium">
                          Tidak ada data karyawan ditemukan.
                        </td>
                      </tr>
                   ) : (
                     filteredEmployees.map((emp) => (
                       <tr key={emp.id} className="group hover:bg-slate-50/80 transition-colors">
                         <td className="px-6 py-4">
                           <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center font-bold text-xs border border-emerald-100">
                               {emp.name.charAt(0).toUpperCase()}
                             </div>
                             <div>
                               <p className="text-sm font-bold text-slate-800">{emp.name}</p>
                               <p className="text-[10px] text-slate-400 font-medium">{emp.phone || '-'}</p>
                             </div>
                           </div>
                         </td>
                         <td className="px-6 py-4">
                           <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-wide border border-indigo-100">
                             <ShieldCheck size={12} /> {emp.role}
                           </span>
                         </td>
                         <td className="px-6 py-4">
                           <div className="flex flex-col gap-1.5">
                             <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                               <Clock size={14} className="text-slate-400" />
                               {emp.workSchedule}
                             </div>
                             <span className={`inline-flex self-start px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                               emp.status === 'AKTIF' 
                                 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                 : 'bg-rose-50 text-rose-600 border border-rose-100'
                             }`}>
                               {emp.status}
                             </span>
                           </div>
                         </td>
                         <td className="px-6 py-4">
                           <div className="space-y-1">
                             <p className="text-xs font-bold text-slate-700">Rp {emp.manualSalary?.toLocaleString('id-ID')}</p>
                             <div className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                               <CheckCircle2 size={12} className="text-emerald-500" />
                               Hadir: {emp.totalAttendance || 0} hari
                             </div>
                           </div>
                         </td>
                         <td className="px-6 py-4">
                           <div className="flex items-center justify-end gap-2">
                             <button 
                               onClick={() => handlePresent(emp)}
                               title="Absen Hadir"
                               className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 hover:text-emerald-700 transition-colors border border-emerald-100"
                             >
                               <CheckCircle2 size={16} />
                             </button>
                             <button 
                               onClick={() => handleAlpha(emp)}
                               title="Alpha (Denda)"
                               className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 hover:text-rose-700 transition-colors border border-rose-100"
                             >
                               <X size={16} />
                             </button>
                             <div className="w-[1px] h-6 bg-slate-200 mx-1"></div>
                             <button 
                               onClick={() => handleEdit(emp)}
                               className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                             >
                               <Edit size={16} />
                             </button>
                             <button 
                               onClick={() => handleDelete(emp.id)}
                               className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                             >
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
        )}
      </main>

      {/* MODAL TAMBAH/EDIT */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2rem] p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-6">
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">{editingId ? 'Edit Data Staff' : 'Registrasi Staff Baru'}</h2>
                <p className="text-xs text-slate-400 font-medium mt-1">Lengkapi informasi karyawan di bawah ini.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-50 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>


            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap</label>
                  <input 
                    required 
                    value={formData.name} 
                    onChange={e => setFormData({ ...formData, name: e.target.value })} 
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none" 
                    placeholder="Nama staff" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kontak (WA)</label>
                  <input 
                    value={formData.phone} 
                    onChange={e => setFormData({ ...formData, phone: e.target.value })} 
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none" 
                    placeholder="08xxx" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jabatan</label>
                  <select 
                    value={formData.role} 
                    onChange={e => setFormData({ ...formData, role: e.target.value })} 
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none appearance-none"
                  >
                    <option>Karyawan Toko</option>
                    <option>Kasir</option>
                    <option>Kurir</option>
                    <option>Admin Gudang</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                  <select 
                    value={formData.status} 
                    onChange={e => setFormData({ ...formData, status: e.target.value as 'AKTIF' | 'NON-AKTIF' })} 
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none appearance-none"
                  >
                    <option value="AKTIF">AKTIF</option>
                    <option value="NON-AKTIF">NON-AKTIF</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gaji Bulanan (Rp)</label>
                 <div className="relative">
                   <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">Rp</span>
                   <input 
                     type="number" 
                     required 
                     value={formData.manualSalary} 
                     onChange={e => setFormData({ ...formData, manualSalary: Number(e.target.value) })} 
                     className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none" 
                   />
                 </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jadwal Shift</label>
                <div className="relative">
                   <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                   <input 
                     required 
                     value={formData.workSchedule} 
                     onChange={e => setFormData({ ...formData, workSchedule: e.target.value })} 
                     className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none" 
                     placeholder="Contoh: 08:00 - 16:00" 
                   />
                </div>
              </div>

              <div className="pt-4">
                <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-sm shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                  <Save size={18} /> {editingId ? 'Simpan Perubahan' : 'Simpan Data Staff'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
