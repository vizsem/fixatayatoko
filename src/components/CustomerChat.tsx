'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, X, Image as ImageIcon, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

import { sbGetDoc, sbInsertDoc, sbUpdateDoc } from '@/lib/supabase-helpers';
interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  createdAt: any;
  isRead: boolean;
  type?: 'text' | 'image';
  imageUrl?: string;
}

interface CustomerChatProps {
  onClose?: () => void;
  isModal?: boolean;
}

export default function CustomerChat({ onClose, isModal = false }: CustomerChatProps) {
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatId, setChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      setUser(u ? { uid: u.id, ...u } : null);
    });
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (u) setUser({ uid: u.id, ...u });
    });
    return () => subscription.unsubscribe();
  }, []);
  const [uploadingImage, setUploadingImage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize or get existing chat thread
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const initializeChat = async () => {
      try {
        // Check if chat thread already exists for this user
        const { data: existingChats } = await supabase
          .from('chats')
          .select('*')
          .eq('raw_data->>userId', user.uid)
          .limit(1);

        let threadId: string;

        if (existingChats && existingChats.length > 0) {
          // Use existing chat thread
          threadId = existingChats[0].id;
        } else {
          // Create new chat thread
          const userDoc = await sbGetDoc('users', user.uid, false);
          const userData = userDoc.data();

          const newThread = await sbInsertDoc('chats', {
            userId: user.uid,
            userInfo: {
              name: userData?.displayName || userData?.name || user.user_metadata?.full_name || 'Pelanggan',
              email: userData?.email || user.email,
              photoURL: userData?.photoURL || user.user_metadata?.avatar_url,
            },
            lastMessage: '',
            lastMessageTime: new Date().toISOString(),
            isReadByAdmin: false,
            unreadCount: 0,
            createdAt: new Date().toISOString(),
          }, false);

          threadId = newThread.id;
        }

        setChatId(threadId);
      } catch (error) {
        console.error('Error initializing chat:', error);
        toast.error('Gagal memuat chat');
      } finally {
        setLoading(false);
      }
    };

    initializeChat();
  }, [user]);

  // Fetch messages for this chat
  useEffect(() => {
    if (!chatId) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });
      if (!error && data) {
        const msgs = data.map(d => ({
          id: d.id,
          text: d.text,
          senderId: d.sender_id,
          createdAt: d.created_at,
          isRead: d.is_read,
          type: d.type,
          imageUrl: d.image_url,
          ...(d.raw_data || {})
        })) as ChatMessage[];
        setMessages(msgs);
        scrollToBottom();
      }
    };

    fetchMessages();

    const channel = supabase
      .channel(`chat_messages_${chatId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatId || !newMessage.trim()) return;

    try {
      const text = newMessage.trim();
      setNewMessage('');

      const now = new Date().toISOString();
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const { error: msgErr } = await supabase.from('messages').insert({
        id: msgId,
        chat_id: chatId,
        text,
        sender_id: user?.uid || 'customer',
        createdAt: now,
        created_at: now,
        updated_at: now,
        is_read: false,
        type: 'text',
        raw_data: {
          id: msgId,
          text,
          senderId: user?.uid || 'customer',
          createdAt: now,
          isRead: false,
          type: 'text'
        }
      });
      if (msgErr) throw msgErr;

      // Update thread metadata
      const chatSnap = await sbGetDoc('chats', chatId, false);
      const unread = (chatSnap.data()?.unreadCount || 0) + 1;
      await sbUpdateDoc('chats', chatId, {
        lastMessage: text,
        lastMessageTime: now,
        isReadByAdmin: false,
        unreadCount: unread
      }, false);

      // Request notification permission if not granted
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Gagal mengirim pesan');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatId) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Hanya file gambar yang diperbolehkan');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran gambar maksimal 5MB');
      return;
    }

    setUploadingImage(true);

    try {
      // TODO: Upload image to Firebase Storage
      // For now, we'll just show a placeholder
      toast.success('Fitur upload gambar akan segera hadir!');
      
      /* 
      // Implementation example:
      const storageRef = ref(storage, `chat-images/${chatId}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: 'Mengirim gambar...',
        senderId: user?.uid || 'customer',
        createdAt: new Date().toISOString(),
        isRead: false,
        type: 'image',
        imageUrl: downloadURL
      });
      */
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Gagal mengupload gambar');
    } finally {
      setUploadingImage(false);
    }
  };

  if (!user) {
    return (
      <div className={`flex flex-col items-center justify-center h-full bg-white ${isModal ? 'rounded-2xl' : ''}`}>
        <MessageCircle size={48} className="text-slate-300 mb-4" />
        <h3 className="text-lg font-bold text-slate-700 mb-2">Login Diperlukan</h3>
        <p className="text-sm text-slate-500 mb-4">Silakan login untuk memulai chat</p>
        <button 
          onClick={() => window.location.href = '/login'}
          className="px-6 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
        >
          Login
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full bg-white ${isModal ? 'rounded-2xl' : ''}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-[#F0F2F5] overflow-hidden ${isModal ? 'rounded-2xl' : ''}`}>
      {/* Chat Header */}
      <div className="bg-white p-4 border-b border-slate-200 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
            <MessageCircle size={20} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800">Customer Support</h2>
            <p className="text-xs text-slate-500">Online • Biasanya membalas dalam beberapa menit</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
              <MessageCircle size={32} />
            </div>
            <p className="text-sm">Mulai percakapan dengan customer support kami</p>
            <p className="text-xs mt-1">Kami siap membantu Anda!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isCustomer = msg.senderId === user.uid;
            return (
              <div key={msg.id} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl p-3 shadow-sm ${
                  isCustomer 
                    ? 'bg-emerald-600 text-white rounded-br-none' 
                    : 'bg-white text-slate-800 rounded-bl-none'
                }`}>
                  {msg.type === 'image' && msg.imageUrl && (
                    <div className="mb-2 rounded-lg overflow-hidden">
                      <img src={msg.imageUrl} alt="Attachment" className="w-full h-auto max-w-[200px]" loading="lazy" />
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                  <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${isCustomer ? 'text-emerald-100' : 'text-slate-400'}`}>
                    <span>
                      {msg.createdAt ? new Date(msg.createdAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white p-4 border-t border-slate-200">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            className="p-3 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors disabled:opacity-50"
          >
            {uploadingImage ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600"></div>
            ) : (
              <ImageIcon size={20} />
            )}
          </button>
          <input 
            type="text" 
            className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
            placeholder="Ketik pesan..."
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
    </div>
  );
}
