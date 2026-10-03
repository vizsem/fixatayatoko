'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { MessageCircle, X } from 'lucide-react';

const CustomerChat = dynamic(() => import('./CustomerChat'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full min-h-[300px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
    </div>
  ),
});

export default function FloatingChatButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 p-4 bg-emerald-600 text-white rounded-full shadow-2xl hover:bg-emerald-700 transition-all duration-300 hover:scale-110 group"
        aria-label="Chat dengan customer support"
      >
        {isOpen ? (
          <X size={24} className="transition-transform duration-300" />
        ) : (
          <MessageCircle size={24} className="transition-transform duration-300" />
        )}
        
        {/* Tooltip */}
        {!isOpen && (
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Butuh bantuan? Chat kami!
            <span className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-gray-900"></span>
          </span>
        )}

        {/* Notification Badge (optional - can be connected to unread count) */}
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs font-bold flex items-center justify-center animate-pulse">
          1
        </span>
      </button>

      {/* Chat Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm">
          <div 
            className="w-full md:max-w-2xl h-[80vh] md:h-[600px] bg-white md:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <CustomerChat onClose={() => setIsOpen(false)} isModal={true} />
          </div>
        </div>
      )}

      {/* Backdrop click to close */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
