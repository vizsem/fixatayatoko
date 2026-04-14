'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  where 
} from 'firebase/firestore';
import { 
  Mail, 
  MessageCircle, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Search,
  User,
  Phone,
  Inbox
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import notify from '@/lib/notify';

type Message = {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  message: string;
  createdAt: any;
  status: 'unread' | 'read';
  type?: string;
};

export default function AdminMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'messages'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message));
      setMessages(msgs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'messages', id), { status: 'read' });
      notify.success('Pesan ditandai sudah dibaca');
    } catch (error) {
      console.error(error);
      notify.error('Gagal memperbarui status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus pesan ini?')) return;
    try {
      await deleteDoc(doc(db, 'messages', id));
      notify.success('Pesan dihapus');
    } catch (error) {
      console.error(error);
      notify.error('Gagal menghapus pesan');
    }
  };

  const filteredMessages = messages.filter(msg => {
    const matchesSearch = 
      (msg.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (msg.message || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (msg.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filter === 'unread') {
      return matchesSearch && msg.status === 'unread';
    }
    return matchesSearch;
  });

  const unreadCount = messages.filter(m => m.status === 'unread').length;

  return (
    <div className="p-3 md:p-4 max-w-7xl mx-auto min-h-screen bg-gray-50/50">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Inbox className="text-blue-600" />
            KOTAK MASUK
          </h1>
          <p className="text-sm text-gray-500">
            Kelola pesan dari formulir kontak pelanggan.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border shadow-sm">
           <button
             onClick={() => setFilter('all')}
             className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${filter === 'all' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
           >
             Semua
           </button>
           <button
             onClick={() => setFilter('unread')}
             className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${filter === 'unread' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
           >
             Belum Dibaca
             {unreadCount > 0 && (
               <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                 {unreadCount}
               </span>
             )}
           </button>
        </div>
      </div>

      <div className="mb-6 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Cari nama, email, atau isi pesan..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
        />
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 animate-pulse">Memuat pesan...</div>
      ) : filteredMessages.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
          <Inbox className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-500 font-medium">Tidak ada pesan ditemukan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredMessages.map((msg) => (
            <div 
              key={msg.id} 
              className={`bg-white p-6 rounded-2xl border transition-all hover:shadow-md ${
                msg.status === 'unread' ? 'border-l-4 border-l-blue-500 border-gray-100 bg-blue-50/10' : 'border-gray-100 opacity-80'
              }`}
            >
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${msg.status === 'unread' ? 'bg-blue-500' : 'bg-gray-300'}`}>
                      {(msg.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className={`font-bold text-gray-900 ${msg.status === 'unread' ? 'text-lg' : 'text-base'}`}>
                        {msg.name || 'Tanpa Nama'}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {msg.createdAt?.toDate ? format(msg.createdAt.toDate(), 'dd MMM yyyy HH:mm', { locale: id }) : '-'}
                        </span>
                        {msg.status === 'unread' && (
                          <span className="text-blue-600 font-bold bg-blue-100 px-2 py-0.5 rounded-full text-[10px]">BARU</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-xl text-sm border border-gray-100">
                    "{msg.message}"
                  </p>
                  
                  <div className="flex flex-wrap gap-2 text-xs">
                    {msg.email && (
                      <a href={`mailto:${msg.email}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
                        <Mail size={14} /> {msg.email}
                      </a>
                    )}
                    {msg.whatsapp && (
                      <a 
                        href={`https://wa.me/${msg.whatsapp.replace(/\D/g, '')}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors"
                      >
                        <MessageCircle size={14} /> {msg.whatsapp}
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex md:flex-col gap-2 justify-end">
                  {msg.status === 'unread' && (
                    <button
                      onClick={() => handleMarkAsRead(msg.id)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                      title="Tandai sudah dibaca"
                    >
                      <CheckCircle2 size={20} />
                      <span className="md:hidden text-xs font-bold">Baca</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(msg.id)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                    title="Hapus pesan"
                  >
                    <Trash2 size={20} />
                    <span className="md:hidden text-xs font-bold">Hapus</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
