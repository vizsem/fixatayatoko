'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import type { MessagePayload } from 'firebase/messaging';
import { requestForToken, onMessageListener } from '@/lib/fcm';
import notify from '@/lib/notify';

export default function FCMManager() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Hanya request token jika sudah diizinkan sebelumnya
      if (Notification.permission === 'granted') {
        requestForToken();
      }
      
      // Listen for foreground messages
      onMessageListener().then((payload) => {
        const p = payload as MessagePayload;
      console.log('Foreground notification:', p);
      notify.custom((t: { id: string }) => (
        <div className="flex items-start gap-3 cursor-pointer" onClick={() => notify.dismiss(t.id)}>
          {p.notification?.icon && (
            <Image
              src={p.notification.icon}
              alt=""
              width={40}
              height={40}
              className="rounded-lg object-cover"
              unoptimized
            />
          )}
          <div>
            <h4 className="font-bold text-sm text-gray-900">{p.notification?.title}</h4>
            <p className="text-xs text-gray-600 mt-1">{p.notification?.body}</p>
          </div>
        </div>
      ), { duration: 5000, position: 'top-center', style: { borderRadius: '1rem', padding: '12px' } });
    });
    }
  }, []);

  return null;
}
