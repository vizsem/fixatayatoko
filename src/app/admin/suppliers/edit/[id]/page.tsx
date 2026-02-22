 'use client';
 
 import { useEffect, useState, useCallback } from 'react';
 import { useRouter, useParams } from 'next/navigation';
 import { onAuthStateChanged } from 'firebase/auth';
 import { doc, getDoc, updateDoc } from 'firebase/firestore';
import Link from 'next/link';
import notify from '@/lib/notify';
import { Toaster } from 'react-hot-toast';
 import { ArrowLeft, Save, Users, Phone, Mail, MapPin } from 'lucide-react';
import { auth, db } from '@/lib/firebase';

 
 interface SupplierData {
   name: string;
   contactPerson: string;
   phone: string;
   email: string;
   address: string;
   category: string;
   notes: string;
 }
 
 export default function EditSupplierPage() {
   const router = useRouter();
   const params = useParams();
   const id = params.id as string;
 
   const [loading, setLoading] = useState(true);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [supplier, setSupplier] = useState<SupplierData>({
     name: '',
     contactPerson: '',
     phone: '',
     email: '',
     address: '',
     category: '',
     notes: ''
   });
 
   useEffect(() => {
     const unsubscribe = onAuthStateChanged(auth, async (user) => {
       if (!user) {
         router.push('/profil/login');
         return;
       }
 
       const userDoc = await getDoc(doc(db, 'users', user.uid));
       if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
        notify.admin.error('Akses ditolak! Anda bukan admin.');
         router.push('/profil');
         return;
       }
 
       setLoading(false);
     });
 
     return () => unsubscribe();
   }, [router]);
 
   const fetchSupplier = useCallback(async () => {
     try {
       const snap = await getDoc(doc(db, 'suppliers', id));
       if (!snap.exists()) {
         notify.admin.error('Supplier tidak ditemukan');
         router.push('/admin/suppliers');
         return;
       }
       const data = snap.data() as Partial<SupplierData>;
       setSupplier({
         name: String(data.name ?? ''),
         contactPerson: String(data.contactPerson ?? ''),
         phone: String(data.phone ?? ''),
         email: String(data.email ?? ''),
         address: String(data.address ?? ''),
         category: String(data.category ?? ''),
         notes: String(data.notes ?? '')
       });
    } catch {
       setError('Gagal memuat data supplier.');
     }
   }, [id, router]);
 
   useEffect(() => {
     if (!loading) {
       fetchSupplier();
     }
   }, [loading, fetchSupplier]);
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     if (isSubmitting) return;
     setIsSubmitting(true);
     setError(null);
     try {
       await updateDoc(doc(db, 'suppliers', id), {
         name: supplier.name.trim(),
         contactPerson: supplier.contactPerson.trim(),
         phone: supplier.phone.trim(),
         email: supplier.email.trim(),
         address: supplier.address.trim(),
         category: supplier.category.trim(),
         notes: supplier.notes.trim()
       });
       notify.admin.success('Perubahan disimpan');
       router.push('/admin/suppliers');
    } catch {
       setError('Gagal menyimpan perubahan.');
     } finally {
       setIsSubmitting(false);
     }
   };
 
   if (loading) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
         <div className="text-center">
           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
           <p className="mt-4 text-gray-600">Memuat halaman edit...</p>
         </div>
       </div>
     );
   }
 
   return (
    <div className="p-6 md:p-10 bg-gray-50 min-h-screen text-black max-w-4xl mx-auto">
      <Toaster position="top-right" />
       <div className="flex items-center gap-4 mb-8">
         <Link href="/admin/suppliers" className="p-3 bg-white rounded-2xl shadow-sm hover:bg-black hover:text-white transition-all">
           <ArrowLeft size={20} />
         </Link>
         <div>
           <div className="p-3 bg-black text-white rounded-2xl inline-flex">
             <Users size={22} />
           </div>
           <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Edit Supplier</h1>
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Perbarui informasi pemasok</p>
         </div>
       </div>
 
       {error && (
         <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
           {error}
         </div>
       )}
 
       <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-[2rem] border border-gray-100 shadow-sm space-y-6">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div>
             <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">Nama Supplier</label>
             <input
               type="text"
               required
               value={supplier.name}
               onChange={(e) => setSupplier({ ...supplier, name: e.target.value })}
               className="w-full bg-gray-50 px-4 py-3 rounded-2xl text-xs font-bold outline-none border-none ring-1 ring-gray-100 focus:ring-black transition-all"
               placeholder="PT. Sembako Jaya"
             />
           </div>
           <div>
             <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">Penanggung Jawab</label>
             <input
               type="text"
               required
               value={supplier.contactPerson}
               onChange={(e) => setSupplier({ ...supplier, contactPerson: e.target.value })}
               className="w-full bg-gray-50 px-4 py-3 rounded-2xl text-xs font-bold outline-none border-none ring-1 ring-gray-100 focus:ring-black transition-all"
               placeholder="Nama kontak"
             />
           </div>
           <div>
             <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 flex items-center gap-2"><Phone size={14} className="text-gray-400" /> Telepon</label>
             <input
               type="tel"
               required
               value={supplier.phone}
               onChange={(e) => setSupplier({ ...supplier, phone: e.target.value })}
               className="w-full bg-gray-50 px-4 py-3 rounded-2xl text-xs font-bold outline-none border-none ring-1 ring-gray-100 focus:ring-black transition-all"
               placeholder="081234567890"
             />
           </div>
           <div>
             <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 flex items-center gap-2"><Mail size={14} className="text-gray-400" /> Email</label>
             <input
               type="email"
               value={supplier.email}
               onChange={(e) => setSupplier({ ...supplier, email: e.target.value })}
               className="w-full bg-gray-50 px-4 py-3 rounded-2xl text-xs font-bold outline-none border-none ring-1 ring-gray-100 focus:ring-black transition-all"
               placeholder="supplier@email.com"
             />
           </div>
           <div className="md:col-span-2">
             <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 flex items-center gap-2"><MapPin size={14} className="text-gray-400" /> Alamat</label>
             <textarea
               rows={3}
               value={supplier.address}
               onChange={(e) => setSupplier({ ...supplier, address: e.target.value })}
               className="w-full bg-gray-50 px-4 py-3 rounded-2xl text-xs font-bold outline-none border-none ring-1 ring-gray-100 focus:ring-black transition-all"
               placeholder="Jl. Raya No. 123, Kota"
             />
           </div>
           <div>
             <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">Kategori Produk</label>
             <input
               type="text"
               value={supplier.category}
               onChange={(e) => setSupplier({ ...supplier, category: e.target.value })}
               className="w-full bg-gray-50 px-4 py-3 rounded-2xl text-xs font-bold outline-none border-none ring-1 ring-gray-100 focus:ring-black transition-all"
               placeholder="Beras, Minyak, Bumbu"
             />
           </div>
           <div className="md:col-span-2">
             <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">Catatan</label>
             <textarea
               rows={2}
               value={supplier.notes}
               onChange={(e) => setSupplier({ ...supplier, notes: e.target.value })}
               className="w-full bg-gray-50 px-4 py-3 rounded-2xl text-xs font-bold outline-none border-none ring-1 ring-gray-100 focus:ring-black transition-all"
               placeholder="Informasi tambahan"
             />
           </div>
         </div>
 
         <div className="flex justify-end gap-3">
           <Link href="/admin/suppliers" className="px-4 py-3 border border-gray-200 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-gray-50">
             Batal
           </Link>
           <button
             type="submit"
             disabled={isSubmitting}
             className="px-6 py-3 bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 hover:bg-slate-900 active:scale-95"
           >
             <Save size={16} /> {isSubmitting ? 'Menyimpan...' : 'Simpan'}
           </button>
         </div>
       </form>
     </div>
   );
 }
