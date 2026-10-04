'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, X, Send, Image as ImageIcon, 
  Minimize2, Maximize2
} from 'lucide-react';
import type { ChatMessage } from '@/types/chat';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

import { sbGetDoc, sbUpdateDoc, sbUpsertDoc } from '@/lib/supabase-helpers';
export default function CustomerChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Auth Listener
  useEffect(() => {
    const checkRoleAndSetUser = async (sbUser: any) => {
      if (sbUser) {
        try {
          const userDoc = await sbGetDoc('users', sbUser.id, false);
          const role = userDoc.data()?.role;
          if (role === 'admin' || role === 'cashier') {
            setUser(null); // Hide widget
            return;
          }
        } catch (e) {
          console.error("Error checking role:", e);
        }
        setUser({ uid: sbUser.id, ...sbUser });
      } else {
        setUser(null);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      checkRoleAndSetUser(session?.user);
    });
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      checkRoleAndSetUser(currentUser);
    });
    return () => subscription.unsubscribe();
  }, []);

  // 2. Fetch Messages & Listen for Unread
  useEffect(() => {
    if (!user) return;

    if (isOpen) {
      const fetchMessages = async () => {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_id', user.uid)
          .order('created_at', { ascending: true });
        if (!error && data) {
          setMessages(data.map(d => ({
            id: d.id,
            text: d.text,
            senderId: d.sender_id,
            createdAt: d.created_at,
            isRead: d.is_read,
            type: d.type,
            imageUrl: d.image_url,
            ...(d.raw_data || {})
          } as ChatMessage)));
        }
      };

      fetchMessages();

      const channel = supabase
        .channel(`chat_messages_${user.uid}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${user.uid}` },
          () => {
            fetchMessages();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      let isMounted = true;
      supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('chat_id', user.uid)
        .eq('sender_id', 'admin')
        .eq('is_read', false)
        .then(({ count }) => {
          if (isMounted && typeof count === 'number') setUnreadCount(count);
        });

      return () => { isMounted = false; };
    }
  }, [user, isOpen]);

  // 3. Auto-scroll & Mark as Read
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      
      // Mark admin messages as read
      const unreadAdminMsgs = messages.filter(m => m.senderId === 'admin' && !m.isRead);
      if (unreadAdminMsgs.length > 0) {
        supabase
          .from('messages')
          .update({ is_read: true })
          .in('id', unreadAdminMsgs.map(m => m.id))
          .then(() => setUnreadCount(0));
      }
    }
  }, [messages, isOpen, user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMessage.trim()) return;

    try {
      const text = newMessage.trim();
      setNewMessage('');

      // 1. Ensure Chat Thread Exists
      const chatSnap = await sbGetDoc('chats', user.uid, false);

      if (!chatSnap.exists()) {
        await sbUpsertDoc('chats', user.uid, {
          id: user.uid,
          userInfo: {
            uid: user.uid,
            name: user.user_metadata?.full_name || user.displayName || 'Pelanggan',
            email: user.email,
            photoURL: user.user_metadata?.avatar_url || user.photoURL
          },
          createdAt: new Date().toISOString(),
          unreadCount: 0,
          isReadByAdmin: false
        }, false);
      }

      // 2. Add Message
      const now = new Date().toISOString();
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const { error: msgErr } = await supabase.from('messages').insert({
        id: msgId,
        chat_id: user.uid,
        text,
        sender_id: user.uid,
        is_read: false,
        type: 'text',
        created_at: now,
        updated_at: now,
        raw_data: {
          id: msgId,
          text,
          senderId: user.uid,
          createdAt: now,
          isRead: false,
          type: 'text'
        }
      });
      if (msgErr) throw msgErr;

      // 3. Update Thread Metadata
      await sbUpdateDoc('chats', user.uid, {
        lastMessage: text,
        lastMessageTime: now,
        isReadByAdmin: false,
        unreadCount: (chatSnap.data()?.unreadCount || 0) + 1
      }, false);

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Gagal mengirim pesan');
    }
  };

  if (!user) return null; // Hide if not logged in

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
      {/* Chat Window */}
      <div 
        className={`bg-white w-[350px] h-[500px] rounded-2xl shadow-2xl border border-slate-100 flex flex-col transition-all duration-300 origin-bottom-right overflow-hidden pointer-events-auto ${
          isOpen ? 'scale-100 opacity-100 mb-4 visible' : 'scale-0 opacity-0 h-0 mb-0 invisible'
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
              <p className="text-xs text-emerald-100">Biasanya membalas dalam 1 jam</p>
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
                  <span className={`text-xs block mt-1 text-right ${isMe ? 'text-emerald-100' : 'text-slate-400'}`}>
                    {msg.createdAt ? new Date((msg.createdAt as any).toDate ? (msg.createdAt as any).toDate() : msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
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
        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 relative pointer-events-auto ${
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
