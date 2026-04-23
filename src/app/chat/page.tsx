'use client';

import CustomerChat from '@/components/CustomerChat';

export default function ChatPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto h-[calc(100vh-80px)] p-4">
        <CustomerChat />
      </div>
    </div>
  );
}
