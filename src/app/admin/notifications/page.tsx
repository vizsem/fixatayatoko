'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { Send, Info, Tag } from 'lucide-react';

export default function NotificationsPage() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  
  // Form State
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState('info'); // info, promo
  const [target, setTarget] = useState('all'); // all, user
  const [targetUserId, setTargetUserId] = useState('');
  const [category, setCategory] = useState('');
  
  // History State
  const [history, setHistory] = useState<any[]>([]);

  const fetchHistory = async () => {
    try {
        // Fetch recent broadcast notifications
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', 'all'),
            orderBy('createdAt', 'desc'),
            limit(20)
        );
        const snap = await getDocs(q);
        setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
        console.error(e);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
  }, [activeTab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) return alert('Judul dan Pesan wajib diisi');
    if (target === 'user' && !targetUserId) return alert('User ID wajib diisi');

    setLoading(true);
    try {
        await addDoc(collection(db, 'notifications'), {
            title,
            body,
            type,
            category: category || (type === 'promo' ? 'Promo' : 'Info'),
            userId: target === 'all' ? 'all' : targetUserId,
            createdAt: serverTimestamp(),
            read: false
        });
        
        alert('Notifikasi berhasil dikirim!');
        setTitle('');
        setBody('');
        setTargetUserId('');
        setCategory('');
        if (activeTab === 'history') fetchHistory();
    } catch (error) {
        console.error(error);
        alert('Gagal mengirim notifikasi');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
           <h1 className="text-2xl font-black text-gray-800 tracking-tight">Kelola Notifikasi</h1>
           <p className="text-sm text-gray-500 font-medium">Kirim notifikasi promo atau info ke pengguna.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-100 pb-1">
        <button 
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 text-sm font-bold rounded-t-xl transition-colors ${activeTab === 'create' ? 'bg-white border-b-2 border-green-500 text-green-600' : 'text-gray-400 hover:text-gray-600'}`}
        >
            Buat Notifikasi
        </button>
        <button 
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-bold rounded-t-xl transition-colors ${activeTab === 'history' ? 'bg-white border-b-2 border-green-500 text-green-600' : 'text-gray-400 hover:text-gray-600'}`}
        >
            Riwayat Broadcast
        </button>
      </div>

      {activeTab === 'create' ? (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 max-w-2xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipe</label>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setType('info')} className={`flex-1 py-2 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 ${type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-200 text-gray-400'}`}>
                                <Info size={16} /> Info
                            </button>
                            <button type="button" onClick={() => setType('promo')} className={`flex-1 py-2 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 ${type === 'promo' ? 'bg-purple-50 border-purple-200 text-purple-600' : 'border-gray-200 text-gray-400'}`}>
                                <Tag size={16} /> Promo
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Target</label>
                        <select 
                            value={target} 
                            onChange={(e) => setTarget(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none focus:border-green-500"
                        >
                            <option value="all">Semua Pengguna (Broadcast)</option>
                            <option value="user">Spesifik User</option>
                        </select>
                    </div>
                </div>

                {target === 'user' && (
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">User ID</label>
                        <input 
                            type="text" 
                            value={targetUserId}
                            onChange={(e) => setTargetUserId(e.target.value)}
                            placeholder="Masukkan UID User..."
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none focus:border-green-500"
                        />
                    </div>
                )}

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Kategori (Opsional)</label>
                    <input 
                        type="text" 
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        placeholder={type === 'promo' ? 'Contoh: Flash Sale' : 'Contoh: Sistem'}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none focus:border-green-500"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Judul Notifikasi</label>
                    <input 
                        type="text" 
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Masukkan judul singkat..."
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none focus:border-green-500"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Isi Pesan</label>
                    <textarea 
                        rows={4}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="Tulis pesan lengkap di sini..."
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 outline-none focus:border-green-500 resize-none"
                    />
                </div>

                <div className="pt-2">
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading ? 'Mengirim...' : <><Send size={18} /> Kirim Notifikasi</>}
                    </button>
                </div>
            </form>
        </div>
      ) : (
        <div className="space-y-4">
            {history.length === 0 ? (
                <div className="text-center py-10 text-gray-400">Belum ada riwayat broadcast.</div>
            ) : (
                history.map((item) => (
                    <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-100 flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.type === 'promo' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                            {item.type === 'promo' ? <Tag size={20} /> : <Info size={20} />}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-gray-800">{item.title}</h3>
                                <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full uppercase font-bold">{item.category}</span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{item.body}</p>
                            <p className="text-[10px] text-gray-400">
                                {item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleString('id-ID') : 'Baru saja'}
                            </p>
                        </div>
                    </div>
                ))
            )}
        </div>
      )}
    </div>
  );
}
