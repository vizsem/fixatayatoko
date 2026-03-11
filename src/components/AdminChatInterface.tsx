'use client';

import { useState, useEffect, useRef } from 'react';
import { db, auth } from '@/lib/firebase';
import {
  collection, query, orderBy, onSnapshot,
  doc, updateDoc, addDoc, serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  Send, Image as ImageIcon, Search, 
  MoreVertical, ArrowLeft, Check, CheckCheck,
  User, X
} from 'lucide-react';
import Image from 'next/image';
import type { ChatThread, ChatMessage } from '@/types/chat';
import { toast } from 'react-hot-toast';

interface AdminChatInterfaceProps {
  onClose?: () => void;
  isModal?: boolean;
}

export default function AdminChatInterface({ onClose, isModal = false }: AdminChatInterfaceProps) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // 1. Auth Check
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Handle unauthenticated state if needed
        return;
      }
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const role = userDoc.data()?.role;
        setUserRole(role);
      } catch (error) {
        console.error("Error fetching user role:", error);
      }
    });
    return () => unsub();
  }, []);

  // 2. Fetch Chat Threads (Real-time)
  useEffect(() => {
    const q = query(
      collection(db, 'chats'),
      orderBy('lastMessageTime', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const threadsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatThread[];
      setThreads(threadsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 3. Fetch Messages for Selected Thread
  useEffect(() => {
    if (!selectedThread) return;

    // Mark as read when opening thread
    if (!selectedThread.isReadByAdmin) {
      updateDoc(doc(db, 'chats', selectedThread.id), {
        isReadByAdmin: true,
        unreadCount: 0
      });
    }

    const q = query(
      collection(db, 'chats', selectedThread.id, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      setMessages(msgs);
      scrollToBottom();
    });

    return () => unsubscribe();
  }, [selectedThread]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThread || !newMessage.trim()) return;

    try {
      const text = newMessage.trim();
      setNewMessage('');

      // Add message to subcollection
      await addDoc(collection(db, 'chats', selectedThread.id, 'messages'), {
        text,
        senderId: 'admin',
        createdAt: serverTimestamp(),
        isRead: false,
        type: 'text'
      });

      // Update thread metadata
      await updateDoc(doc(db, 'chats', selectedThread.id), {
        lastMessage: text,
        lastMessageTime: serverTimestamp(),
        isReadByAdmin: true // Admin just replied, so it's read by admin
      });

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Gagal mengirim pesan');
    }
  };

  const filteredThreads = threads.filter(t => 
    t.userInfo.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center h-full text-slate-400">Memuat Chat...</div>;
  }

  // Only allow admin and cashier
  if (userRole && userRole !== 'admin' && userRole !== 'cashier') {
    return <div className="flex items-center justify-center h-full text-red-500">Akses Ditolak</div>;
  }

  return (
    <div className={`flex h-full bg-slate-50 overflow-hidden ${isModal ? 'rounded-2xl' : ''}`}>
      {/* Sidebar - Chat List */}
      <div className={`w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col ${selectedThread ? 'hidden md:flex' : 'flex'}`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h1 className="text-xl font-bold text-slate-800">Pesan Masuk</h1>
          {onClose && (
             <button onClick={onClose} className="md:hidden p-2 hover:bg-slate-100 rounded-full text-slate-500">
               <X size={20} />
             </button>
          )}
        </div>
        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari pelanggan..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Thread List */}
        <div className="flex-1 overflow-y-auto">
          {filteredThreads.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Belum ada percakapan</div>
          ) : (
            filteredThreads.map(thread => (
              <div 
                key={thread.id}
                onClick={() => setSelectedThread(thread)}
                className={`p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${selectedThread?.id === thread.id ? 'bg-emerald-50/50 border-l-4 border-l-emerald-500' : ''}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
                      {thread.userInfo.photoURL ? (
                        <Image src={thread.userInfo.photoURL} alt={thread.userInfo.name} width={40} height={40} className="object-cover w-full h-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-300 text-slate-500">
                          <User size={20} />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className={`text-sm ${!thread.isReadByAdmin ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                        {thread.userInfo.name}
                      </h3>
                      <p className={`text-xs truncate max-w-[140px] ${!thread.isReadByAdmin ? 'font-bold text-slate-800' : 'text-slate-500'}`}>
                        {thread.lastMessage}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] text-slate-400">
                      {thread.lastMessageTime ? new Date(thread.lastMessageTime.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                    </span>
                    {!thread.isReadByAdmin && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col bg-[#F0F2F5] ${!selectedThread ? 'hidden md:flex' : 'flex'}`}>
        {selectedThread ? (
          <>
            {/* Chat Header */}
            <div className="bg-white p-4 border-b border-slate-200 flex items-center justify-between shadow-sm z-10">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedThread(null)} className="md:hidden p-2 hover:bg-slate-100 rounded-full">
                  <ArrowLeft size={20} />
                </button>
                <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden">
                  {selectedThread.userInfo.photoURL ? (
                    <Image src={selectedThread.userInfo.photoURL} alt={selectedThread.userInfo.name} width={40} height={40} className="object-cover w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-300 text-slate-500">
                      <User size={20} />
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">{selectedThread.userInfo.name}</h2>
                  <p className="text-xs text-slate-500">{selectedThread.userInfo.email}</p>
                </div>
              </div>
              <div className="flex gap-2">
                 {onClose && (
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                      <X size={20} />
                    </button>
                 )}
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100/50">
              {messages.map((msg, idx) => {
                const isAdmin = msg.senderId === 'admin';
                return (
                  <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-2xl p-3 shadow-sm ${
                      isAdmin 
                        ? 'bg-emerald-600 text-white rounded-br-none' 
                        : 'bg-white text-slate-800 rounded-bl-none'
                    }`}>
                      {msg.type === 'image' && msg.imageUrl && (
                        <div className="mb-2 rounded-lg overflow-hidden">
                          <Image src={msg.imageUrl} alt="Attachment" width={200} height={200} className="w-full h-auto" />
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                      <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isAdmin ? 'text-emerald-100' : 'text-slate-400'}`}>
                        <span>
                          {msg.createdAt ? new Date(msg.createdAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
                        </span>
                        {isAdmin && (
                          <span>
                            {msg.isRead ? <CheckCheck size={14} /> : <Check size={14} />}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-white p-4 border-t border-slate-200">
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <button type="button" className="p-3 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors">
                  <ImageIcon size={20} />
                </button>
                <input 
                  type="text" 
                  className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  placeholder="Ketik pesan balasan..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button 
                  type="submit" 
                  disabled={!newMessage.trim()}
                  className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-200"
                >
                  <Send size={20} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 relative">
             {onClose && (
                <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full text-slate-500">
                  <X size={20} />
                </button>
             )}
            <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-4 text-slate-400">
              <Send size={40} />
            </div>
            <h3 className="text-lg font-bold text-slate-600">Admin Chat Center</h3>
            <p className="text-sm">Pilih percakapan untuk mulai membalas pesan.</p>
          </div>
        )}
      </div>
    </div>
  );
}
