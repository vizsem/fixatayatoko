'use client';

import { useState, useEffect, useRef } from 'react';
import { db, auth } from '@/lib/firebase';
import {
  collection, query, orderBy, onSnapshot,
  doc, updateDoc, addDoc, serverTimestamp,
  setDoc, getDoc
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  MessageCircle, X, Send, Image as ImageIcon, 
  Minimize2, Maximize2
} from 'lucide-react';
import Image from 'next/image';
import type { ChatMessage } from '@/types/chat';
import { toast } from 'react-hot-toast';

export default function CustomerChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Check role to hide widget for admins/cashiers
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          const role = userDoc.data()?.role;
          if (role === 'admin' || role === 'cashier') {
            setUser(null); // Hide widget
            return;
          }
        } catch (e) {
          console.error("Error checking role:", e);
        }
      }
      setUser(currentUser);
    });
    return () => unsub();
  }, []);

  // 2. Fetch Messages & Listen for Unread
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'chats', user.uid, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      
      setMessages(msgs);

      // Count unread messages from admin
      if (!isOpen) {
        const unread = msgs.filter(m => m.senderId === 'admin' && !m.isRead).length;
        setUnreadCount(unread);
      }
    });

    return () => unsubscribe();
  }, [user, isOpen]);

  // 3. Auto-scroll & Mark as Read
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      
      // Mark admin messages as read
      const unreadAdminMsgs = messages.filter(m => m.senderId === 'admin' && !m.isRead);
      unreadAdminMsgs.forEach(msg => {
        updateDoc(doc(db, 'chats', user.uid, 'messages', msg.id), { isRead: true });
      });
      setUnreadCount(0);
    }
  }, [messages, isOpen, user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMessage.trim()) return;

    try {
      const text = newMessage.trim();
      setNewMessage('');

      // 1. Ensure Chat Thread Exists
      const chatRef = doc(db, 'chats', user.uid);
      const chatSnap = await getDoc(chatRef);

      if (!chatSnap.exists()) {
        await setDoc(chatRef, {
          id: user.uid,
          userInfo: {
            uid: user.uid,
            name: user.displayName || 'Pelanggan',
            email: user.email,
            photoURL: user.photoURL
          },
          createdAt: serverTimestamp(),
          unreadCount: 0,
          isReadByAdmin: false
        });
      }

      // 2. Add Message
      await addDoc(collection(db, 'chats', user.uid, 'messages'), {
        text,
        senderId: user.uid,
        createdAt: serverTimestamp(),
        isRead: false,
        type: 'text'
      });

      // 3. Update Thread Metadata
      await updateDoc(chatRef, {
        lastMessage: text,
        lastMessageTime: serverTimestamp(),
        isReadByAdmin: false,
        unreadCount: (chatSnap.data()?.unreadCount || 0) + 1
      });

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Gagal mengirim pesan');
    }
  };

  if (!user) return null; // Hide if not logged in

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Window */}
      <div 
        className={`bg-white w-[350px] h-[500px] rounded-2xl shadow-2xl border border-slate-100 flex flex-col transition-all duration-300 origin-bottom-right overflow-hidden ${
          isOpen ? 'scale-100 opacity-100 mb-4' : 'scale-0 opacity-0 h-0 mb-0'
        }`}
      >
        {/* Header */}
        <div className="bg-emerald-600 p-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <MessageCircle size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm">Admin Support</h3>
              <p className="text-[10px] text-emerald-100">Biasanya membalas dalam 1 jam</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
              <Minimize2 size={16} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-xs text-slate-400">Belum ada pesan. Sapa admin kami! 👋</p>
            </div>
          )}
          {messages.map((msg) => {
            const isMe = msg.senderId === user.uid;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm ${
                    isMe 
                      ? 'bg-emerald-600 text-white rounded-br-none' 
                      : 'bg-white text-slate-700 rounded-bl-none border border-slate-100'
                  }`}
                >
                  <p>{msg.text}</p>
                  <span className={`text-[9px] block mt-1 text-right ${isMe ? 'text-emerald-100' : 'text-slate-400'}`}>
                    {msg.createdAt ? new Date(msg.createdAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 bg-white border-t border-slate-100 shrink-0">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <input 
              className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none placeholder:text-slate-400"
              placeholder="Tulis pesan..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
            />
            <button 
              type="submit"
              disabled={!newMessage.trim()} 
              className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-200"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>

      {/* Floating Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 relative ${
          isOpen ? 'bg-slate-800 text-white rotate-90' : 'bg-emerald-600 text-white'
        }`}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={28} />}
        
        {/* Unread Badge */}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
