'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Contact, Plus, Search, Edit, Trash2, ArrowLeft,
  Mail, Phone, UserCog, Loader2,
  Wallet, Clock, CheckCircle2, XCircle
} from 'lucide-react';
import Link from 'next/link';
import { 
  collection, getDocs, updateDoc, doc, query, orderBy, increment 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast, Toaster } from 'react-hot-toast';

// Tipe data dengan Gaji & Jadwal manual
type Employee = {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  status: 'AKTIF' | 'NON-AKTIF';
  joinDate: string;
  manualSalary: number; // Diinput manual oleh admin
  workSchedule: string; // Diinput manual (contoh: "07:00 - 14:00")
  totalAttendance: number; 
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const q = query(collection(db, 'employees'), orderBy('name', 'asc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Employee[];
      setEmployees(data);
    } catch (error) {
      console.error("Error fetching employees:", error);
      toast.error("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  const handlePresent = async (id: string) => {
    try {
      const empRef = doc(db, 'employees', id);
      await updateDoc(empRef, { totalAttendance: increment(1) });
      toast.success("Kehadiran bertambah");
      fetchEmployees();
    } catch (error) {
      toast.error("Gagal update absensi");
    }
  };

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Loader2 className="animate-spin text-green-600" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FBFBFE] pb-20">
      <Toaster position="top-center" />
      
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="p-2 hover:bg-gray-50 rounded-full transition-colors">
              <ArrowLeft size={20} className="text-gray-600" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Manajemen Karyawan</h1>
              <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">AtayaToko Internal</p>
            </div>
          </div>
          <button className="bg-green-600 text-white px-5 py-2.5 rounded-2xl flex items-center gap-2 text-xs font-black uppercase shadow-lg shadow-green-100">
            <Plus size={18} /> Tambah Karyawan
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="Cari karyawan..."
            className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-[24px] text-sm focus:ring-2 focus:ring-green-500 outline-none shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEmployees.map((emp) => (
            <EmployeeCard 
              key={emp.id} 
              employee={emp} 
              onPresent={() => handlePresent(emp.id)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function EmployeeCard({ employee, onPresent }: { employee: Employee, onPresent: () => void }) {
  return (
    <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all group relative">
      {/* Jadwal Kerja Manual */}
      <div className="absolute top-0 right-0 px-4 py-2 bg-gray-100 text-gray-600 rounded-bl-2xl flex items-center gap-2">
        <Clock size={12} />
        <span className="text-[9px] font-black uppercase tracking-tighter">
          {employee.workSchedule || 'Jadwal Belum Diatur'}
        </span>
      </div>

      <div className="flex justify-between items-start mb-6 mt-4">
        <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-green-600 group-hover:bg-green-600 group-hover:text-white transition-all">
          <UserCog size={28} />
        </div>
        <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
          employee.status === 'AKTIF' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {employee.status}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="font-black text-gray-800 uppercase tracking-tighter text-lg">{employee.name}</h3>
        <p className="text-xs font-bold text-green-600 uppercase tracking-widest">{employee.role}</p>
      </div>

      <div className="space-y-3 mb-6">
        {/* Input Gaji Manual */}
        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 group-hover:bg-white group-hover:border-green-100 transition-all">
          <div className="flex items-center gap-2 mb-1 text-gray-400">
            <Wallet size={14} />
            <span className="text-[9px] font-black uppercase tracking-widest">Gaji Terinput</span>
          </div>
          <p className="text-xl font-black text-gray-800 tracking-tighter">
            Rp {(employee.manualSalary || 0).toLocaleString('id-ID')}
          </p>
        </div>

        <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-2 text-gray-400">
            <CheckCircle2 size={14} />
            <span className="text-[10px] font-bold uppercase">Kehadiran: {employee.totalAttendance || 0} Hari</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button 
          onClick={onPresent}
          className="bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest active:scale-95"
        >
          Absen Hadir
        </button>
        <button 
          onClick={() => toast.error("Absensi Alpha dicatat")}
          className="bg-white border border-red-100 text-red-500 hover:bg-red-50 py-3 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest active:scale-95"
        >
          Alpha
        </button>
      </div>

      <div className="mt-4 flex gap-2 pt-4 border-t border-gray-50">
        <button className="flex-1 text-[9px] font-black uppercase text-blue-600 hover:underline">Edit Gaji & Jadwal</button>
        <button className="text-red-400 hover:text-red-600 transition-colors">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}