
export interface ChatThread {
  id: string; // User ID
  userInfo: {
    uid: string;
    name: string;
    email: string;
    photoURL?: string;
  };
  lastMessage: string;
  lastMessageTime: string | Date;
  unreadCount: number;
  isReadByAdmin: boolean;
  updatedAt?: string | Date;
}

export interface ChatMessage {
  id: string;
  senderId: string; // 'admin' or userId
  text: string;
  type: 'text' | 'image';
  imageUrl?: string;
  createdAt: string | Date;
  isRead: boolean;
}
