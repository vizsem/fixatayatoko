import { Timestamp } from 'firebase/firestore';

export interface ChatThread {
  id: string; // User ID
  userInfo: {
    uid: string;
    name: string;
    email: string;
    photoURL?: string;
  };
  lastMessage: string;
  lastMessageTime: Timestamp;
  unreadCount: number;
  isReadByAdmin: boolean;
  updatedAt?: Timestamp;
}

export interface ChatMessage {
  id: string;
  senderId: string; // 'admin' or userId
  text: string;
  type: 'text' | 'image';
  imageUrl?: string;
  createdAt: Timestamp;
  isRead: boolean;
}
